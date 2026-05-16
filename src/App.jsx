import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  Download,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
} from 'lucide-react';
import { CollapsibleSection } from './components/CollapsibleSection.jsx';
import { NoteCard } from './components/NoteCard.jsx';
import { ProjectsHome } from './components/ProjectsHome.jsx';
import { StatCard } from './components/StatCard.jsx';
import {
  AI_GENERATION_COUNT,
  AI_REVEAL_STEP_MS,
  DEFAULT_AI_DIVERGENCE,
  DEFAULT_NOTE_FONT_SCALE,
  appendNotes,
  computeTopTag,
  createInitialBoard,
  createNote,
  deleteNote,
  normalizeAiDivergence,
  normalizeAiWeight,
  normalizeBoard,
  normalizeDismissedNotes,
  normalizeNoteFingerprint,
  normalizeNoteFontScale,
  patchNote,
  removeNotesById,
  selectAiContextNotes,
  sortNotes,
  touchBoard,
} from './lib/boardModel.js';
import {
  getBoardStorageKey,
  loadBoardById,
  loadProjects,
  persistBoardById,
  persistProjects,
  removeBoardById,
} from './lib/boardStorage.js';
import { fetchAiStatus, requestIdeaGeneration } from './lib/aiClient.js';
import { createId } from './lib/ids.js';
import {
  getLocale,
  loadLanguage,
  normalizeLanguage,
  persistLanguage,
  remapSuggestedTag,
} from './lib/locale.js';
import { formatClock } from './lib/formatters.js';
import { downloadBoard } from './lib/ui.js';
import './App.css';

function App() {
  const [language, setLanguage] = useState(loadLanguage);
  const [projects, setProjects] = useState(() => loadProjects(language));
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [board, setBoard] = useState(null);
  const [composer, setComposer] = useState({ text: '', tag: '' });
  const [promptIndex, setPromptIndex] = useState(0);
  const [filters, setFilters] = useState({ scope: 'active', tag: 'all', sort: 'recent', search: '' });
  const [notice, setNotice] = useState(null);
  const [aiAssist, setAiAssist] = useState({ available: null, loading: false, model: null, reason: 'checking' });
  const deferredSearch = useDeferredValue(filters.search);
  const importInputId = useId();
  const lastSerializedRef = useRef('');
  const revealTimersRef = useRef([]);
  const generationRequestRef = useRef(null);
  const activeProjectIdRef = useRef(activeProjectId);

  const locale = getLocale(language);
  const text = locale.text;
  const fallbackModelName = aiAssist.model ?? 'Gemma';

  const activeNotes = useMemo(() => (board?.notes ?? []).filter((n) => !n.archived), [board?.notes]);
  const archivedNotes = useMemo(() => (board?.notes ?? []).filter((n) => n.archived), [board?.notes]);
  const tagOptions = [...new Set((board?.notes ?? []).map((n) => n.tag).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, locale.sortLocale)
  );
  const topTag = (() => {
    const tag = computeTopTag(activeNotes);
    return tag || text.topTagFallback;
  })();
  const aiDivergence = board?.aiDivergence ?? DEFAULT_AI_DIVERGENCE;
  const noteFontScale = board?.noteFontScale ?? DEFAULT_NOTE_FONT_SCALE;
  const promptDeck = locale.promptDeck;
  const currentPrompt = promptDeck[promptIndex % promptDeck.length];

  const aiStatusMessage = aiAssist.loading
    ? text.promptActions.generating
    : aiAssist.reason === 'ready' && aiAssist.model
      ? text.promptStatus.ready(aiAssist.model)
      : aiAssist.reason === 'model_missing'
        ? text.promptStatus.modelMissing(aiAssist.model ?? fallbackModelName)
        : aiAssist.reason === 'connection_failed'
          ? text.promptStatus.offline
          : aiAssist.reason === 'generation_failed'
            ? text.promptStatus.failed
            : text.promptStatus.checking;

  function clearRevealTimers() {
    if (typeof window === 'undefined') return;
    revealTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    revealTimersRef.current = [];
  }

  function queueReveal(callback, delay = 0) {
    if (typeof window === 'undefined' || delay <= 0) {
      callback();
      return;
    }

    const timerId = window.setTimeout(() => {
      revealTimersRef.current = revealTimersRef.current.filter((entry) => entry !== timerId);
      callback();
    }, delay);

    revealTimersRef.current.push(timerId);
  }

  function isCurrentGeneration(token, projectId) {
    return (
      generationRequestRef.current?.token === token &&
      generationRequestRef.current?.projectId === projectId &&
      activeProjectIdRef.current === projectId
    );
  }

  function cancelGeneration({ removePlaceholders = true, resetLoading = true } = {}) {
    const request = generationRequestRef.current;
    if (request) {
      request.controller.abort();
      generationRequestRef.current = null;
      if (removePlaceholders && request.placeholderIds.length) {
        setBoard((current) => {
          if (!current || activeProjectIdRef.current !== request.projectId) return current;
          return removeNotesById(current, request.placeholderIds);
        });
      }
    }

    clearRevealTimers();
    if (resetLoading) {
      setAiAssist((current) => ({ ...current, loading: false }));
    }
  }

  const visibleNotes = useMemo(() => {
    const scopeNotes = filters.scope === 'archived' ? archivedNotes : activeNotes;
    const search = deferredSearch.trim().toLowerCase();
    const filtered = scopeNotes.filter((note) => {
      if (filters.tag !== 'all' && note.tag !== filters.tag) return false;
      if (!search) return true;
      return `${note.text} ${note.tag} ${note.author}`.toLowerCase().includes(search);
    });
    return sortNotes(filtered, filters.sort, language);
  }, [activeNotes, archivedNotes, deferredSearch, filters.scope, filters.sort, filters.tag, language]);

  const applyIncomingBoard = useEffectEvent((serializedBoard) => {
    if (!serializedBoard || serializedBoard === lastSerializedRef.current) return;
    try {
      const nextBoard = normalizeBoard(JSON.parse(serializedBoard), language);
      lastSerializedRef.current = serializedBoard;
      setBoard(nextBoard);
      setNotice({ tone: 'info', text: text.notices.sync });
    } catch {
      setNotice({ tone: 'error', text: text.notices.syncInvalid });
    }
  });

  const handleBoardReset = useEffectEvent(() => {
    cancelGeneration();
    setBoard(createInitialBoard(language));
    setNotice({ tone: 'info', text: text.notices.syncReset });
  });

  const syncAiStatus = useEffectEvent(async () => {
    try {
      const { ok, payload } = await fetchAiStatus();
      if (!ok) {
        setAiAssist((current) => ({
          ...current,
          available: false,
          loading: false,
          model: payload.model ?? current.model,
          reason: payload.reason ?? 'connection_failed',
        }));
        return;
      }
      setAiAssist((current) => ({
        ...current,
        available: payload.available,
        loading: false,
        model: payload.model ?? current.model,
        reason: payload.reason ?? (payload.available ? 'ready' : 'model_missing'),
      }));
    } catch {
      setAiAssist((current) => ({ ...current, available: false, loading: false, reason: 'connection_failed' }));
    }
  });

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || !board) return;
    const serialized = JSON.stringify(board);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    persistBoardById(activeProjectId, serialized);
    const noteCount = board.notes.filter((n) => !n.archived).length;
    const topTagVal = computeTopTag(board.notes);
    setProjects((prev) => {
      const updated = prev.map((project) =>
        project.id === activeProjectId
          ? { ...project, title: board.title, updatedAt: board.updatedAt, noteCount, topTag: topTagVal }
          : project
      );
      persistProjects(updated);
      return updated;
    });
  }, [board, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || typeof window === 'undefined') return undefined;
    const key = getBoardStorageKey(activeProjectId);
    function handleStorage(event) {
      if (event.key !== key) return;
      if (!event.newValue) {
        handleBoardReset();
        return;
      }
      applyIncomingBoard(event.newValue);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeProjectId]);

  useEffect(() => {
    if (!notice || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => () => {
    generationRequestRef.current?.controller.abort();
    generationRequestRef.current = null;
    clearRevealTimers();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale.htmlLang;
    document.title = text.documentTitle;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', text.documentDescription);
  }, [locale.htmlLang, text.documentDescription, text.documentTitle]);

  useEffect(() => {
    const timer = window.setTimeout(() => syncAiStatus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleEnterProject(projectId) {
    cancelGeneration();
    const nextBoard = loadBoardById(projectId, language);
    activeProjectIdRef.current = projectId;
    lastSerializedRef.current = '';
    setBoard(nextBoard);
    setActiveProjectId(projectId);
    setFilters({ scope: 'active', tag: 'all', sort: 'recent', search: '' });
    setComposer({ text: '', tag: locale.tagSuggestions[0] });
  }

  function handleCreateProject(title) {
    cancelGeneration();
    const projectId = createId();
    const now = Date.now();
    const newProject = { id: projectId, title, updatedAt: now, noteCount: 0, topTag: '' };
    const newBoard = {
      version: 3,
      title,
      owner: locale.defaults.owner,
      aiDivergence: DEFAULT_AI_DIVERGENCE,
      noteFontScale: DEFAULT_NOTE_FONT_SCALE,
      dismissedNotes: [],
      notes: [],
      updatedAt: now,
    };
    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    persistProjects(updatedProjects);
    persistBoardById(projectId, JSON.stringify(newBoard));
    handleEnterProject(projectId);
  }

  function handleDeleteProject(projectId) {
    if (activeProjectId === projectId) {
      cancelGeneration();
    }
    const updated = projects.filter((project) => project.id !== projectId);
    setProjects(updated);
    persistProjects(updated);
    removeBoardById(projectId);
    if (activeProjectId === projectId) {
      activeProjectIdRef.current = null;
      setActiveProjectId(null);
      setBoard(null);
    }
  }

  function handleBackToHome() {
    cancelGeneration();
    activeProjectIdRef.current = null;
    setActiveProjectId(null);
    setBoard(null);
    lastSerializedRef.current = '';
  }

  function handleLanguageChange(nextLanguage) {
    const normalized = normalizeLanguage(nextLanguage);
    if (normalized === language) return;
    persistLanguage(normalized);
    setLanguage(normalized);
    setComposer((current) => ({ ...current, tag: remapSuggestedTag(current.tag, language, normalized) }));
    if (board) {
      setBoard((current) => {
        const cd = locale.defaults;
        const nd = getLocale(normalized).defaults;
        let changed = false;
        const next = { ...current };
        if ((current.title || '').trim() === cd.title) {
          next.title = nd.title;
          changed = true;
        }
        if ((current.owner || '').trim() === cd.owner) {
          next.owner = nd.owner;
          changed = true;
        }
        return changed ? touchBoard(next) : current;
      });
    }
    setNotice({ tone: 'info', text: getLocale(normalized).text.notices.languageSwitched });
  }

  function handleBoardField(field, value, fallback) {
    setBoard((current) => touchBoard({ ...current, [field]: value.trim() || fallback }));
  }

  function handleAddNote(event) {
    event.preventDefault();
    const idea = composer.text.trim();
    if (!idea || !board) return;
    const note = createNote({ text: idea, tag: composer.tag, author: board.owner, fallbackAuthor: locale.defaults.owner });
    setBoard((current) => appendNotes(current, [note]));
    setComposer((current) => ({ ...current, text: '' }));
    setNotice({ tone: 'success', text: text.notices.added });
  }

  async function handleGeneratePack() {
    const currentBoard = board;
    const requestProjectId = activeProjectId;
    if (!currentBoard || !requestProjectId) return;

    cancelGeneration({ resetLoading: false });
    const token = Symbol('ai-generation');
    const controller = new AbortController();
    const currentAiDivergence = currentBoard.aiDivergence ?? DEFAULT_AI_DIVERGENCE;
    const currentActiveNotes = currentBoard.notes.filter((note) => !note.archived);
    const currentAiContextNotes = currentAiDivergence >= 100 ? [] : selectAiContextNotes(currentActiveNotes);
    const activeFingerprints = new Set(
      currentActiveNotes.map((note) => normalizeNoteFingerprint(note.text)).filter(Boolean)
    );
    const dismissedNotes = normalizeDismissedNotes(currentBoard.dismissedNotes).filter(
      (entry) => !activeFingerprints.has(normalizeNoteFingerprint(entry))
    );
    const placeholderNotes = Array.from({ length: AI_GENERATION_COUNT }, (_, generationIndex) =>
      createNote({
        text: text.noteCard.generating,
        tag: currentPrompt.tag,
        author: text.authors.ideaEngine,
        source: 'ai',
        fallbackAuthor: locale.defaults.owner,
        generationState: 'generating',
        generationIndex,
      })
    );
    const placeholderIds = placeholderNotes.map((note) => note.id);
    generationRequestRef.current = { token, projectId: requestProjectId, controller, placeholderIds };

    setBoard((current) => (current ? appendNotes(current, placeholderNotes) : current));
    setAiAssist((current) => ({ ...current, loading: true, reason: current.available === null ? 'checking' : current.reason }));

    try {
      const { ok, payload } = await requestIdeaGeneration({
        language,
        topic: currentBoard.title,
        prompt: {
          id: currentPrompt.id,
          title: currentPrompt.title,
          prompt: currentPrompt.prompt,
          tag: currentPrompt.tag,
        },
        aiDivergence: currentAiDivergence,
        existingNotes: currentAiContextNotes.map((note) => ({
          text: note.text,
          tag: note.tag,
          aiWeight: note.aiWeight,
        })),
        dismissedNotes,
      }, { signal: controller.signal });

      if (!isCurrentGeneration(token, requestProjectId)) return;
      if (!ok) {
        const reason = payload.reason ?? 'generation_failed';
        const message = reason === 'model_missing'
          ? text.notices.aiModelMissing(payload.model ?? fallbackModelName)
          : reason === 'connection_failed'
            ? text.notices.aiConnectionFailed
            : text.notices.aiRequestFailed(payload.message || text.promptStatus.failed);
        const err = new Error(message);
        err.reason = reason;
        err.model = payload.model ?? fallbackModelName;
        throw err;
      }

      const generatedNotes = (payload.ideas || [])
        .filter((idea) => typeof idea === 'string' && idea.trim())
        .slice(0, AI_GENERATION_COUNT);
      if (!generatedNotes.length) throw new Error(text.notices.aiRequestFailed(text.promptStatus.failed));

      const modelName = payload.model ?? fallbackModelName;
      generatedNotes.forEach((idea, index) => {
        queueReveal(() => {
          if (!isCurrentGeneration(token, requestProjectId)) return;
          setBoard((current) => {
            if (!current) return current;
            const placeholderId = placeholderIds[index];
            if (!current.notes.some((note) => note.id === placeholderId)) return current;
            return patchNote(current, placeholderId, () => ({
              text: idea,
              tag: currentPrompt.tag,
              author: text.authors.ideaEngine,
              source: 'ai',
              generationState: 'ready',
              generationIndex: 0,
            }));
          });
        }, index * AI_REVEAL_STEP_MS);
      });

      const extraPlaceholderIds = placeholderIds.slice(generatedNotes.length);
      if (extraPlaceholderIds.length) {
        queueReveal(() => {
          if (!isCurrentGeneration(token, requestProjectId)) return;
          setBoard((current) => (current ? removeNotesById(current, extraPlaceholderIds) : current));
        }, generatedNotes.length * AI_REVEAL_STEP_MS);
      }

      queueReveal(() => {
        if (!isCurrentGeneration(token, requestProjectId)) return;
        generationRequestRef.current = null;
        setAiAssist({ available: true, loading: false, model: modelName, reason: 'ready' });
        setNotice({ tone: 'success', text: text.notices.generated(modelName) });
      }, Math.max(generatedNotes.length - 1, 0) * AI_REVEAL_STEP_MS + 40);
    } catch (error) {
      if (controller.signal.aborted || !isCurrentGeneration(token, requestProjectId)) return;
      clearRevealTimers();
      generationRequestRef.current = null;
      setBoard((current) => (current ? removeNotesById(current, placeholderIds) : current));
      const message = error instanceof Error ? error.message : text.promptStatus.failed;
      const reason = error?.reason ?? 'generation_failed';
      const model = error?.model ?? fallbackModelName;
      setAiAssist((current) => ({
        ...current,
        available: reason === 'connection_failed' || reason === 'model_missing' ? false : current.available,
        loading: false,
        model,
        reason,
      }));
      setNotice({ tone: 'error', text: message });
    }
  }

  function handlePinPrompt() {
    const note = createNote({
      text: currentPrompt.prompt,
      tag: currentPrompt.tag,
      author: text.authors.promptHost,
      pinned: true,
      source: 'prompt',
      fallbackAuthor: locale.defaults.owner,
    });
    setBoard((current) => appendNotes(current, [note]));
    setNotice({ tone: 'success', text: text.notices.promptPinned });
  }

  function handleVote(noteId, delta = 1) {
    setBoard((current) => patchNote(current, noteId, (note) => ({ votes: Math.max(0, note.votes + delta) })));
  }

  function handleAiWeightChange(noteId, aiWeight) {
    setBoard((current) => patchNote(current, noteId, () => ({ aiWeight: normalizeAiWeight(aiWeight) })));
  }

  function handleAiDivergenceChange(nextValue) {
    setBoard((current) => {
      if (!current) return current;
      return touchBoard({ ...current, aiDivergence: normalizeAiDivergence(nextValue) });
    });
  }

  function handleNoteFontScaleChange(nextValue) {
    setBoard((current) => {
      if (!current) return current;
      return touchBoard({ ...current, noteFontScale: normalizeNoteFontScale(nextValue) });
    });
  }

  function handleArchiveToggle(noteId) {
    setBoard((current) => patchNote(current, noteId, (note) => ({ archived: !note.archived })));
  }

  function handlePinToggle(noteId) {
    setBoard((current) => patchNote(current, noteId, (note) => ({ pinned: !note.pinned })));
  }

  function handleSaveNote(noteId, updates, options = {}) {
    setBoard((current) => patchNote(current, noteId, () => ({ text: updates.text, tag: updates.tag })));
    if (!options.silent) {
      setNotice({ tone: 'success', text: text.notices.saved });
    }
  }

  function handleDeleteNote(noteId) {
    setBoard((current) => deleteNote(current, noteId));
    setNotice({ tone: 'success', text: text.notices.deleted });
  }

  function handleExportBoard() {
    downloadBoard(board);
    setNotice({ tone: 'success', text: text.notices.exported });
  }

  async function handleImportBoard(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const fileText = await file.text();
      const imported = normalizeBoard(JSON.parse(fileText), language, { dropGeneratingNotes: true });
      cancelGeneration();
      startTransition(() => {
        setBoard(imported);
        setNotice({ tone: 'success', text: text.notices.imported });
      });
    } catch {
      setNotice({ tone: 'error', text: text.notices.importFailed });
    }
  }

  if (!activeProjectId) {
    return (
      <ProjectsHome
        language={language}
        projects={projects}
        onEnter={handleEnterProject}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--one" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--two" aria-hidden="true" />
      <div className="app-shell__grid" aria-hidden="true" />

      <header className="board-topbar">
        <button className="board-topbar__back" type="button" onClick={handleBackToHome}>
          <ArrowLeft size={16} />
          <span>{text.backToHome}</span>
        </button>
        <label className="board-topbar__title-wrap">
          <span className="sr-only">{text.titleSr}</span>
          <input
            className="board-topbar__title"
            value={board?.title ?? ''}
            onChange={(e) => handleBoardField('title', e.target.value, locale.defaults.title)}
          />
        </label>
        <div className="board-topbar__controls">
          <label className="presence-card">
            <Users size={15} />
            <span className="sr-only">{text.hostSr}</span>
            <input
              className="presence-card__input"
              value={board?.owner ?? ''}
              onChange={(e) => handleBoardField('owner', e.target.value, locale.defaults.owner)}
            />
          </label>
          <div className="language-switch">
            <span className="language-switch__label">{text.languageLabel}</span>
            <div className="segmented">
              {Object.entries(text.languageOptions).map(([key, label]) => (
                <button key={key} className={language === key ? 'is-active' : ''} type="button" onClick={() => handleLanguageChange(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className="autosave-pill">
            <RefreshCw size={13} />
            {text.autosaved(formatClock(language, board?.updatedAt))}
          </span>
        </div>
      </header>

      {notice ? <div className={`notice notice--${notice.tone}`}>{notice.text}</div> : null}

      <main className="workspace">
        <aside className="workspace__sidebar">
          <section className="panel panel--capture">
            <div className="panel__eyebrow">
              <span className="eyebrow">{text.quickPanel.eyebrow}</span>
              <h3 className="panel__title">{text.quickPanel.title}</h3>
            </div>
            <form className="stack" onSubmit={handleAddNote}>
              <label className="field">
                <span className="field__label">{text.quickPanel.ideaLabel}</span>
                <textarea
                  className="field__control field__control--textarea"
                  placeholder={text.quickPanel.ideaPlaceholder}
                  value={composer.text}
                  onChange={(e) => setComposer((current) => ({ ...current, text: e.target.value }))}
                />
              </label>
              <div className="chip-row">
                {locale.tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    className={`chip ${composer.tag === tag ? 'chip--active' : ''}`}
                    type="button"
                    onClick={() => setComposer((current) => ({ ...current, tag }))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <label className="field">
                <span className="field__label">{text.quickPanel.tagLabel}</span>
                <input
                  className="field__control"
                  value={composer.tag}
                  onChange={(e) => setComposer((current) => ({ ...current, tag: e.target.value }))}
                  placeholder={text.quickPanel.tagPlaceholder}
                />
              </label>
              <button className="button button--accent button--full" type="submit">
                <Plus size={15} /> {text.quickPanel.submit}
              </button>
            </form>
          </section>

          <CollapsibleSection title={language === 'zh' ? 'AI 灵感引擎' : 'AI Idea Engine'} defaultOpen={true}>
            <div className="ai-panel">
              <div className="prompt-card__kicker">
                <Sparkles size={13} />
                {currentPrompt.kicker}
              </div>
              <p className="ai-panel__prompt">{currentPrompt.prompt}</p>
              <div className="prompt-card__status">
                <span className="prompt-card__status-label">{text.promptStatus.label}</span>
                <span>{aiStatusMessage}</span>
              </div>
              <label className="field field--range ai-panel__range">
                <span className="field__label">{text.promptControls.divergenceLabel}</span>
                <div className="range-control">
                  <input
                    className="range-control__input"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={aiDivergence}
                    onChange={(e) => handleAiDivergenceChange(Number(e.target.value))}
                  />
                  <span className="range-control__value">{aiDivergence}%</span>
                </div>
                <div className="range-control__legend">
                  <span>{text.promptControls.focused}</span>
                  <span>{text.promptControls.wild}</span>
                </div>
              </label>
              <div className="stack">
                <button className="button button--ghost button--full" type="button" onClick={() => setPromptIndex((current) => (current + 1) % promptDeck.length)}>
                  <RefreshCw size={14} /> {text.promptActions.rotate}
                </button>
                <button className="button button--secondary button--full" type="button" onClick={handlePinPrompt}>
                  <Plus size={14} /> {text.promptActions.pin}
                </button>
                <button
                  className="button button--accent button--full"
                  type="button"
                  onClick={handleGeneratePack}
                  disabled={aiAssist.loading}
                >
                  <WandSparkles size={14} />
                  {aiAssist.loading ? text.promptActions.generating : text.promptActions.generate}
                </button>
              </div>
            </div>
          </CollapsibleSection>
        </aside>

        <section className="workspace__board" style={{ '--note-font-scale': noteFontScale }}>
          <CollapsibleSection title={`${text.filters.title} · ${text.filters.showing(visibleNotes.length)}`} defaultOpen={false}>
            <div className="filter-layout">
              <div className="segmented">
                <button className={filters.scope === 'active' ? 'is-active' : ''} type="button" onClick={() => setFilters((current) => ({ ...current, scope: 'active' }))}>
                  {text.filters.scopeActive}
                </button>
                <button className={filters.scope === 'archived' ? 'is-active' : ''} type="button" onClick={() => setFilters((current) => ({ ...current, scope: 'archived' }))}>
                  {text.filters.scopeArchived}
                </button>
              </div>
              <label className="field">
                <span className="field__label">{text.filters.searchLabel}</span>
                <input
                  className="field__control"
                  placeholder={text.filters.searchPlaceholder}
                  value={filters.search}
                  onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">{text.filters.sortLabel}</span>
                <select
                  className="field__control"
                  value={filters.sort}
                  onChange={(e) => setFilters((current) => ({ ...current, sort: e.target.value }))}
                >
                  <option value="recent">{text.filters.sortRecent}</option>
                  <option value="votes">{text.filters.sortVotes}</option>
                  <option value="tag">{text.filters.sortTag}</option>
                </select>
              </label>
              <label className="field field--range">
                <span className="field__label">{text.filters.noteSizeLabel}</span>
                <div className="range-control">
                  <input
                    className="range-control__input"
                    type="range"
                    min="0.95"
                    max="1.45"
                    step="0.05"
                    value={noteFontScale}
                    onChange={(e) => handleNoteFontScaleChange(Number(e.target.value))}
                  />
                  <span className="range-control__value">{Math.round(noteFontScale * 100)}%</span>
                </div>
              </label>
            </div>
            <div className="chip-row chip-row--spacious">
              <button className={`chip ${filters.tag === 'all' ? 'chip--active' : ''}`} type="button" onClick={() => setFilters((current) => ({ ...current, tag: 'all' }))}>
                {text.filters.allTags}
              </button>
              {tagOptions.map((tag) => (
                <button key={tag} className={`chip ${filters.tag === tag ? 'chip--active' : ''}`} type="button" onClick={() => setFilters((current) => ({ ...current, tag }))}>
                  {tag}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {visibleNotes.length ? (
            <div className="note-grid">
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  language={language}
                  note={note}
                  onArchiveToggle={handleArchiveToggle}
                  onDelete={handleDeleteNote}
                  onFilterTag={(tag) => setFilters((current) => ({ ...current, scope: 'active', tag: tag || 'all' }))}
                  onPinToggle={handlePinToggle}
                  onSave={handleSaveNote}
                  onVote={handleVote}
                  onWeightChange={handleAiWeightChange}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__eyebrow">{text.empty.eyebrow}</span>
              <h3>{filters.scope === 'archived' ? text.empty.archivedTitle : text.empty.activeTitle}</h3>
              <p>{filters.scope === 'archived' ? text.empty.archivedDescription : text.empty.activeDescription}</p>
            </div>
          )}
        </section>
      </main>

      <div className="bottom-panels">
        <CollapsibleSection title={text.statsTitle} defaultOpen={false}>
          <div className="stats-grid">
            <StatCard label={text.stats.activeLabel} value={activeNotes.length} hint={text.stats.activeHint} />
            <StatCard label={text.stats.archivedLabel} value={archivedNotes.length} hint={text.stats.archivedHint} />
            <StatCard label={text.stats.topVotesLabel} value={activeNotes.reduce((max, note) => Math.max(max, note.votes), 0)} hint={text.stats.topVotesHint} />
            <StatCard label={text.stats.topTagLabel} value={topTag} hint={text.stats.topTagHint} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={text.opsPanel.title} defaultOpen={false}>
          <div className="stack">
            <button className="button button--secondary" type="button" onClick={handleExportBoard}>
              <Download size={15} /> {text.opsPanel.export}
            </button>
            <label className="button button--ghost upload-button" htmlFor={importInputId}>
              <Upload size={15} /> {text.opsPanel.import}
            </label>
            <input id={importInputId} className="sr-only" type="file" accept="application/json" onChange={handleImportBoard} />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

export default App;
