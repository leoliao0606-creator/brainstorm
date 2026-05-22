import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LocateFixed,
  RefreshCw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AiSettingsModal } from './components/AiSettingsModal.jsx';
import { BoardBottomPanels } from './components/BoardBottomPanels.jsx';
import { BoardSidebar } from './components/BoardSidebar.jsx';
import { BoardTopbar } from './components/BoardTopbar.jsx';
import { CollapsibleSection } from './components/CollapsibleSection.jsx';
import { NoteCard } from './components/NoteCard.jsx';
import { ProjectsHome } from './components/ProjectsHome.jsx';
import {
  AI_REVEAL_STEP_MS,
  DEFAULT_AI_DIVERGENCE,
  DEFAULT_AI_SPECIFICITY,
  DEFAULT_NOTE_FONT_SCALE,
  appendNotes,
  computeTopTag,
  createInitialBoard,
  createNote,
  deleteNote,
  getDefaultNotePosition,
  mergeBoards,
  normalizeAiDivergence,
  normalizeAiSpecificity,
  normalizeAiWeight,
  normalizeBoard,
  normalizeDismissedNotes,
  normalizeNoteColor,
  normalizeNoteFingerprint,
  normalizeNoteFontScale,
  normalizeNotePosition,
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
import { fetchAiStatus, requestIdeaGenerationStream } from './lib/aiClient.js';
import {
  loadAiSettings,
  normalizeAiGenerationCount,
  normalizeAiSettings,
  persistAiSettings,
  resolveAiLanguagePreference,
} from './lib/aiSettings.js';
import { createId } from './lib/ids.js';
import {
  getLocale,
  loadLanguage,
  normalizeLanguage,
  persistLanguage,
  remapSuggestedTag,
} from './lib/locale.js';
import { downloadBoard } from './lib/ui.js';
import './App.css';

const UNDO_LIMIT = 20;
const CANVAS_MIN_WIDTH = 3200;
const CANVAS_MIN_HEIGHT = 2200;
const CANVAS_CARD_WIDTH = 286;
const CANVAS_CARD_HEIGHT = 318;
const CANVAS_EDGE_PADDING = 96;
const CANVAS_RUNWAY_MIN = 3200;
const CANVAS_RUNWAY_MAX = 9600;
const DRAG_THRESHOLD = 2;
const CANVAS_ZOOM_DEFAULT = 1;
const CANVAS_ZOOM_MIN = 0.55;
const CANVAS_ZOOM_MAX = 1.65;
const CANVAS_ZOOM_STEP = 0.1;
const CANVAS_ARROW_PAN_STEP = 72;
const TRACKPAD_PAN_SENSITIVITY = 0.28;
const TRACKPAD_WHEEL_DELTA_LIMIT = 220;
const CANVAS_FIT_PADDING = 96;
const CANVAS_INSERT_GAP_X = 30;
const CANVAS_INSERT_GAP_Y = 28;
const CANVAS_INSERT_MARGIN = 18;
const MOUSE_WHEEL_ZOOM_SENSITIVITY = 0.0009;

function isInteractiveNoteTarget(target) {
  return Boolean(
    target?.closest?.('button, input, textarea, select, a, [data-note-no-drag="true"], .note-card__panel, .note-card__menu')
  );
}

function isEditableTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function isLikelyTrackpadWheel(event, deltaX, deltaY) {
  if (event.deltaMode !== 0) return false;
  if (Math.abs(deltaX) > 0) return true;
  if (!Number.isInteger(deltaY)) return true;
  return Math.abs(deltaY) < TRACKPAD_WHEEL_DELTA_LIMIT;
}

function normalizeCanvasZoom(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CANVAS_ZOOM_DEFAULT;
  return Math.max(CANVAS_ZOOM_MIN, Math.min(CANVAS_ZOOM_MAX, Number(parsed.toFixed(2))));
}

function noteRect(position) {
  return {
    x: position.x,
    y: position.y,
    width: CANVAS_CARD_WIDTH,
    height: CANVAS_CARD_HEIGHT,
  };
}

function rectsOverlap(a, b, margin = 0) {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

function snapCanvasPosition(value) {
  return Math.round(value / 8) * 8;
}

function createDefaultAiPromptDraft(language) {
  const locale = getLocale(language);
  const promptCard = locale.promptCards[0];
  return {
    text: '',
    tag: promptCard?.tag ?? locale.tagSuggestions[0],
    lensId: promptCard?.id ?? 'custom',
  };
}

function findPromptCard(locale, lensId) {
  return locale.promptCards.find((card) => card.id === lensId) ?? locale.promptCards[0] ?? null;
}

function App() {
  const [language, setLanguage] = useState(loadLanguage);
  const [projects, setProjects] = useState(() => loadProjects(language));
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [board, setBoard] = useState(null);
  const [composer, setComposer] = useState({ text: '', tag: '' });
  const [aiPromptDraft, setAiPromptDraft] = useState(() => createDefaultAiPromptDraft(language));
  const [sidebarTab, setSidebarTab] = useState('capture');
  const [filters, setFilters] = useState({ scope: 'active', tag: 'all', sort: 'recent', search: '' });
  const [notice, setNotice] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [aiSettings, setAiSettings] = useState(loadAiSettings);
  const [aiSettingsDraft, setAiSettingsDraft] = useState(aiSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const [aiStreamVisible, setAiStreamVisible] = useState(false);
  const [aiStreamText, setAiStreamText] = useState('');
  const [aiConversationPrompt, setAiConversationPrompt] = useState('');
  const [aiAssist, setAiAssist] = useState({
    available: null,
    loading: false,
    model: aiSettings.ollamaModel,
    baseUrl: aiSettings.ollamaBaseUrl,
    installedModels: [],
    reason: 'checking',
  });
  const deferredSearch = useDeferredValue(filters.search);
  const importInputId = useId();
  const lastSerializedRef = useRef('');
  const revealTimersRef = useRef([]);
  const generationRequestRef = useRef(null);
  const activeProjectIdRef = useRef(activeProjectId);
  const canvasViewportRef = useRef(null);
  const dragSessionRef = useRef(null);
  const panSessionRef = useRef(null);
  const canvasZoomRef = useRef(CANVAS_ZOOM_DEFAULT);
  const canvasInitialScrollRef = useRef(null);
  const spacePressedRef = useRef(false);
  const suppressCanvasContextMenuRef = useRef(false);
  const boardSettingUndoRef = useRef({ key: '', at: 0 });
  const [dragPreview, setDragPreview] = useState(null);
  const [canvasZoom, setCanvasZoom] = useState(CANVAS_ZOOM_DEFAULT);
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);

  const locale = getLocale(language);
  const text = locale.text;
  const selectedPromptCard = findPromptCard(locale, aiPromptDraft.lensId);
  const fallbackModelName = aiAssist.model ?? aiSettings.ollamaModel;
  const aiGenerationCount = normalizeAiGenerationCount(aiSettings.generationCount);
  const aiLanguage = resolveAiLanguagePreference(aiSettings.languagePreference, language);

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
  const aiSpecificity = board?.aiSpecificity ?? DEFAULT_AI_SPECIFICITY;
  const noteFontScale = board?.noteFontScale ?? DEFAULT_NOTE_FONT_SCALE;
  const canUndo = undoStack.length > 0;

  const aiStatusMessage = aiAssist.loading
    ? text.promptActions.generating
    : aiStatusLoading
      ? text.promptStatus.checking
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

  function snapshotBoard(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function recordUndo(label, sourceBoard = board) {
    const snapshot = snapshotBoard(sourceBoard);
    if (!snapshot || !activeProjectId) return;

    setUndoStack((current) => [
      { id: createId(), projectId: activeProjectId, label, board: snapshot, createdAt: Date.now() },
      ...current,
    ].slice(0, UNDO_LIMIT));
  }

  function clearUndoStack() {
    setUndoStack([]);
  }

  function recordBoardSettingUndo(key, sourceBoard = board) {
    const stamp = sourceBoard?.updatedAt ?? 0;
    const recent = boardSettingUndoRef.current.key === key && boardSettingUndoRef.current.at === stamp;
    if (!recent) {
      recordUndo(text.undo.boardSetting, sourceBoard);
    }
    boardSettingUndoRef.current = { key, at: stamp };
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

  function handleStopGeneration() {
    if (!generationRequestRef.current) return;
    cancelGeneration();
    setAiStreamText((current) => current ? `${current}\n\n${text.promptStatus.outputStopped}` : text.promptStatus.outputStopped);
    setNotice({ tone: 'info', text: text.notices.aiGenerationStopped });
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

  const canvasLayout = useMemo(() => {
    const bounds = visibleNotes.reduce(
      (acc, note, index) => {
        const position = normalizeNotePosition(note.position, getDefaultNotePosition(index));
        return {
          minX: Math.min(acc.minX, position.x),
          minY: Math.min(acc.minY, position.y),
          maxX: Math.max(acc.maxX, position.x + CANVAS_CARD_WIDTH),
          maxY: Math.max(acc.maxY, position.y + CANVAS_CARD_HEIGHT),
        };
      },
      { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    );
    const runwayX = Math.max(
      CANVAS_RUNWAY_MIN,
      Math.min(CANVAS_RUNWAY_MAX, Math.round((canvasViewportSize.width || CANVAS_RUNWAY_MIN) * 4))
    );
    const runwayY = Math.max(
      CANVAS_RUNWAY_MIN,
      Math.min(CANVAS_RUNWAY_MAX, Math.round((canvasViewportSize.height || CANVAS_RUNWAY_MIN) * 4))
    );
    const contentWidth = Math.max(CANVAS_MIN_WIDTH, bounds.maxX - bounds.minX + CANVAS_EDGE_PADDING * 2);
    const contentHeight = Math.max(CANVAS_MIN_HEIGHT, bounds.maxY - bounds.minY + CANVAS_EDGE_PADDING * 2);

    return {
      width: contentWidth + runwayX * 2,
      height: contentHeight + runwayY * 2,
      originX: runwayX - bounds.minX + CANVAS_EDGE_PADDING,
      originY: runwayY - bounds.minY + CANVAS_EDGE_PADDING,
      bounds,
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
    };
  }, [canvasViewportSize.height, canvasViewportSize.width, visibleNotes]);

  const applyIncomingBoard = useEffectEvent((serializedBoard) => {
    if (!serializedBoard || serializedBoard === lastSerializedRef.current) return;
    try {
      const nextBoard = normalizeBoard(JSON.parse(serializedBoard), language);
      lastSerializedRef.current = serializedBoard;
      setBoard((current) => {
        if (!current || nextBoard.updatedAt >= current.updatedAt) return nextBoard;
        return mergeBoards(current, nextBoard, language);
      });
      clearUndoStack();
      setNotice({ tone: 'info', text: board && nextBoard.updatedAt < board.updatedAt ? text.notices.syncMerged : text.notices.sync });
    } catch {
      setNotice({ tone: 'error', text: text.notices.syncInvalid });
    }
  });

  const handleBoardReset = useEffectEvent(() => {
    cancelGeneration();
    setBoard(createInitialBoard(language));
    clearUndoStack();
    setNotice({ tone: 'info', text: text.notices.syncReset });
  });

  const syncAiStatus = useCallback(async (settingsOverride) => {
    const runtimeSettings = normalizeAiSettings(settingsOverride);
    setAiStatusLoading(true);
    try {
      const { ok, payload } = await fetchAiStatus(runtimeSettings);
      if (!ok) {
        setAiAssist((current) => ({
          ...current,
          available: false,
          loading: false,
          model: payload.model ?? runtimeSettings.ollamaModel,
          baseUrl: payload.baseUrl ?? runtimeSettings.ollamaBaseUrl,
          installedModels: payload.installedModels ?? current.installedModels,
          reason: payload.reason ?? 'connection_failed',
        }));
        return;
      }
      setAiAssist((current) => ({
        ...current,
        available: payload.available,
        loading: false,
        model: payload.model ?? runtimeSettings.ollamaModel,
        baseUrl: payload.baseUrl ?? runtimeSettings.ollamaBaseUrl,
        installedModels: payload.installedModels ?? [],
        reason: payload.reason ?? (payload.available ? 'ready' : 'model_missing'),
      }));
    } catch {
      setAiAssist((current) => ({
        ...current,
        available: false,
        loading: false,
        model: runtimeSettings.ollamaModel,
        baseUrl: runtimeSettings.ollamaBaseUrl,
        reason: 'connection_failed',
      }));
    } finally {
      setAiStatusLoading(false);
    }
  }, []);

  function notifyStorageFailure() {
    setNotice({ tone: 'error', text: text.notices.saveFailed });
  }

  function persistBoardOrNotify(projectId, serialized) {
    if (!persistBoardById(projectId, serialized)) {
      notifyStorageFailure();
      return false;
    }
    return true;
  }

  function persistProjectsOrNotify(nextProjects) {
    if (!persistProjects(nextProjects)) {
      notifyStorageFailure();
      return false;
    }
    return true;
  }

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    canvasZoomRef.current = canvasZoom;
  }, [canvasZoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleSpaceKeyDown(event) {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return;
      spacePressedRef.current = true;
      setIsSpacePanning(true);
    }

    function handleSpaceKeyUp(event) {
      if (event.code !== 'Space') return;
      spacePressedRef.current = false;
      setIsSpacePanning(false);
    }

    function releaseSpacePan() {
      spacePressedRef.current = false;
      setIsSpacePanning(false);
    }

    window.addEventListener('keydown', handleSpaceKeyDown);
    window.addEventListener('keyup', handleSpaceKeyUp);
    window.addEventListener('blur', releaseSpacePan);
    return () => {
      window.removeEventListener('keydown', handleSpaceKeyDown);
      window.removeEventListener('keyup', handleSpaceKeyUp);
      window.removeEventListener('blur', releaseSpacePan);
    };
  }, []);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || typeof window === 'undefined') return undefined;

    function syncCanvasViewportSize() {
      setCanvasViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    }

    syncCanvasViewportSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(syncCanvasViewportSize);
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', syncCanvasViewportSize);
    return () => window.removeEventListener('resize', syncCanvasViewportSize);
  }, [activeProjectId, visibleNotes.length]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!activeProjectId || !viewport || !visibleNotes.length) return;
    if (canvasInitialScrollRef.current === activeProjectId) return;
    canvasInitialScrollRef.current = activeProjectId;

    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, canvasLayout.originX * canvasZoomRef.current - 36);
      viewport.scrollTop = Math.max(0, canvasLayout.originY * canvasZoomRef.current - 36);
    });
  }, [activeProjectId, canvasLayout.originX, canvasLayout.originY, visibleNotes.length]);

  useEffect(() => {
    if (!activeProjectId || !board) return;
    const serialized = JSON.stringify(board);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    if (!persistBoardById(activeProjectId, serialized)) {
      window.setTimeout(() => setNotice({ tone: 'error', text: text.notices.saveFailed }), 0);
    }
    const noteCount = board.notes.filter((n) => !n.archived).length;
    const topTagVal = computeTopTag(board.notes);
    setProjects((prev) => {
      const updated = prev.map((project) =>
        project.id === activeProjectId
          ? { ...project, title: board.title, updatedAt: board.updatedAt, noteCount, topTag: topTagVal }
          : project
      );
      if (!persistProjects(updated)) {
        window.setTimeout(() => setNotice({ tone: 'error', text: text.notices.saveFailed }), 0);
      }
      return updated;
    });
  }, [board, activeProjectId, text.notices.saveFailed]);

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
    const timer = window.setTimeout(() => syncAiStatus(aiSettings), 0);
    return () => window.clearTimeout(timer);
  }, [aiSettings, syncAiStatus]);

  function handleEnterProject(projectId) {
    cancelGeneration();
    const nextBoard = loadBoardById(projectId, language);
    activeProjectIdRef.current = projectId;
    lastSerializedRef.current = '';
    canvasInitialScrollRef.current = null;
    setBoard(nextBoard);
    setActiveProjectId(projectId);
    setFilters({ scope: 'active', tag: 'all', sort: 'recent', search: '' });
    setComposer({ text: '', tag: locale.tagSuggestions[0] });
    setAiPromptDraft(createDefaultAiPromptDraft(language));
    clearUndoStack();
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
      aiSpecificity: DEFAULT_AI_SPECIFICITY,
      noteFontScale: DEFAULT_NOTE_FONT_SCALE,
      dismissedNotes: [],
      notes: [],
      updatedAt: now,
    };
    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    persistProjectsOrNotify(updatedProjects);
    persistBoardOrNotify(projectId, JSON.stringify(newBoard));
    clearUndoStack();
    handleEnterProject(projectId);
  }

  function handleDeleteProject(projectId) {
    if (activeProjectId === projectId) {
      cancelGeneration();
    }
    const updated = projects.filter((project) => project.id !== projectId);
    setProjects(updated);
    persistProjectsOrNotify(updated);
    if (!removeBoardById(projectId)) notifyStorageFailure();
    if (activeProjectId === projectId) {
      activeProjectIdRef.current = null;
      canvasInitialScrollRef.current = null;
      setActiveProjectId(null);
      setBoard(null);
      clearUndoStack();
    }
  }

  function handleBackToHome() {
    cancelGeneration();
    activeProjectIdRef.current = null;
    canvasInitialScrollRef.current = null;
    setActiveProjectId(null);
    setBoard(null);
    lastSerializedRef.current = '';
    clearUndoStack();
  }

  function handleLanguageChange(nextLanguage) {
    const normalized = normalizeLanguage(nextLanguage);
    if (normalized === language) return;
    if (!persistLanguage(normalized)) notifyStorageFailure();
    setLanguage(normalized);
    setComposer((current) => ({ ...current, tag: remapSuggestedTag(current.tag, language, normalized) }));
    setAiPromptDraft((current) => {
      const nextLocale = getLocale(normalized);
      const nextPromptCard = findPromptCard(nextLocale, current.lensId);
      return {
        ...current,
        tag: remapSuggestedTag(current.tag, language, normalized) || nextPromptCard?.tag || nextLocale.tagSuggestions[0],
      };
    });
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

  function handleOpenAiSettings() {
    setAiSettingsDraft(aiSettings);
    setSettingsOpen(true);
    syncAiStatus(aiSettings);
  }

  const handleCloseAiSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  function handleSaveAiSettings() {
    const nextSettings = normalizeAiSettings(aiSettingsDraft);
    const saved = persistAiSettings(nextSettings);
    setAiSettings(nextSettings);
    setAiSettingsDraft(nextSettings);
    setSettingsOpen(false);
    setNotice({ tone: saved ? 'success' : 'error', text: saved ? text.notices.aiSettingsSaved : text.notices.saveFailed });
  }

  function handleRefreshAiStatus(settingsOverride = aiSettingsDraft) {
    const normalized = normalizeAiSettings(settingsOverride);
    setAiSettingsDraft(normalized);
    syncAiStatus(normalized);
  }

  function handleUndo() {
    const [entry, ...rest] = undoStack;
    if (!entry) {
      setNotice({ tone: 'info', text: text.undo.empty });
      return;
    }

    cancelGeneration();
    activeProjectIdRef.current = entry.projectId;
    setUndoStack(rest);
    setBoard(entry.board);
    setNotice({ tone: 'info', text: text.notices.undone(entry.label) });
  }

  function handleBoardField(field, value, fallback) {
    setBoard((current) => touchBoard({ ...current, [field]: value.trim() || fallback }));
  }

  function getCanvasPoint(event) {
    const viewport = canvasViewportRef.current;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    const zoom = canvasZoomRef.current;
    return {
      x: (event.clientX - rect.left + viewport.scrollLeft) / zoom - canvasLayout.originX,
      y: (event.clientY - rect.top + viewport.scrollTop) / zoom - canvasLayout.originY,
    };
  }

  function getCanvasInsertionPositions(sourceBoard, count = 1) {
    const total = Math.max(1, Math.round(Number(count) || 1));
    const viewport = canvasViewportRef.current;
    const notes = sourceBoard?.notes ?? [];
    const occupiedRects = notes
      .filter((note) => !note.archived)
      .map((note, index) => noteRect(normalizeNotePosition(note.position, getDefaultNotePosition(index))));
    const positions = [];

    function accepts(position) {
      const candidateRect = noteRect(position);
      return ![...occupiedRects, ...positions.map(noteRect)].some((rect) =>
        rectsOverlap(candidateRect, rect, CANVAS_INSERT_MARGIN)
      );
    }

    if (!viewport) {
      let fallbackIndex = notes.length;
      while (positions.length < total && fallbackIndex < notes.length + total + 80) {
        const position = normalizeNotePosition(getDefaultNotePosition(fallbackIndex));
        if (accepts(position)) positions.push(position);
        fallbackIndex += 1;
      }
      return positions.length ? positions : Array.from({ length: total }, (_, index) => getDefaultNotePosition(notes.length + index));
    }

    const zoom = canvasZoomRef.current;
    const visibleLeft = viewport.scrollLeft / zoom - canvasLayout.originX;
    const visibleTop = viewport.scrollTop / zoom - canvasLayout.originY;
    const visibleWidth = viewport.clientWidth / zoom;
    const visibleHeight = viewport.clientHeight / zoom;
    const stepX = CANVAS_CARD_WIDTH + CANVAS_INSERT_GAP_X;
    const stepY = CANVAS_CARD_HEIGHT + CANVAS_INSERT_GAP_Y;
    const usableWidth = Math.max(CANVAS_CARD_WIDTH, visibleWidth - 96);
    const columns = Math.max(1, Math.min(4, Math.floor((usableWidth + CANVAS_INSERT_GAP_X) / stepX)));
    const clusterWidth = columns * CANVAS_CARD_WIDTH + (columns - 1) * CANVAS_INSERT_GAP_X;
    const startX = snapCanvasPosition(visibleLeft + Math.max(44, (visibleWidth - clusterWidth) / 2));
    const startY = snapCanvasPosition(visibleTop + Math.max(44, Math.min(72, visibleHeight * 0.12)));

    for (let row = 0; positions.length < total && row < 80; row += 1) {
      for (let column = 0; positions.length < total && column < columns; column += 1) {
        const candidate = normalizeNotePosition({
          x: startX + column * stepX,
          y: startY + row * stepY,
        }, getDefaultNotePosition(notes.length + positions.length));
        if (accepts(candidate)) positions.push(candidate);
      }
    }

    return positions;
  }

  function getCanvasInsertionPosition(sourceBoard) {
    return getCanvasInsertionPositions(sourceBoard, 1)[0] ?? getDefaultNotePosition(sourceBoard?.notes?.length ?? 0);
  }

  function zoomCanvasTo(nextZoom, focalPoint) {
    const normalizedZoom = normalizeCanvasZoom(nextZoom);
    const currentZoom = canvasZoomRef.current;
    if (normalizedZoom === currentZoom) return;

    const viewport = canvasViewportRef.current;
    if (!viewport) {
      canvasZoomRef.current = normalizedZoom;
      setCanvasZoom(normalizedZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const anchorX = focalPoint ? focalPoint.clientX - rect.left : viewport.clientWidth / 2;
    const anchorY = focalPoint ? focalPoint.clientY - rect.top : viewport.clientHeight / 2;
    const canvasX = (viewport.scrollLeft + anchorX) / currentZoom;
    const canvasY = (viewport.scrollTop + anchorY) / currentZoom;

    canvasZoomRef.current = normalizedZoom;
    setCanvasZoom(normalizedZoom);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, canvasX * normalizedZoom - anchorX);
        viewport.scrollTop = Math.max(0, canvasY * normalizedZoom - anchorY);
      });
    }
  }

  function centerCanvasView() {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const boundsWidth = Math.max(CANVAS_CARD_WIDTH, canvasLayout.bounds.maxX - canvasLayout.bounds.minX);
    const boundsHeight = Math.max(CANVAS_CARD_HEIGHT, canvasLayout.bounds.maxY - canvasLayout.bounds.minY);
    const availableWidth = Math.max(1, viewport.clientWidth - CANVAS_FIT_PADDING * 2);
    const availableHeight = Math.max(1, viewport.clientHeight - CANVAS_FIT_PADDING * 2);
    const fitZoom = normalizeCanvasZoom(Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight));
    const centerX = (canvasLayout.centerX + canvasLayout.originX) * fitZoom;
    const centerY = (canvasLayout.centerY + canvasLayout.originY) * fitZoom;

    canvasZoomRef.current = fitZoom;
    setCanvasZoom(fitZoom);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, centerX - viewport.clientWidth / 2);
        viewport.scrollTop = Math.max(0, centerY - viewport.clientHeight / 2);
        viewport.focus({ preventScroll: true });
      });
      return;
    }

    viewport.scrollLeft = Math.max(0, centerX - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, centerY - viewport.clientHeight / 2);
    viewport.focus({ preventScroll: true });
  }

  function handleCanvasWheel(event) {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    const deltaUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    const deltaX = event.deltaX * deltaUnit;
    const deltaY = event.deltaY * deltaUnit;
    const shouldZoom = event.ctrlKey || event.metaKey || (!event.shiftKey && !isLikelyTrackpadWheel(event, deltaX, deltaY));

    if (shouldZoom) {
      const zoomDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
      const zoomFactor = Math.exp(-zoomDelta * MOUSE_WHEEL_ZOOM_SENSITIVITY);
      zoomCanvasTo(canvasZoomRef.current * zoomFactor, event);
      return;
    }

    const isTrackpadPan = isLikelyTrackpadWheel(event, deltaX, deltaY);
    const panSensitivity = isTrackpadPan ? TRACKPAD_PAN_SENSITIVITY : 1;
    const horizontalDelta = (event.shiftKey && Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX) * panSensitivity;
    const verticalDelta = (event.shiftKey && Math.abs(deltaY) > Math.abs(deltaX) ? 0 : deltaY) * panSensitivity;
    viewport.scrollLeft += horizontalDelta;
    viewport.scrollTop += verticalDelta;
  }

  function handleCanvasKeyDown(event) {
    const viewport = canvasViewportRef.current;
    if (!viewport || isEditableTarget(event.target)) return;

    const key = event.key;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && (key === '+' || key === '=')) {
      event.preventDefault();
      zoomCanvasTo(canvasZoomRef.current + CANVAS_ZOOM_STEP);
      return;
    }
    if (modifier && key === '-') {
      event.preventDefault();
      zoomCanvasTo(canvasZoomRef.current - CANVAS_ZOOM_STEP);
      return;
    }
    if (modifier && key === '0') {
      event.preventDefault();
      zoomCanvasTo(CANVAS_ZOOM_DEFAULT);
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      return;
    }
    if (key === 'Home' && !modifier) {
      event.preventDefault();
      centerCanvasView();
      return;
    }

    const panByKey = {
      ArrowUp: [0, -CANVAS_ARROW_PAN_STEP],
      ArrowDown: [0, CANVAS_ARROW_PAN_STEP],
      ArrowLeft: [-CANVAS_ARROW_PAN_STEP, 0],
      ArrowRight: [CANVAS_ARROW_PAN_STEP, 0],
    }[key];
    if (!panByKey || modifier) return;

    event.preventDefault();
    viewport.scrollLeft += panByKey[0] * (event.shiftKey ? 3 : 1);
    viewport.scrollTop += panByKey[1] * (event.shiftKey ? 3 : 1);
  }

  function handleCanvasPointerDown(event) {
    const isMouse = event.pointerType === 'mouse';
    const panButton = !isMouse || event.button === 0 || event.button === 1 || event.button === 2;
    if (!panButton) return;

    const overNote = event.target.closest?.('.note-card');
    const overToolbar = event.target.closest?.('.note-canvas-toolbar');
    const forcePanOverObjects = isMouse && (event.button === 1 || event.button === 2 || spacePressedRef.current);
    if (overToolbar || (overNote && !forcePanOverObjects)) return;

    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    viewport.focus({ preventScroll: true });

    panSessionRef.current = {
      pointerId: event.pointerId,
      button: event.button,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      moved: false,
    };
    setIsCanvasPanning(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (event.button === 1 || spacePressedRef.current) {
      event.preventDefault();
    }
  }

  function handleCanvasPointerMove(event) {
    const session = panSessionRef.current;
    const viewport = canvasViewportRef.current;
    if (!session || !viewport || session.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - session.startClientX;
    const deltaY = event.clientY - session.startClientY;
    const moved = session.moved || Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD;

    if (moved) {
      viewport.scrollLeft = session.startScrollLeft - deltaX;
      viewport.scrollTop = session.startScrollTop - deltaY;
      event.preventDefault();
    }

    if (moved !== session.moved) {
      setIsCanvasPanning(true);
    }
    panSessionRef.current = { ...session, moved };
  }

  function endCanvasPan(event) {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressCanvasContextMenuRef.current = session.button === 2 && session.moved;
    panSessionRef.current = null;
    setIsCanvasPanning(false);
  }

  function handleCanvasContextMenu(event) {
    if (!suppressCanvasContextMenuRef.current) return;
    event.preventDefault();
    suppressCanvasContextMenuRef.current = false;
  }

  function handleNotePointerDown(event, note, index) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (spacePressedRef.current) return;
    if (isInteractiveNoteTarget(event.target)) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    const position = normalizeNotePosition(note.position, getDefaultNotePosition(index));
    dragSessionRef.current = {
      pointerId: event.pointerId,
      noteId: note.id,
      startPoint: point,
      startPosition: position,
      latestPosition: position,
      moved: false,
      undoBoard: snapshotBoard(board),
    };
    setDragPreview({ noteId: note.id, position, moved: false });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleNotePointerMove(event) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    const deltaX = point.x - session.startPoint.x;
    const deltaY = point.y - session.startPoint.y;
    const moved = session.moved || Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD;
    const position = normalizeNotePosition({
      x: session.startPosition.x + deltaX,
      y: session.startPosition.y + deltaY,
    }, session.startPosition);

    dragSessionRef.current = { ...session, latestPosition: position, moved };
    setDragPreview({ noteId: session.noteId, position, moved });
    if (moved) event.preventDefault();
  }

  function handleNotePointerEnd(event) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragSessionRef.current = null;
    setDragPreview(null);

    if (!session.moved) return;

    recordUndo(text.undo.move, session.undoBoard);
    setBoard((current) => (
      current
        ? patchNote(current, session.noteId, () => ({ position: session.latestPosition }))
        : current
    ));
  }

  function handleNotePointerCancel(event) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragSessionRef.current = null;
    setDragPreview(null);
  }

  function handleAddNote(event) {
    event.preventDefault();
    const idea = composer.text.trim();
    if (!idea || !board) return;
    const note = createNote({
      text: idea,
      tag: composer.tag,
      author: board.owner,
      fallbackAuthor: locale.defaults.owner,
      position: getCanvasInsertionPosition(board),
    });
    recordUndo(text.undo.add, board);
    setBoard((current) => appendNotes(current, [note]));
    setComposer((current) => ({ ...current, text: '' }));
    setNotice({ tone: 'success', text: text.notices.added });
  }

  async function handleGeneratePack() {
    const currentBoard = board;
    const requestProjectId = activeProjectId;
    if (!currentBoard || !requestProjectId) return;
    const promptCard = selectedPromptCard ?? findPromptCard(locale, aiPromptDraft.lensId);
    const customPrompt = aiPromptDraft.text.trim();
    const effectivePrompt = customPrompt || promptCard?.prompt || '';
    const promptTitle = promptCard?.title ?? text.aiPanel.customPromptTitle;
    const customTag = aiPromptDraft.tag.trim() || promptCard?.tag || locale.tagSuggestions[0];
    if (!effectivePrompt) {
      setNotice({ tone: 'info', text: text.notices.aiPromptRequired });
      setSidebarTab('ai');
      return;
    }

    cancelGeneration({ resetLoading: false });
    recordUndo(text.undo.generate, currentBoard);
    const token = Symbol('ai-generation');
    const controller = new AbortController();
    const currentAiDivergence = currentBoard.aiDivergence ?? DEFAULT_AI_DIVERGENCE;
    const currentAiSpecificity = currentBoard.aiSpecificity ?? DEFAULT_AI_SPECIFICITY;
    const currentActiveNotes = currentBoard.notes.filter((note) => !note.archived);
    const currentAiContextNotes = currentAiDivergence >= 100 ? [] : selectAiContextNotes(currentActiveNotes);
    const activeFingerprints = new Set(
      currentActiveNotes.map((note) => normalizeNoteFingerprint(note.text)).filter(Boolean)
    );
    const dismissedNotes = normalizeDismissedNotes(currentBoard.dismissedNotes).filter(
      (entry) => !activeFingerprints.has(normalizeNoteFingerprint(entry))
    );
    const placeholderPositions = getCanvasInsertionPositions(currentBoard, aiGenerationCount);
    const placeholderNotes = Array.from({ length: aiGenerationCount }, (_, generationIndex) =>
      createNote({
        text: text.noteCard.generating,
        tag: customTag,
        author: text.authors.ideaEngine,
        source: 'ai',
        fallbackAuthor: locale.defaults.owner,
        generationState: 'generating',
        generationIndex,
        position: placeholderPositions[generationIndex],
      })
    );
    const placeholderIds = placeholderNotes.map((note) => note.id);
    generationRequestRef.current = { token, projectId: requestProjectId, controller, placeholderIds };

    setBoard((current) => (current ? appendNotes(current, placeholderNotes) : current));
    setAiAssist((current) => ({ ...current, loading: true, reason: current.available === null ? 'checking' : current.reason }));
    setAiStreamVisible(true);
    setAiStreamText('');
    setAiConversationPrompt('');

    try {
      const { ok, payload } = await requestIdeaGenerationStream({
        ollamaBaseUrl: aiSettings.ollamaBaseUrl,
        ollamaModel: aiSettings.ollamaModel,
        generationCount: aiGenerationCount,
        language: aiLanguage,
        topic: currentBoard.title,
        prompt: {
          id: promptCard?.id ?? 'custom',
          title: customPrompt ? `${promptTitle} + ${text.aiPanel.customPromptTitle}` : promptTitle,
          prompt: effectivePrompt,
          tag: customTag,
        },
        aiDivergence: currentAiDivergence,
        aiSpecificity: currentAiSpecificity,
        existingNotes: currentAiContextNotes.map((note) => ({
          text: note.text,
          tag: note.tag,
          aiWeight: note.aiWeight,
        })),
        dismissedNotes,
      }, {
        signal: controller.signal,
        onEvent: (event) => {
          if (!isCurrentGeneration(token, requestProjectId)) return;
          if (event.type === 'meta' && event.finalPrompt) {
            setAiConversationPrompt(event.finalPrompt);
          }
          if (event.type === 'chunk' && event.content) {
            setAiStreamText((current) => `${current}${event.content}`);
          }
        },
      });

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
        .slice(0, aiGenerationCount);
      if (payload.rawContent) {
        setAiStreamText(payload.rawContent);
      }
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
              tag: customTag,
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
        setAiAssist((current) => ({
          ...current,
          available: true,
          loading: false,
          model: modelName,
          baseUrl: payload.baseUrl ?? aiSettings.ollamaBaseUrl,
          reason: 'ready',
        }));
        setNotice({ tone: 'success', text: text.notices.generated(modelName, generatedNotes.length) });
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
        baseUrl: aiSettings.ollamaBaseUrl,
        reason,
      }));
      setNotice({ tone: 'error', text: message });
    }
  }

  function handlePinPrompt() {
    if (!board) return;
    const promptCard = selectedPromptCard ?? findPromptCard(locale, aiPromptDraft.lensId);
    const customPrompt = aiPromptDraft.text.trim();
    const effectivePrompt = customPrompt || promptCard?.prompt || '';
    const customTag = aiPromptDraft.tag.trim() || promptCard?.tag || locale.tagSuggestions[0];
    if (!effectivePrompt) {
      setNotice({ tone: 'info', text: text.notices.aiPromptRequired });
      setSidebarTab('ai');
      return;
    }
    const note = createNote({
      text: effectivePrompt,
      tag: customTag,
      author: text.authors.promptHost,
      pinned: true,
      source: 'prompt',
      fallbackAuthor: locale.defaults.owner,
      position: getCanvasInsertionPosition(board),
    });
    recordUndo(text.undo.prompt, board);
    setBoard((current) => appendNotes(current, [note]));
    setNotice({ tone: 'success', text: text.notices.promptPinned });
  }

  function handleVote(noteId, delta = 1) {
    if (board?.notes.some((note) => note.id === noteId)) {
      recordUndo(text.undo.vote, board);
    }
    setBoard((current) => patchNote(current, noteId, (note) => ({ votes: Math.max(0, note.votes + delta) })));
  }

  function handleAiWeightChange(noteId, aiWeight) {
    if (board?.notes.some((note) => note.id === noteId)) {
      recordUndo(text.undo.weight, board);
    }
    setBoard((current) => patchNote(current, noteId, () => ({ aiWeight: normalizeAiWeight(aiWeight) })));
  }

  function handleNoteColorChange(noteId, color) {
    if (board?.notes.some((note) => note.id === noteId)) {
      recordUndo(text.undo.color, board);
    }
    setBoard((current) => patchNote(current, noteId, () => ({ color: normalizeNoteColor(color) })));
  }

  function handleAiDivergenceChange(nextValue) {
    if (board) recordBoardSettingUndo('aiDivergence', board);
    setBoard((current) => {
      if (!current) return current;
      return touchBoard({ ...current, aiDivergence: normalizeAiDivergence(nextValue) });
    });
  }

  function handleAiSpecificityChange(nextValue) {
    if (board) recordBoardSettingUndo('aiSpecificity', board);
    setBoard((current) => {
      if (!current) return current;
      return touchBoard({ ...current, aiSpecificity: normalizeAiSpecificity(nextValue) });
    });
  }

  function handleNoteFontScaleChange(nextValue) {
    if (board) recordBoardSettingUndo('noteFontScale', board);
    setBoard((current) => {
      if (!current) return current;
      return touchBoard({ ...current, noteFontScale: normalizeNoteFontScale(nextValue) });
    });
  }

  function handleArchiveToggle(noteId) {
    if (!board) return;
    const target = board.notes.find((note) => note.id === noteId);
    if (!target) return;
    recordUndo(target.archived ? text.undo.restore : text.undo.archive, board);
    setBoard(patchNote(board, noteId, (note) => ({ archived: !note.archived })));
    setNotice({
      tone: 'success',
      text: target.archived ? text.notices.restored : text.notices.archived,
      action: 'undo',
    });
  }

  function handlePinToggle(noteId) {
    const target = board?.notes.find((note) => note.id === noteId);
    if (target) {
      recordUndo(target.pinned ? text.undo.unpin : text.undo.pin, board);
    }
    setBoard((current) => patchNote(current, noteId, (note) => ({ pinned: !note.pinned })));
  }

  function handleSaveNote(noteId, updates, options = {}) {
    const target = board?.notes.find((note) => note.id === noteId);
    if (target && (target.text !== updates.text || target.tag !== updates.tag)) {
      recordUndo(text.undo.edit, board);
    }
    setBoard((current) => patchNote(current, noteId, () => ({ text: updates.text, tag: updates.tag })));
    if (!options.silent) {
      setNotice({ tone: 'success', text: text.notices.saved });
    }
  }

  function handleDeleteNote(noteId) {
    if (!board || !board.notes.some((note) => note.id === noteId)) return;
    recordUndo(text.undo.delete, board);
    setBoard(deleteNote(board, noteId));
    setNotice({ tone: 'success', text: text.notices.deleted, action: 'undo' });
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
      const previousBoard = normalizeBoard(board, language, { dropGeneratingNotes: true });
      cancelGeneration({ removePlaceholders: false });
      recordUndo(text.undo.import, previousBoard);
      startTransition(() => {
        setBoard(imported);
        setNotice({ tone: 'success', text: text.notices.imported, action: 'undo' });
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

      <BoardTopbar
        language={language}
        locale={locale}
        text={text}
        board={board}
        canUndo={canUndo}
        onBack={handleBackToHome}
        onBoardField={handleBoardField}
        onLanguageChange={handleLanguageChange}
        onUndo={handleUndo}
      />

      {notice ? (
        <div className={`notice notice--${notice.tone}`}>
          <span>{notice.text}</span>
          {notice.action === 'undo' && canUndo ? (
            <button className="notice__action" type="button" onClick={handleUndo}>
              <Undo2 size={13} /> {text.undo.button}
            </button>
          ) : null}
        </div>
      ) : null}

      {settingsOpen ? (
        <AiSettingsModal
          language={language}
          draft={aiSettingsDraft}
          installedModels={aiAssist.installedModels}
          loading={aiStatusLoading}
          statusMessage={aiStatusMessage}
          onClose={handleCloseAiSettings}
          onDraftChange={setAiSettingsDraft}
          onRefresh={handleRefreshAiStatus}
          onSave={handleSaveAiSettings}
        />
      ) : null}

      <main className="workspace">
        <BoardSidebar
          aiAssist={aiAssist}
          aiConversationPrompt={aiConversationPrompt}
          aiDivergence={aiDivergence}
          aiGenerationCount={aiGenerationCount}
          aiPromptDraft={aiPromptDraft}
          aiSpecificity={aiSpecificity}
          aiStatusMessage={aiStatusMessage}
          aiStreamText={aiStreamText}
          aiStreamVisible={aiStreamVisible}
          composer={composer}
          locale={locale}
          selectedPromptCard={selectedPromptCard}
          setAiPromptDraft={setAiPromptDraft}
          setAiStreamVisible={setAiStreamVisible}
          setComposer={setComposer}
          setSidebarTab={setSidebarTab}
          sidebarTab={sidebarTab}
          text={text}
          onAddNote={handleAddNote}
          onAiDivergenceChange={handleAiDivergenceChange}
          onAiSpecificityChange={handleAiSpecificityChange}
          onGeneratePack={handleGeneratePack}
          onOpenAiSettings={handleOpenAiSettings}
          onPinPrompt={handlePinPrompt}
          onStopGeneration={handleStopGeneration}
        />

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
            <div className="note-canvas-frame">
              <div
                ref={canvasViewportRef}
                className={`note-canvas-shell${isCanvasPanning ? ' note-canvas-shell--panning' : ''}${isSpacePanning ? ' note-canvas-shell--space-pan' : ''}`}
                role="region"
                aria-label={text.boardCanvasLabel}
                tabIndex={0}
                onContextMenu={handleCanvasContextMenu}
                onKeyDown={handleCanvasKeyDown}
                onPointerCancel={endCanvasPan}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={endCanvasPan}
                onWheel={handleCanvasWheel}
              >
                <div
                  className="note-canvas-scaler"
                  style={{
                    width: Math.round(canvasLayout.width * canvasZoom),
                    height: Math.round(canvasLayout.height * canvasZoom),
                  }}
                >
                  <div
                    className="note-canvas"
                    style={{
                      width: canvasLayout.width,
                      height: canvasLayout.height,
                      transform: `scale(${canvasZoom})`,
                    }}
                  >
                    {visibleNotes.map((note, index) => {
                      const savedPosition = normalizeNotePosition(note.position, getDefaultNotePosition(index));
                      const activePosition = dragPreview?.noteId === note.id ? dragPreview.position : savedPosition;
                      const isDragging = dragPreview?.noteId === note.id && dragPreview.moved;

                      return (
                        <div
                          key={note.id}
                          className={`note-canvas__item${isDragging ? ' note-canvas__item--dragging' : ''}`}
                          style={{
                            transform: `translate(${activePosition.x + canvasLayout.originX}px, ${activePosition.y + canvasLayout.originY}px)`,
                            zIndex: dragPreview?.noteId === note.id ? 1000 : visibleNotes.length - index,
                          }}
                        >
                          <NoteCard
                            language={language}
                            note={note}
                            isDragging={isDragging}
                            onArchiveToggle={handleArchiveToggle}
                            onDelete={handleDeleteNote}
                            onDragPointerCancel={handleNotePointerCancel}
                            onDragPointerDown={(event) => handleNotePointerDown(event, note, index)}
                            onDragPointerMove={handleNotePointerMove}
                            onDragPointerUp={handleNotePointerEnd}
                            onFilterTag={(tag) => setFilters((current) => ({ ...current, scope: 'active', tag: tag || 'all' }))}
                            onColorChange={handleNoteColorChange}
                            onPinToggle={handlePinToggle}
                            onSave={handleSaveNote}
                            onVote={handleVote}
                            onWeightChange={handleAiWeightChange}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="note-canvas-toolbar" data-note-no-drag="true" aria-label={text.canvasZoom.label}>
                <button
                  className="note-canvas-toolbar__button"
                  type="button"
                  onClick={centerCanvasView}
                  aria-label={text.canvasZoom.center}
                  title={text.canvasZoom.center}
                >
                  <LocateFixed size={16} />
                </button>
                <button
                  className="note-canvas-toolbar__button"
                  type="button"
                  onClick={() => zoomCanvasTo(canvasZoom - CANVAS_ZOOM_STEP)}
                  disabled={canvasZoom <= CANVAS_ZOOM_MIN}
                  aria-label={text.canvasZoom.zoomOut}
                  title={text.canvasZoom.zoomOut}
                >
                  <ZoomOut size={16} />
                </button>
                <span className="note-canvas-toolbar__value">{Math.round(canvasZoom * 100)}%</span>
                <button
                  className="note-canvas-toolbar__button"
                  type="button"
                  onClick={() => zoomCanvasTo(canvasZoom + CANVAS_ZOOM_STEP)}
                  disabled={canvasZoom >= CANVAS_ZOOM_MAX}
                  aria-label={text.canvasZoom.zoomIn}
                  title={text.canvasZoom.zoomIn}
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  className="note-canvas-toolbar__button"
                  type="button"
                  onClick={() => zoomCanvasTo(CANVAS_ZOOM_DEFAULT)}
                  disabled={canvasZoom === CANVAS_ZOOM_DEFAULT}
                  aria-label={text.canvasZoom.reset}
                  title={text.canvasZoom.reset}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
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

      <BoardBottomPanels
        activeNotes={activeNotes}
        archivedNotes={archivedNotes}
        importInputId={importInputId}
        text={text}
        topTag={topTag}
        onExport={handleExportBoard}
        onImport={handleImportBoard}
      />
    </div>
  );
}

export default App;
