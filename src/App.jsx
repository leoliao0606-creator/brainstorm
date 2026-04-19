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
  Archive,
  ArchiveRestore,
  Check,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Vote,
  WandSparkles,
  X,
} from 'lucide-react';
import './App.css';

const STORAGE_KEY = 'brainstorm:studio:v2';
const DEFAULT_TITLE = '新产品头脑风暴';
const DEFAULT_OWNER = '主持人';
const TAG_SUGGESTIONS = ['产品', '增长', '体验', '技术', '运营', '商业'];
const CLOCK_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});
const NOTE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const PROMPT_DECK = [
  {
    id: 'first-minute',
    kicker: '砍摩擦',
    title: '把第一分钟变轻',
    prompt: '如果用户只给你 60 秒，你会删掉哪个步骤，才能更快进入价值时刻？',
    tag: '体验',
  },
  {
    id: 'show-value',
    kicker: '放大价值',
    title: '让卖点先开口',
    prompt: '哪一个结果最值得在前三屏先展示，而不是等用户自己摸索？',
    tag: '商业',
  },
  {
    id: 'opposite-play',
    kicker: '反着来',
    title: '掀翻行业默认',
    prompt: '如果你故意跟行业里的标准流程反着做，会得到什么更鲜明的体验？',
    tag: '策略',
  },
  {
    id: 'human-touch',
    kicker: '更像人',
    title: '让流程有温度',
    prompt: '哪一步最适合从冷冰冰的自动化，改成能被用户记住的人味动作？',
    tag: '服务',
  },
  {
    id: 'tiny-bet',
    kicker: '小赌注',
    title: '先做最小验证',
    prompt: '这个方向本周能用什么极简原型试一下，而不是先做满配版本？',
    tag: '实验',
  },
];

const IDEA_BLOCKS = {
  leadIns: ['试着让', '把', '围绕', '为'],
  audiences: ['第一次接触的用户', '已经感兴趣却没转化的人', '高价值客户', '最容易流失的用户', '内部运营团队'],
  moves: ['压缩成 30 秒体验', '改成一句承诺就能说清的方案', '拆成可以分享的小片段', '做成无需下载的试点', '变成高频可回流的触点'],
  constraints: ['先不用新增研发投入', '只改文案与节奏', '先用人工兜底', '两天内能上线', '只服务一个细分场景'],
  proofs: ['转化率', '完成率', '复访率', '用户主动提及率', '口碑反馈'],
  outputs: ['一张落地页草图', '一段上手引导', '一个 concierge 流程', '一组对比卡片', '一个候补名单实验'],
};

function hashString(value = '') {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFrom(list, key) {
  return list[hashString(key) % list.length];
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNote({ text, tag = '', author = DEFAULT_OWNER, pinned = false }) {
  const stamp = Date.now();
  return {
    id: createId(),
    text: text.trim(),
    tag: tag.trim(),
    author: author.trim() || DEFAULT_OWNER,
    votes: 0,
    archived: false,
    pinned,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function touchBoard(board) {
  return {
    ...board,
    updatedAt: Date.now(),
  };
}

function appendNotes(board, notes) {
  return touchBoard({
    ...board,
    notes: [...notes, ...board.notes],
  });
}

function patchNote(board, noteId, updater) {
  const stamp = Date.now();
  return touchBoard({
    ...board,
    notes: board.notes.map((note) =>
      note.id === noteId ? { ...note, ...updater(note), updatedAt: stamp } : note
    ),
  });
}

function deleteNote(board, noteId) {
  return touchBoard({
    ...board,
    notes: board.notes.filter((note) => note.id !== noteId),
  });
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeTimestamp(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeNote(rawNote, index) {
  const text = normalizeText(rawNote?.text).trim();
  if (!text) return null;

  const createdAt = normalizeTimestamp(rawNote?.createdAt, index);
  const updatedAt = normalizeTimestamp(rawNote?.updatedAt, createdAt);

  return {
    id: normalizeText(rawNote?.id, `legacy-${index}`),
    text,
    tag: normalizeText(rawNote?.tag ?? rawNote?.tags?.[0]).trim(),
    author: normalizeText(rawNote?.author ?? rawNote?.userName, DEFAULT_OWNER).trim() || DEFAULT_OWNER,
    votes: normalizeTimestamp(rawNote?.votes, 0),
    archived: Boolean(rawNote?.archived),
    pinned: Boolean(rawNote?.pinned),
    createdAt,
    updatedAt,
  };
}

function normalizeBoard(rawBoard) {
  const notes = Array.isArray(rawBoard?.notes)
    ? rawBoard.notes.map(normalizeNote).filter(Boolean)
    : [];

  return {
    version: 2,
    title: normalizeText(rawBoard?.title, DEFAULT_TITLE).trim() || DEFAULT_TITLE,
    owner: normalizeText(rawBoard?.owner ?? rawBoard?.userName, DEFAULT_OWNER).trim() || DEFAULT_OWNER,
    notes,
    updatedAt: normalizeTimestamp(
      rawBoard?.updatedAt,
      notes.reduce(
        (latest, note) => Math.max(latest, note.updatedAt, note.createdAt),
        0
      )
    ),
  };
}

function createInitialBoard() {
  return touchBoard({
    version: 2,
    title: DEFAULT_TITLE,
    owner: DEFAULT_OWNER,
    notes: [],
  });
}

function loadBoard() {
  if (typeof window === 'undefined') {
    return createInitialBoard();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialBoard();
    return normalizeBoard(JSON.parse(raw));
  } catch {
    return createInitialBoard();
  }
}

function persistBoard(serializedBoard) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, serializedBoard);
}

function formatClock(timestamp) {
  if (!timestamp) return '刚创建';
  return CLOCK_FORMATTER.format(new Date(timestamp));
}

function formatNoteTime(timestamp) {
  if (!timestamp) return '未记录时间';
  return NOTE_FORMATTER.format(new Date(timestamp));
}

function createIdeaBurst(topic, promptCard, count, offset) {
  const focus = topic.trim() || DEFAULT_TITLE;
  const ideas = [];
  let cursor = 0;

  while (ideas.length < count && cursor < count * 4) {
    const key = `${focus}:${promptCard.id}:${offset}:${cursor}`;
    const sentence = `${pickFrom(IDEA_BLOCKS.leadIns, `${key}:lead`)}${focus}面向${pickFrom(
      IDEA_BLOCKS.audiences,
      `${key}:aud`
    )}${pickFrom(IDEA_BLOCKS.moves, `${key}:move`)}，${pickFrom(
      IDEA_BLOCKS.constraints,
      `${key}:constraint`
    )}，并用${pickFrom(IDEA_BLOCKS.proofs, `${key}:proof`)}验证${pickFrom(
      IDEA_BLOCKS.outputs,
      `${key}:output`
    )}`;

    if (!ideas.includes(sentence)) {
      ideas.push(sentence);
    }
    cursor += 1;
  }

  return ideas;
}

function downloadBoard(board) {
  if (typeof window === 'undefined') return;

  const fileName = `${board.title || DEFAULT_TITLE}`.trim().replace(/\s+/g, '-').slice(0, 24) || 'brainstorm-board';
  const payload = JSON.stringify(board, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.json`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function toneIndexForNote(note) {
  return (hashString(note.tag || note.id) % 6) + 1;
}

function tiltForNote(noteId) {
  return ((hashString(noteId) % 9) - 4) * 1.1;
}

function sortNotes(notes, sortBy) {
  const sorted = [...notes];

  sorted.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    if (sortBy === 'votes') {
      return right.votes - left.votes || right.updatedAt - left.updatedAt;
    }

    if (sortBy === 'tag') {
      return (
        left.tag.localeCompare(right.tag, 'zh-Hans-CN') ||
        right.updatedAt - left.updatedAt
      );
    }

    return right.updatedAt - left.updatedAt;
  });

  return sorted;
}

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      <span className="stat-card__hint">{hint}</span>
    </article>
  );
}

function NoteCard({
  note,
  onArchiveToggle,
  onDelete,
  onFilterTag,
  onPinToggle,
  onSave,
  onVote,
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(note.text);
  const [draftTag, setDraftTag] = useState(note.tag);
  const tone = toneIndexForNote(note);
  const tilt = tiltForNote(note.id);

  function beginEdit() {
    setDraftText(note.text);
    setDraftTag(note.tag);
    setEditing(true);
  }

  function submitEdit() {
    const nextText = draftText.trim();
    if (!nextText) return;

    onSave(note.id, {
      text: nextText,
      tag: draftTag.trim(),
    });
    setEditing(false);
  }

  return (
    <article
      className={`note-card note-card--${tone}`}
      style={{ '--note-tilt': `${tilt}deg` }}
    >
      <div className="note-card__tape" aria-hidden="true" />
      <header className="note-card__header">
        <button
          className="note-card__tag"
          type="button"
          onClick={() => onFilterTag(note.tag)}
          disabled={!note.tag}
        >
          {note.tag || '未分类'}
        </button>
        {note.pinned ? <span className="note-card__pin">置顶</span> : null}
      </header>

      {editing ? (
        <div className="note-card__editor">
          <textarea
            className="field__control field__control--textarea note-card__textarea"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />
          <input
            className="field__control"
            value={draftTag}
            onChange={(event) => setDraftTag(event.target.value)}
            placeholder="标签"
          />
        </div>
      ) : (
        <p className="note-card__body">{note.text}</p>
      )}

      <footer className="note-card__meta">
        <span>{note.author}</span>
        <span>{formatNoteTime(note.updatedAt || note.createdAt)}</span>
      </footer>

      <div className="note-card__actions">
        <button className="mini-button" type="button" onClick={() => onVote(note.id)}>
          <Vote size={15} />
          {note.votes}
        </button>
        <button className="mini-button" type="button" onClick={() => onPinToggle(note.id)}>
          {note.pinned ? '取消置顶' : '置顶'}
        </button>
        <button className="mini-button" type="button" onClick={() => onArchiveToggle(note.id)}>
          {note.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          {note.archived ? '恢复' : '归档'}
        </button>
        {editing ? (
          <>
            <button className="mini-button mini-button--accent" type="button" onClick={submitEdit}>
              <Check size={15} />
              保存
            </button>
            <button className="mini-button" type="button" onClick={() => setEditing(false)}>
              <X size={15} />
              取消
            </button>
          </>
        ) : (
          <button className="mini-button" type="button" onClick={beginEdit}>
            <Pencil size={15} />
            编辑
          </button>
        )}
        <button
          className="mini-button mini-button--danger"
          type="button"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 size={15} />
          删除
        </button>
      </div>
    </article>
  );
}

function App() {
  const [board, setBoard] = useState(loadBoard);
  const [composer, setComposer] = useState({
    text: '',
    tag: TAG_SUGGESTIONS[0],
  });
  const [promptIndex, setPromptIndex] = useState(0);
  const [burstCursor, setBurstCursor] = useState(0);
  const [filters, setFilters] = useState({
    scope: 'active',
    tag: 'all',
    sort: 'recent',
    search: '',
  });
  const [notice, setNotice] = useState(null);
  const deferredSearch = useDeferredValue(filters.search);
  const importInputId = useId();
  const lastSerializedRef = useRef('');

  const activeNotes = useMemo(
    () => board.notes.filter((note) => !note.archived),
    [board.notes]
  );
  const archivedNotes = useMemo(
    () => board.notes.filter((note) => note.archived),
    [board.notes]
  );
  const tagOptions = useMemo(() => {
    return [...new Set(board.notes.map((note) => note.tag).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, 'zh-Hans-CN')
    );
  }, [board.notes]);
  const topTag = useMemo(() => {
    const counts = new Map();
    activeNotes.forEach((note) => {
      if (!note.tag) return;
      counts.set(note.tag, (counts.get(note.tag) || 0) + 1);
    });

    let winner = '等待聚类';
    let max = 0;
    counts.forEach((count, tag) => {
      if (count > max) {
        winner = tag;
        max = count;
      }
    });
    return winner;
  }, [activeNotes]);
  const currentPrompt = PROMPT_DECK[promptIndex % PROMPT_DECK.length];
  const visibleNotes = useMemo(() => {
    const scopeNotes = filters.scope === 'archived' ? archivedNotes : activeNotes;
    const search = deferredSearch.trim().toLowerCase();

    const filtered = scopeNotes.filter((note) => {
      const tagMatch = filters.tag === 'all' || note.tag === filters.tag;
      if (!tagMatch) return false;

      if (!search) return true;

      const haystack = `${note.text} ${note.tag} ${note.author}`.toLowerCase();
      return haystack.includes(search);
    });

    return sortNotes(filtered, filters.sort);
  }, [activeNotes, archivedNotes, deferredSearch, filters.scope, filters.sort, filters.tag]);

  const applyIncomingBoard = useEffectEvent((serializedBoard) => {
    if (!serializedBoard || serializedBoard === lastSerializedRef.current) return;

    try {
      const nextBoard = normalizeBoard(JSON.parse(serializedBoard));
      lastSerializedRef.current = serializedBoard;
      setBoard(nextBoard);
      setNotice({ tone: 'info', text: '已同步其他标签页里的最新内容。' });
    } catch {
      setNotice({ tone: 'error', text: '收到了一份损坏的同步数据，已忽略。' });
    }
  });

  useEffect(() => {
    const serializedBoard = JSON.stringify(board);
    if (serializedBoard === lastSerializedRef.current) return;
    lastSerializedRef.current = serializedBoard;
    persistBoard(serializedBoard);
  }, [board]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleStorage(event) {
      if (event.key !== STORAGE_KEY) return;

      if (!event.newValue) {
        setBoard(createInitialBoard());
        setNotice({ tone: 'info', text: '共享板已被清空，当前视图已重置。' });
        return;
      }

      applyIncomingBoard(event.newValue);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!notice || typeof window === 'undefined') return undefined;

    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function handleBoardField(field, value, fallback) {
    setBoard((current) =>
      touchBoard({
        ...current,
        [field]: value.trim() || fallback,
      })
    );
  }

  function handleAddNote(event) {
    event.preventDefault();
    const text = composer.text.trim();
    if (!text) return;

    const note = createNote({
      text,
      tag: composer.tag,
      author: board.owner,
    });

    setBoard((current) => appendNotes(current, [note]));
    setComposer((current) => ({ ...current, text: '' }));
    setNotice({ tone: 'success', text: '新卡片已经贴到墙上。' });
  }

  function handleGeneratePack() {
    const generatedNotes = createIdeaBurst(board.title, currentPrompt, 5, burstCursor).map((text) =>
      createNote({
        text,
        tag: currentPrompt.tag,
        author: '灵感引擎',
      })
    );

    startTransition(() => {
      setBoard((current) => appendNotes(current, generatedNotes));
      setBurstCursor((current) => current + 1);
      setNotice({ tone: 'success', text: '已基于题卡补了 5 张热身卡。' });
    });
  }

  function handlePinPrompt() {
    const promptNote = createNote({
      text: currentPrompt.prompt,
      tag: currentPrompt.tag,
      author: '主持人提示',
      pinned: true,
    });

    setBoard((current) => appendNotes(current, [promptNote]));
    setNotice({ tone: 'success', text: '题卡已经贴到墙上作为讨论锚点。' });
  }

  function handleVote(noteId) {
    setBoard((current) =>
      patchNote(current, noteId, (note) => ({
        votes: note.votes + 1,
      }))
    );
  }

  function handleArchiveToggle(noteId) {
    setBoard((current) =>
      patchNote(current, noteId, (note) => ({
        archived: !note.archived,
      }))
    );
  }

  function handlePinToggle(noteId) {
    setBoard((current) =>
      patchNote(current, noteId, (note) => ({
        pinned: !note.pinned,
      }))
    );
  }

  function handleSaveNote(noteId, updates) {
    setBoard((current) =>
      patchNote(current, noteId, () => ({
        text: updates.text,
        tag: updates.tag,
      }))
    );
    setNotice({ tone: 'success', text: '卡片内容已更新。' });
  }

  function handleDeleteNote(noteId) {
    setBoard((current) => deleteNote(current, noteId));
    setNotice({ tone: 'success', text: '卡片已移除。' });
  }

  function handleExportBoard() {
    downloadBoard(board);
    setNotice({ tone: 'success', text: '已导出当前工作板 JSON。' });
  }

  async function handleImportBoard(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const importedBoard = normalizeBoard(JSON.parse(text));

      startTransition(() => {
        setBoard(importedBoard);
        setNotice({ tone: 'success', text: '导入完成，当前工作板已替换。' });
      });
    } catch {
      setNotice({ tone: 'error', text: '导入失败，请确认文件是有效的 JSON 工作板。' });
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--one" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--two" aria-hidden="true" />
      <div className="app-shell__grid" aria-hidden="true" />

      <header className="hero">
        <div className="hero__copy">
          <span className="eyebrow">Workshop-ready Brainstorm Studio</span>
          <label className="hero__title-wrap">
            <span className="sr-only">工作板标题</span>
            <input
              className="hero__title"
              value={board.title}
              onChange={(event) => handleBoardField('title', event.target.value, DEFAULT_TITLE)}
            />
          </label>
          <p className="hero__description">
            一个可直接拿来主持讨论的灵感板。支持本地自动保存、跨标签页同步、按标签聚类、
            置顶与归档管理，以及一键导入导出 JSON。
          </p>

          <div className="hero__meta">
            <label className="presence-card">
              <Users size={18} />
              <span className="sr-only">主持人名称</span>
              <input
                className="presence-card__input"
                value={board.owner}
                onChange={(event) => handleBoardField('owner', event.target.value, DEFAULT_OWNER)}
              />
            </label>
            <span className="autosave-pill">
              <RefreshCw size={15} />
              已自动保存 · {formatClock(board.updatedAt)}
            </span>
          </div>

          <div className="stats-grid">
            <StatCard label="活跃卡片" value={activeNotes.length} hint="当前参与筛选与投票" />
            <StatCard label="归档卡片" value={archivedNotes.length} hint="沉淀过的历史方向" />
            <StatCard
              label="最高票数"
              value={activeNotes.reduce((max, note) => Math.max(max, note.votes), 0)}
              hint="方便会后优先排期"
            />
            <StatCard label="最热标签" value={topTag} hint="现在最集中的讨论区" />
          </div>
        </div>

        <aside className="prompt-card">
          <div className="prompt-card__kicker">
            <Sparkles size={16} />
            {currentPrompt.kicker}
          </div>
          <h2>{currentPrompt.title}</h2>
          <p>{currentPrompt.prompt}</p>
          <div className="prompt-card__actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setPromptIndex((current) => (current + 1) % PROMPT_DECK.length)}
            >
              <RefreshCw size={16} />
              换一张题卡
            </button>
            <button className="button button--secondary" type="button" onClick={handlePinPrompt}>
              <Plus size={16} />
              贴到墙上
            </button>
            <button className="button button--accent" type="button" onClick={handleGeneratePack}>
              <WandSparkles size={16} />
              补 5 张热身卡
            </button>
          </div>
        </aside>
      </header>

      {notice ? (
        <div className={`notice notice--${notice.tone}`}>{notice.text}</div>
      ) : null}

      <main className="workspace">
        <aside className="workspace__aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Quick Capture</span>
                <h3>立刻贴一张</h3>
              </div>
              <span className="panel__hint">手动输入适合现场主持。</span>
            </div>

            <form className="stack" onSubmit={handleAddNote}>
              <label className="field">
                <span className="field__label">想法内容</span>
                <textarea
                  className="field__control field__control--textarea"
                  placeholder="把一句值得被讨论的想法写下来。"
                  value={composer.text}
                  onChange={(event) =>
                    setComposer((current) => ({ ...current, text: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">标签</span>
                <input
                  className="field__control"
                  value={composer.tag}
                  onChange={(event) =>
                    setComposer((current) => ({ ...current, tag: event.target.value }))
                  }
                  placeholder="例如：产品、增长、商业"
                />
              </label>

              <div className="chip-row">
                {TAG_SUGGESTIONS.map((tag) => (
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

              <button className="button button--accent button--full" type="submit">
                <Plus size={16} />
                贴上去
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Board Ops</span>
                <h3>搬运与交接</h3>
              </div>
              <span className="panel__hint">把工作板带到别的机器或会前准备里。</span>
            </div>

            <div className="stack">
              <button className="button button--secondary button--full" type="button" onClick={handleExportBoard}>
                <Download size={16} />
                导出当前 JSON
              </button>

              <label className="button button--ghost button--full upload-button" htmlFor={importInputId}>
                <Upload size={16} />
                导入已有工作板
              </label>
              <input
                id={importInputId}
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={handleImportBoard}
              />
            </div>
          </section>
        </aside>

        <section className="workspace__main">
          <section className="panel panel--filters">
            <div className="panel__header panel__header--compact">
              <div>
                <span className="eyebrow">Signal Control</span>
                <h3>筛选与排序</h3>
              </div>
              <span className="panel__hint">
                当前显示 {visibleNotes.length} 张卡片
              </span>
            </div>

            <div className="filter-layout">
              <div className="segmented">
                <button
                  className={filters.scope === 'active' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, scope: 'active' }))}
                >
                  活跃
                </button>
                <button
                  className={filters.scope === 'archived' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, scope: 'archived' }))}
                >
                  归档
                </button>
              </div>

              <label className="field">
                <span className="field__label">搜索</span>
                <input
                  className="field__control"
                  placeholder="按内容、作者或标签检索"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">排序</span>
                <select
                  className="field__control"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, sort: event.target.value }))
                  }
                >
                  <option value="recent">最近更新</option>
                  <option value="votes">票数优先</option>
                  <option value="tag">按标签</option>
                </select>
              </label>
            </div>

            <div className="chip-row chip-row--spacious">
              <button
                className={`chip ${filters.tag === 'all' ? 'chip--active' : ''}`}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, tag: 'all' }))}
              >
                全部标签
              </button>
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${filters.tag === tag ? 'chip--active' : ''}`}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, tag }))}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>

          {visibleNotes.length ? (
            <section className="note-grid">
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onArchiveToggle={handleArchiveToggle}
                  onDelete={handleDeleteNote}
                  onFilterTag={(tag) =>
                    setFilters((current) => ({ ...current, scope: 'active', tag: tag || 'all' }))
                  }
                  onPinToggle={handlePinToggle}
                  onSave={handleSaveNote}
                  onVote={handleVote}
                />
              ))}
            </section>
          ) : (
            <section className="empty-state">
              <span className="empty-state__eyebrow">Nothing on the wall</span>
              <h3>{filters.scope === 'archived' ? '归档区还是空的' : '还没有符合条件的卡片'}</h3>
              <p>
                {filters.scope === 'archived'
                  ? '把成熟或暂缓的方向归档后，它们会出现在这里。'
                  : '可以手动贴一张，或者用右上角题卡快速生成一组热身灵感。'}
              </p>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
