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
  ArrowLeft,
  ChevronDown,
  Download,
  Minus,
  Pin,
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

const PROJECTS_KEY = 'brainstorm:projects:v1';
const BOARD_KEY_PREFIX = 'brainstorm:board:v1:';
const LEGACY_KEY = 'brainstorm:studio:v2';
const LANGUAGE_KEY = 'brainstorm:studio:language';
const DEFAULT_LANGUAGE = 'zh';
const DEFAULT_AI_DIVERGENCE = 55;
const DEFAULT_NOTE_FONT_SCALE = 1.12;
const MAX_AI_WEIGHT = 3;
const AI_AUTHOR_ALIASES = new Set(['AI 灵感', 'AI Ideas']);
const PROMPT_AUTHOR_ALIASES = new Set(['引导提示', 'Prompt']);

const LOCALE_CONFIG = {
  zh: {
    htmlLang: 'zh-CN',
    dateLocale: 'zh-CN',
    sortLocale: 'zh-Hans-CN',
    defaults: {
      title: '新项目头脑风暴',
      owner: '我',
    },
    tagSuggestions: ['技术', '产品', '用户', '竞品', '设计', '验证'],
    promptDeck: [
      {
        id: 'find-pain',
        kicker: '找痛点',
        title: '发现值得解决的问题',
        prompt: '你或身边同学每周都会遇到什么让人头疼的事？如果用技术来解决，你会从哪个具体环节入手？',
        tag: '用户',
      },
      {
        id: 'know-user',
        kicker: '想用户',
        title: '了解你的第一批用户',
        prompt: '你理想中的第一批用户是谁？他们现在怎么"凑合"解决这个问题，最低效的步骤在哪里？',
        tag: '用户',
      },
      {
        id: 'find-edge',
        kicker: '找差异',
        title: '比现有方案好在哪',
        prompt: '已经有类似工具了，但如果你专门为大学生或校园场景优化，会做哪些不一样的设计决策？',
        tag: '竞品',
      },
      {
        id: 'mvp',
        kicker: '最小原型',
        title: '一周内能做出什么',
        prompt: '不要想完整版——什么是你这周就能做出来、能让真实用户试用并给你反馈的最小版本？',
        tag: '验证',
      },
      {
        id: 'tech-stack',
        kicker: '技术视角',
        title: '技术选型能带来什么机会',
        prompt: '用什么 API 或开源工具能让这个想法的实现复杂度大幅下降？你的技术选择能给你哪些竞争优势？',
        tag: '技术',
      },
    ],
    text: {
      documentTitle: 'Brainstorm Studio | 项目灵感工坊',
      documentDescription: '帮助大学生发散思维、探索项目创意的头脑风暴工具。',
      languageLabel: '语言',
      languageOptions: { zh: '中文', en: 'EN' },
      titleSr: '项目标题',
      hostSr: '作者名称',
      autosaved: (time) => `已保存 · ${time}`,
      justCreated: '刚创建',
      timeMissing: '未记录',
      topTagFallback: '等待聚类',
      backToHome: '返回项目',
      statsTitle: '数据统计',
      stats: {
        activeLabel: '活跃便签',
        activeHint: '当前参与筛选与投票',
        archivedLabel: '归档便签',
        archivedHint: '沉淀过的历史想法',
        topVotesLabel: '最高票数',
        topVotesHint: '方便优先排期',
        topTagLabel: '最热标签',
        topTagHint: '现在最集中的讨论区',
      },
      promptActions: {
        rotate: '换一个角度',
        pin: '贴到墙上',
        generate: '让 Gemma 补 5 条',
        generating: 'Gemma 思考中...',
      },
      promptStatus: {
        label: 'AI 辅助',
        checking: '正在检查本地 Ollama...',
        ready: (model) => `已连接 · ${model}`,
        modelMissing: (model) => `Ollama 已启动，但没有找到 ${model}`,
        offline: '本地 Ollama 当前不可达',
        failed: 'Gemma 生成失败，请稍后再试',
      },
      promptControls: {
        divergenceLabel: '发散程度',
        focused: '更收敛',
        wild: '更发散',
      },
      quickPanel: {
        eyebrow: '快速记录',
        title: '贴一张便签',
        ideaLabel: '想法',
        ideaPlaceholder: '把一个值得讨论的想法写下来',
        tagLabel: '标签',
        tagPlaceholder: '例如：技术、产品',
        submit: '贴上去',
      },
      opsPanel: {
        title: '导入 / 导出',
        export: '导出 JSON',
        import: '导入工作板',
      },
      filters: {
        title: '筛选与排序',
        showing: (n) => `${n} 张`,
        scopeActive: '活跃',
        scopeArchived: '归档',
        searchLabel: '搜索',
        searchPlaceholder: '按内容、作者或标签检索',
        sortLabel: '排序',
        sortRecent: '最近更新',
        sortVotes: '票数优先',
        sortTag: '按标签',
        allTags: '全部',
        noteSizeLabel: '字号',
      },
      empty: {
        eyebrow: '便签墙还是空的',
        activeTitle: '还没有符合条件的便签',
        activeDescription: '在左侧输入你的第一个想法，或者让 Gemma 帮你热个身。',
        archivedTitle: '归档区还是空的',
        archivedDescription: '把成熟或暂缓的想法归档后，它们会出现在这里。',
      },
      noteCard: {
        untagged: '未分类',
        pinned: '置顶',
        tagPlaceholder: '标签',
        tagLabel: '标签',
        pin: '置顶',
        unpin: '取消置顶',
        archive: '归档',
        restore: '恢复',
        delete: '删除',
        vote: '投票',
        weight: 'AI 权重',
        more: '更多操作',
        voteDown: '减一票',
        voteUp: '加一票',
      },
      authors: {
        ideaEngine: 'AI 灵感',
        promptHost: '引导提示',
      },
      notices: {
        sync: '已同步其他标签页里的最新内容。',
        syncReset: '共享板已被清空，当前视图已重置。',
        syncInvalid: '收到了一份损坏的同步数据，已忽略。',
        added: '新便签已贴到墙上。',
        generated: (model) => `${model} 补充了 5 条新想法。`,
        promptPinned: '引导提示已贴到墙上。',
        saved: '便签内容已更新。',
        deleted: '便签已移除。',
        exported: '已导出工作板 JSON。',
        imported: '导入完成，当前工作板已替换。',
        importFailed: '导入失败，请确认文件是有效的 JSON 工作板。',
        languageSwitched: '界面语言已切换为中文。',
        aiConnectionFailed: '连接本地 Ollama 失败，请确认 `ollama serve` 正在运行。',
        aiModelMissing: (model) => `本地 Ollama 已连接，但没有找到模型 ${model}。`,
        aiRequestFailed: (message) => `Gemma 生成失败：${message}`,
      },
      home: {
        tagline: '把你的每一个天马行空，变成下一个大项目',
        newProject: '新建项目',
        newProjectPlaceholder: '这次头脑风暴的主题是...',
        createProject: '创建',
        cancel: '取消',
        notesCount: (n) => `${n} 张便签`,
        emptyTitle: '还没有项目',
        emptyHint: '创建第一个灵感项目，开始头脑风暴吧。',
        confirmDelete: '确认删除？',
      },
    },
  },
  en: {
    htmlLang: 'en',
    dateLocale: 'en-US',
    sortLocale: 'en-US',
    defaults: {
      title: 'New Project Brainstorm',
      owner: 'Me',
    },
    tagSuggestions: ['Tech', 'Product', 'User', 'Market', 'Design', 'Validate'],
    promptDeck: [
      {
        id: 'find-pain',
        kicker: 'Find Pain',
        title: 'Discover Problems Worth Solving',
        prompt: 'What problem do you or your classmates hit every week that nobody has solved well? Where does the real frustration live?',
        tag: 'User',
      },
      {
        id: 'know-user',
        kicker: 'Know Your User',
        title: 'Understand Your First Users',
        prompt: 'Who are your ideal first users? How are they "making do" right now, and where is the most inefficient step you could eliminate?',
        tag: 'User',
      },
      {
        id: 'find-edge',
        kicker: 'Find Your Edge',
        title: 'How You Beat Existing Solutions',
        prompt: 'Similar tools already exist. What specific design decisions would you make differently if you optimized only for students or campus life?',
        tag: 'Market',
      },
      {
        id: 'mvp',
        kicker: 'Smallest Bet',
        title: 'What Can You Ship This Week',
        prompt: "Not the full version — what's the minimum you can put in front of real users this week to validate your core assumption?",
        tag: 'Validate',
      },
      {
        id: 'tech-stack',
        kicker: 'Tech Angle',
        title: 'What Your Stack Makes Possible',
        prompt: 'What API or open-source tool cuts your build complexity in half? How does your tech choice give you an advantage a slower team cannot match?',
        tag: 'Tech',
      },
    ],
    text: {
      documentTitle: 'Brainstorm Studio | Project Idea Lab',
      documentDescription: 'A brainstorming tool to help students find project ideas and think expansively.',
      languageLabel: 'Language',
      languageOptions: { zh: '中文', en: 'EN' },
      titleSr: 'Project title',
      hostSr: 'Author name',
      autosaved: (time) => `Saved · ${time}`,
      justCreated: 'Just created',
      timeMissing: 'No timestamp',
      topTagFallback: 'Waiting for a cluster',
      backToHome: 'Back to projects',
      statsTitle: 'Statistics',
      stats: {
        activeLabel: 'Active Notes',
        activeHint: 'Currently in the working set',
        archivedLabel: 'Archived',
        archivedHint: 'Ideas parked for later',
        topVotesLabel: 'Top Votes',
        topVotesHint: 'Useful for prioritization',
        topTagLabel: 'Hottest Tag',
        topTagHint: 'Where discussion is clustering',
      },
      promptActions: {
        rotate: 'Next angle',
        pin: 'Pin to wall',
        generate: 'Ask Gemma for 5 more',
        generating: 'Gemma is thinking...',
      },
      promptStatus: {
        label: 'AI Assist',
        checking: 'Checking local Ollama...',
        ready: (model) => `Connected · ${model}`,
        modelMissing: (model) => `Ollama is running but ${model} is missing`,
        offline: 'Local Ollama is unreachable',
        failed: 'Generation failed. Try again.',
      },
      promptControls: {
        divergenceLabel: 'Divergence',
        focused: 'Focused',
        wild: 'Wilder',
      },
      quickPanel: {
        eyebrow: 'Quick Capture',
        title: 'Post A Note',
        ideaLabel: 'Idea',
        ideaPlaceholder: 'Write one idea worth discussing.',
        tagLabel: 'Tag',
        tagPlaceholder: 'e.g. Tech, Product',
        submit: 'Post it',
      },
      opsPanel: {
        title: 'Import / Export',
        export: 'Export JSON',
        import: 'Import board',
      },
      filters: {
        title: 'Filter & Sort',
        showing: (n) => `${n} notes`,
        scopeActive: 'Active',
        scopeArchived: 'Archived',
        searchLabel: 'Search',
        searchPlaceholder: 'Search by content, author, or tag',
        sortLabel: 'Sort',
        sortRecent: 'Recently updated',
        sortVotes: 'Most votes',
        sortTag: 'By tag',
        allTags: 'All',
        noteSizeLabel: 'Note size',
      },
      empty: {
        eyebrow: 'Nothing on the wall yet',
        activeTitle: 'No notes match this view',
        activeDescription: 'Type your first idea on the left, or let Gemma warm things up.',
        archivedTitle: 'The archive is empty',
        archivedDescription: 'Archived ideas will appear here once you park mature or paused directions.',
      },
      noteCard: {
        untagged: 'Untagged',
        pinned: 'Pinned',
        tagPlaceholder: 'Tag',
        tagLabel: 'Tag',
        pin: 'Pin',
        unpin: 'Unpin',
        archive: 'Archive',
        restore: 'Restore',
        delete: 'Delete',
        vote: 'Vote',
        weight: 'AI weight',
        more: 'More actions',
        voteDown: 'Remove one vote',
        voteUp: 'Add one vote',
      },
      authors: {
        ideaEngine: 'AI Idea',
        promptHost: 'Prompt',
      },
      notices: {
        sync: 'Synced the latest board state from another tab.',
        syncReset: 'The shared board was cleared, so this view has been reset.',
        syncInvalid: 'Ignored a corrupted board payload from storage sync.',
        added: 'Note posted to the wall.',
        generated: (model) => `${model} added 5 new ideas.`,
        promptPinned: 'Prompt pinned to the wall.',
        saved: 'Note updated.',
        deleted: 'Note removed.',
        exported: 'Exported the board as JSON.',
        imported: 'Import complete. Board replaced.',
        importFailed: 'Import failed. Please use a valid board JSON file.',
        languageSwitched: 'Interface language switched to English.',
        aiConnectionFailed: 'Could not reach local Ollama. Make sure `ollama serve` is running.',
        aiModelMissing: (model) => `Local Ollama is up, but model ${model} is missing.`,
        aiRequestFailed: (message) => `Generation failed: ${message}`,
      },
      home: {
        tagline: 'Turn every wild idea into your next big project.',
        newProject: 'New Project',
        newProjectPlaceholder: "What are you brainstorming today?",
        createProject: 'Create',
        cancel: 'Cancel',
        notesCount: (n) => `${n} note${n === 1 ? '' : 's'}`,
        emptyTitle: 'No projects yet',
        emptyHint: 'Create your first brainstorm project to get started.',
        confirmDelete: 'Confirm delete?',
      },
    },
  },
};

function getLocale(language) {
  return LOCALE_CONFIG[language] ?? LOCALE_CONFIG[DEFAULT_LANGUAGE];
}

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'zh';
}

function loadLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    return DEFAULT_LANGUAGE;
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) {
    return 'en';
  }
  return DEFAULT_LANGUAGE;
}

function persistLanguage(language) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_KEY, normalizeLanguage(language));
  } catch {
    // Ignore storage write failures.
  }
}

function hashString(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAiWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_AI_WEIGHT, Math.round(parsed)));
}

function normalizeAiDivergence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_DIVERGENCE;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeNoteFontScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_NOTE_FONT_SCALE;
  return Math.max(0.9, Math.min(1.45, Number(parsed.toFixed(2))));
}

function normalizeNoteSource(source) {
  return source === 'ai' || source === 'prompt' ? source : 'user';
}

function inferNoteSource(rawSource, author) {
  if (rawSource === 'ai' || rawSource === 'prompt' || rawSource === 'user') return rawSource;
  if (AI_AUTHOR_ALIASES.has(author)) return 'ai';
  if (PROMPT_AUTHOR_ALIASES.has(author)) return 'prompt';
  return 'user';
}

function createNote({ text, tag = '', author = '', pinned = false, source = 'user', fallbackAuthor }) {
  const stamp = Date.now();
  return {
    id: createId(),
    text: text.trim(),
    tag: tag.trim(),
    author: author.trim() || fallbackAuthor || getLocale(DEFAULT_LANGUAGE).defaults.owner,
    source: normalizeNoteSource(source),
    votes: 0,
    aiWeight: 0,
    archived: false,
    pinned,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function touchBoard(board) {
  return { ...board, updatedAt: Date.now() };
}

function appendNotes(board, notes) {
  return touchBoard({ ...board, notes: [...notes, ...board.notes] });
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
  return touchBoard({ ...board, notes: board.notes.filter((note) => note.id !== noteId) });
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeTimestamp(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeNote(rawNote, index, language) {
  const text = normalizeText(rawNote?.text).trim();
  if (!text) return null;
  const locale = getLocale(language);
  const createdAt = normalizeTimestamp(rawNote?.createdAt, index);
  const updatedAt = normalizeTimestamp(rawNote?.updatedAt, createdAt);
  const author = normalizeText(rawNote?.author ?? rawNote?.userName, locale.defaults.owner).trim() || locale.defaults.owner;
  return {
    id: normalizeText(rawNote?.id, `legacy-${index}`),
    text,
    tag: normalizeText(rawNote?.tag ?? rawNote?.tags?.[0]).trim(),
    author,
    source: inferNoteSource(rawNote?.source, author),
    votes: normalizeTimestamp(rawNote?.votes, 0),
    aiWeight: normalizeAiWeight(rawNote?.aiWeight),
    archived: Boolean(rawNote?.archived),
    pinned: Boolean(rawNote?.pinned),
    createdAt,
    updatedAt,
  };
}

function normalizeBoard(rawBoard, language = DEFAULT_LANGUAGE) {
  const locale = getLocale(language);
  const notes = Array.isArray(rawBoard?.notes)
    ? rawBoard.notes.map((note, i) => normalizeNote(note, i, language)).filter(Boolean)
    : [];
  return {
    version: 2,
    title: normalizeText(rawBoard?.title, locale.defaults.title).trim() || locale.defaults.title,
    owner: normalizeText(rawBoard?.owner ?? rawBoard?.userName, locale.defaults.owner).trim() || locale.defaults.owner,
    aiDivergence: normalizeAiDivergence(rawBoard?.aiDivergence),
    noteFontScale: normalizeNoteFontScale(rawBoard?.noteFontScale),
    notes,
    updatedAt: normalizeTimestamp(
      rawBoard?.updatedAt,
      notes.reduce((latest, note) => Math.max(latest, note.updatedAt, note.createdAt), 0)
    ),
  };
}

function createInitialBoard(language = DEFAULT_LANGUAGE) {
  const locale = getLocale(language);
  return touchBoard({
    version: 2,
    title: locale.defaults.title,
    owner: locale.defaults.owner,
    aiDivergence: DEFAULT_AI_DIVERGENCE,
    noteFontScale: DEFAULT_NOTE_FONT_SCALE,
    notes: [],
  });
}

function selectAiContextNotes(notes) {
  const weightedNotes = notes.filter((note) => note.aiWeight > 0 && note.source !== 'prompt');
  const userNotes = notes.filter((note) => note.source === 'user');
  const mergedNotes = weightedNotes.length
    ? [...new Map([...weightedNotes, ...userNotes].map((note) => [note.id, note])).values()]
    : userNotes;
  const sourceNotes = mergedNotes.length ? mergedNotes : notes.filter((note) => note.source !== 'prompt');

  return [...sourceNotes]
    .sort((a, b) => {
      if (a.aiWeight !== b.aiWeight) return b.aiWeight - a.aiWeight;
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (a.votes !== b.votes) return b.votes - a.votes;
      if (a.text.length !== b.text.length) return b.text.length - a.text.length;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 12);
}

function autoResizeTextarea(element) {
  if (!element) return;
  element.style.height = '0px';
  element.style.height = `${element.scrollHeight}px`;
}

function downloadBoard(board) {
  if (typeof window === 'undefined') return;
  const fileName = `${board.title || 'brainstorm'}`.trim().replace(/\s+/g, '-').slice(0, 24) || 'brainstorm-board';
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
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

function sortNotes(notes, sortBy, language) {
  const sorted = [...notes];
  const locale = getLocale(language);
  sorted.sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    if (sortBy === 'votes') return b.votes - a.votes || b.updatedAt - a.updatedAt;
    if (sortBy === 'tag') return a.tag.localeCompare(b.tag, locale.sortLocale) || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
  return sorted;
}

function remapSuggestedTag(tag, fromLanguage, toLanguage) {
  const src = getLocale(fromLanguage).tagSuggestions;
  const dst = getLocale(toLanguage).tagSuggestions;
  const idx = src.indexOf(tag);
  if (idx === -1) return tag;
  return dst[idx] ?? tag;
}

// ─── Multi-project storage ────────────────────────────────────────────────────

function computeTopTag(notes) {
  const counts = new Map();
  notes.filter((n) => !n.archived && n.tag).forEach((n) => {
    counts.set(n.tag, (counts.get(n.tag) || 0) + 1);
  });
  let best = '';
  let max = 0;
  counts.forEach((count, tag) => { if (count > max) { best = tag; max = count; } });
  return best;
}

function loadProjects() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    // Migrate legacy single board
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacyBoard = JSON.parse(legacyRaw);
      const projectId = createId();
      const project = {
        id: projectId,
        title: legacyBoard.title || getLocale(DEFAULT_LANGUAGE).defaults.title,
        updatedAt: legacyBoard.updatedAt || Date.now(),
        noteCount: Array.isArray(legacyBoard.notes) ? legacyBoard.notes.filter((n) => !n.archived).length : 0,
        topTag: computeTopTag(Array.isArray(legacyBoard.notes) ? legacyBoard.notes : []),
      };
      window.localStorage.setItem(BOARD_KEY_PREFIX + projectId, legacyRaw);
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify([project]));
      return [project];
    }
    return [];
  } catch {
    return [];
  }
}

function persistProjects(projects) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage write failures.
  }
}

function loadBoardById(projectId, language) {
  if (typeof window === 'undefined') return createInitialBoard(language);
  try {
    const raw = window.localStorage.getItem(BOARD_KEY_PREFIX + projectId);
    if (!raw) return createInitialBoard(language);
    return normalizeBoard(JSON.parse(raw), language);
  } catch {
    return createInitialBoard(language);
  }
}

function persistBoardById(projectId, serialized) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOARD_KEY_PREFIX + projectId, serialized);
  } catch {
    // Ignore storage write failures.
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible${open ? ' collapsible--open' : ''}`}>
      <button type="button" className="collapsible__trigger" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <ChevronDown size={15} className="collapsible__icon" />
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  );
}

const PROJECT_TONES = [
  { gradient: 'linear-gradient(145deg, #fff9e6, #fde68a)', tape: 'rgba(245,158,11,0.35)' },
  { gradient: 'linear-gradient(145deg, #e6fff6, #a7f3d0)', tape: 'rgba(16,185,129,0.30)' },
  { gradient: 'linear-gradient(145deg, #e6f0ff, #bfdbfe)', tape: 'rgba(59,130,246,0.28)' },
  { gradient: 'linear-gradient(145deg, #f0e6ff, #ddd6fe)', tape: 'rgba(139,92,246,0.28)' },
  { gradient: 'linear-gradient(145deg, #ffe6f4, #fbcfe8)', tape: 'rgba(236,72,153,0.26)' },
  { gradient: 'linear-gradient(145deg, #fff0e6, #fed7aa)', tape: 'rgba(249,115,22,0.28)' },
];

function projectTone(id) {
  return PROJECT_TONES[hashString(id) % PROJECT_TONES.length];
}

function formatNoteTime(language, timestamp) {
  if (!timestamp) return getLocale(language).text.timeMissing;
  return new Intl.DateTimeFormat(getLocale(language).dateLocale, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatClock(language, timestamp) {
  if (!timestamp) return getLocale(language).text.justCreated;
  return new Intl.DateTimeFormat(getLocale(language).dateLocale, {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp));
}

function ProjectCard({ project, language, onEnter, onDelete }) {
  const t = getLocale(language).text.home;
  const tone = projectTone(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article
      className="project-card"
      style={{ '--project-gradient': tone.gradient, '--project-tape': tone.tape }}
    >
      <div className="project-card__tape" aria-hidden="true" />
      <button className="project-card__body" type="button" onClick={onEnter}>
        <h3 className="project-card__title">{project.title}</h3>
        <div className="project-card__chips">
          <span className="project-card__count">{t.notesCount(project.noteCount ?? 0)}</span>
          {project.topTag ? <span className="project-card__tag">{project.topTag}</span> : null}
        </div>
        <span className="project-card__time">{formatNoteTime(language, project.updatedAt)}</span>
      </button>
      <div className="project-card__footer">
        {confirmDelete ? (
          <>
            <button className="mini-button mini-button--danger" type="button" onClick={onDelete}>
              <Trash2 size={13} /> {t.confirmDelete}
            </button>
            <button className="mini-button" type="button" onClick={() => setConfirmDelete(false)}>
              <X size={13} />
            </button>
          </>
        ) : (
          <button className="mini-button mini-button--ghost" type="button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

function ProjectsHome({ language, projects, onEnter, onCreate, onDelete, onLanguageChange }) {
  const [newTitle, setNewTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const locale = getLocale(language);
  const t = locale.text;
  const ht = t.home;

  function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewTitle('');
    setShowForm(false);
  }

  return (
    <div className="home-shell">
      <div className="home-shell__glow home-shell__glow--a" aria-hidden="true" />
      <div className="home-shell__glow home-shell__glow--b" aria-hidden="true" />

      <header className="home-header">
        <div className="home-header__brand">
          <span className="home-header__dot" aria-hidden="true" />
          <span className="home-header__name">Brainstorm Studio</span>
        </div>
        <div className="language-switch">
          <span className="language-switch__label">{t.languageLabel}</span>
          <div className="segmented">
            {Object.entries(t.languageOptions).map(([key, label]) => (
              <button
                key={key}
                className={language === key ? 'is-active' : ''}
                type="button"
                onClick={() => onLanguageChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="home-hero">
        <h1 className="home-hero__title">
          {language === 'zh' ? '灵感工坊' : 'Idea Lab'}
        </h1>
        <p className="home-hero__tagline">{ht.tagline}</p>

        {showForm ? (
          <form className="create-form" onSubmit={handleCreate}>
            <input
              className="field__control create-form__input"
              placeholder={ht.newProjectPlaceholder}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button className="button button--accent" type="submit">
              <Plus size={15} /> {ht.createProject}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => { setShowForm(false); setNewTitle(''); }}
            >
              {ht.cancel}
            </button>
          </form>
        ) : (
          <button className="button button--accent home-hero__cta" type="button" onClick={() => setShowForm(true)}>
            <Plus size={17} /> {ht.newProject}
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="home-empty">
          <p className="home-empty__title">{ht.emptyTitle}</p>
          <p className="home-empty__hint">{ht.emptyHint}</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              language={language}
              onEnter={() => onEnter(project.id)}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  language,
  note,
  onArchiveToggle,
  onDelete,
  onFilterTag,
  onPinToggle,
  onSave,
  onVote,
  onWeightChange,
}) {
  const copy = getLocale(language).text.noteCard;
  const [openPanel, setOpenPanel] = useState(null);
  const textRef = useRef(null);
  const tagRef = useRef(null);
  const tone = toneIndexForNote(note);
  const tilt = tiltForNote(note.id);

  useEffect(() => {
    if (textRef.current && document.activeElement !== textRef.current) {
      textRef.current.value = note.text;
      autoResizeTextarea(textRef.current);
    }
    if (tagRef.current && document.activeElement !== tagRef.current) {
      tagRef.current.value = note.tag;
    }
  }, [note.text, note.tag, note.updatedAt]);

  function commitChanges() {
    const nextText = String(textRef.current?.value ?? note.text).trim();
    const nextTag = String(tagRef.current?.value ?? note.tag).trim();

    if (!nextText) {
      if (textRef.current) {
        textRef.current.value = note.text;
        autoResizeTextarea(textRef.current);
      }
      if (tagRef.current) {
        tagRef.current.value = note.tag;
      }
      return;
    }

    if (nextText !== note.text || nextTag !== note.tag) {
      onSave(note.id, { text: nextText, tag: nextTag }, { silent: true });
    }
  }

  function togglePanel(panel) {
    commitChanges();
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function selectWeight(aiWeight) {
    onWeightChange(note.id, aiWeight);
    setOpenPanel(null);
  }

  return (
    <article className={`note-card note-card--${tone}`} style={{ '--note-tilt': `${tilt}deg` }}>
      <div className="note-card__tape" aria-hidden="true" />
      <header className="note-card__header">
        <button
          className="note-card__tag"
          type="button"
          onClick={() => onFilterTag(note.tag)}
          disabled={!note.tag}
        >
          {note.tag || copy.untagged}
        </button>
        {note.pinned ? (
          <span className="note-card__pin" aria-label={copy.pinned} title={copy.pinned}>
            <Pin size={12} />
          </span>
        ) : null}
      </header>

      <textarea
        ref={textRef}
        className="note-card__body-input"
        defaultValue={note.text}
        onChange={(e) => {
          autoResizeTextarea(e.target);
        }}
        onBlur={() => commitChanges()}
        rows={3}
      />

      <footer className="note-card__meta">
        <span>{note.author}</span>
        <span>{formatNoteTime(language, note.updatedAt || note.createdAt)}</span>
      </footer>

      <div className="note-card__actions">
        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${openPanel === 'vote' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('vote')}
            aria-label={`${copy.vote} ${note.votes}`}
            title={copy.vote}
          >
            <Vote size={16} />
            <span>{note.votes}</span>
          </button>

          {openPanel === 'vote' ? (
            <div className="note-card__panel note-card__panel--compact">
              <div className="note-card__vote-stepper">
                <button
                  className="note-card__icon-step"
                  type="button"
                  onClick={() => onVote(note.id, -1)}
                  aria-label={copy.voteDown}
                  title={copy.voteDown}
                  disabled={note.votes <= 0}
                >
                  <Minus size={14} />
                </button>
                <span className="note-card__panel-value">{note.votes}</span>
                <button
                  className="note-card__icon-step"
                  type="button"
                  onClick={() => onVote(note.id, 1)}
                  aria-label={copy.voteUp}
                  title={copy.voteUp}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${note.aiWeight ? ' note-card__action-button--active' : ''}${openPanel === 'weight' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('weight')}
            aria-label={`${copy.weight} ${note.aiWeight}`}
            title={copy.weight}
          >
            <Sparkles size={16} />
            <span>{note.aiWeight}</span>
          </button>

          {openPanel === 'weight' ? (
            <div className="note-card__panel">
              <div className="note-card__weight-grid">
                {Array.from({ length: MAX_AI_WEIGHT + 1 }, (_, value) => (
                  <button
                    key={value}
                    className={`note-card__weight-option${note.aiWeight === value ? ' note-card__weight-option--active' : ''}`}
                    type="button"
                    onClick={() => selectWeight(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${openPanel === 'menu' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('menu')}
            aria-label={copy.more}
            title={copy.more}
          >
            <ChevronDown size={16} className="note-card__more-icon" />
          </button>

          {openPanel === 'menu' ? (
            <div className="note-card__menu">
              <label className="note-card__menu-field">
                <span>{copy.tagLabel}</span>
                <input
                  ref={tagRef}
                  className="note-card__menu-input"
                  defaultValue={note.tag}
                  onBlur={() => commitChanges()}
                  placeholder={copy.tagPlaceholder}
                />
              </label>

              <div className="note-card__menu-actions">
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => {
                    onPinToggle(note.id);
                    setOpenPanel(null);
                  }}
                >
                  <Pin size={14} /> {note.pinned ? copy.unpin : copy.pin}
                </button>
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => {
                    onArchiveToggle(note.id);
                    setOpenPanel(null);
                  }}
                >
                  {note.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  {note.archived ? copy.restore : copy.archive}
                </button>
                <button
                  className="mini-button mini-button--danger"
                  type="button"
                  onClick={() => {
                    setOpenPanel(null);
                    onDelete(note.id);
                  }}
                >
                  <Trash2 size={14} /> {copy.delete}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [language, setLanguage] = useState(loadLanguage);
  const [projects, setProjects] = useState(loadProjects);
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

  const locale = getLocale(language);
  const text = locale.text;
  const fallbackModelName = aiAssist.model ?? 'Gemma';

  const activeNotes = useMemo(() => (board?.notes ?? []).filter((n) => !n.archived), [board?.notes]);
  const archivedNotes = useMemo(() => (board?.notes ?? []).filter((n) => n.archived), [board?.notes]);
  const aiContextNotes = useMemo(() => selectAiContextNotes(activeNotes), [activeNotes]);
  const tagOptions = [...new Set((board?.notes ?? []).map((n) => n.tag).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, locale.sortLocale)
  );
  const topTag = (() => {
    const counts = new Map();
    activeNotes.forEach((n) => { if (n.tag) counts.set(n.tag, (counts.get(n.tag) || 0) + 1); });
    let winner = text.topTagFallback;
    let max = 0;
    counts.forEach((count, tag) => { if (count > max) { winner = tag; max = count; } });
    return winner;
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

  // ─── Effects ─────────────────────────────────────────────────────────────────

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
    setBoard(createInitialBoard(language));
    setNotice({ tone: 'info', text: text.notices.syncReset });
  });

  const syncAiStatus = useEffectEvent(async () => {
    try {
      const response = await fetch('/api/ai/status');
      const payload = await response.json();
      if (!response.ok) {
        setAiAssist((c) => ({ ...c, available: false, loading: false, model: payload.model ?? c.model, reason: payload.reason ?? 'connection_failed' }));
        return;
      }
      setAiAssist((c) => ({ ...c, available: payload.available, loading: false, model: payload.model ?? c.model, reason: payload.reason ?? (payload.available ? 'ready' : 'model_missing') }));
    } catch {
      setAiAssist((c) => ({ ...c, available: false, loading: false, reason: 'connection_failed' }));
    }
  });

  useEffect(() => {
    if (!activeProjectId || !board) return;
    const serialized = JSON.stringify(board);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    persistBoardById(activeProjectId, serialized);
    const noteCount = board.notes.filter((n) => !n.archived).length;
    const topTagVal = computeTopTag(board.notes);
    setProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, title: board.title, updatedAt: board.updatedAt, noteCount, topTag: topTagVal }
          : p
      );
      persistProjects(updated);
      return updated;
    });
  }, [board, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || typeof window === 'undefined') return undefined;
    const key = BOARD_KEY_PREFIX + activeProjectId;
    function handleStorage(event) {
      if (event.key !== key) return;
      if (!event.newValue) { handleBoardReset(); return; }
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

  // ─── Navigation ───────────────────────────────────────────────────────────────

  function handleEnterProject(projectId) {
    const nextBoard = loadBoardById(projectId, language);
    lastSerializedRef.current = '';
    setBoard(nextBoard);
    setActiveProjectId(projectId);
    setFilters({ scope: 'active', tag: 'all', sort: 'recent', search: '' });
    setComposer({ text: '', tag: locale.tagSuggestions[0] });
  }

  function handleCreateProject(title) {
    const projectId = createId();
    const now = Date.now();
    const newProject = { id: projectId, title, updatedAt: now, noteCount: 0, topTag: '' };
    const newBoard = {
      version: 2,
      title,
      owner: locale.defaults.owner,
      aiDivergence: DEFAULT_AI_DIVERGENCE,
      noteFontScale: DEFAULT_NOTE_FONT_SCALE,
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
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    persistProjects(updated);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(BOARD_KEY_PREFIX + projectId);
      } catch {
        // Ignore storage removal failures.
      }
    }
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setBoard(null);
    }
  }

  function handleBackToHome() {
    setActiveProjectId(null);
    setBoard(null);
    lastSerializedRef.current = '';
  }

  // ─── Language ─────────────────────────────────────────────────────────────────

  function handleLanguageChange(nextLanguage) {
    const normalized = normalizeLanguage(nextLanguage);
    if (normalized === language) return;
    persistLanguage(normalized);
    setLanguage(normalized);
    setComposer((c) => ({ ...c, tag: remapSuggestedTag(c.tag, language, normalized) }));
    if (board) {
      setBoard((current) => {
        const cd = locale.defaults;
        const nd = getLocale(normalized).defaults;
        let changed = false;
        const next = { ...current };
        if ((current.title || '').trim() === cd.title) { next.title = nd.title; changed = true; }
        if ((current.owner || '').trim() === cd.owner) { next.owner = nd.owner; changed = true; }
        return changed ? touchBoard(next) : current;
      });
    }
    setNotice({ tone: 'info', text: getLocale(normalized).text.notices.languageSwitched });
  }

  // ─── Board handlers ───────────────────────────────────────────────────────────

  function handleBoardField(field, value, fallback) {
    setBoard((c) => touchBoard({ ...c, [field]: value.trim() || fallback }));
  }

  function handleAddNote(event) {
    event.preventDefault();
    const idea = composer.text.trim();
    if (!idea) return;
    const note = createNote({ text: idea, tag: composer.tag, author: board.owner, fallbackAuthor: locale.defaults.owner });
    setBoard((c) => appendNotes(c, [note]));
    setComposer((c) => ({ ...c, text: '' }));
    setNotice({ tone: 'success', text: text.notices.added });
  }

  async function handleGeneratePack() {
    setAiAssist((c) => ({ ...c, loading: true, reason: c.available === null ? 'checking' : c.reason }));
    try {
      const response = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          topic: board.title,
          prompt: { title: currentPrompt.title, prompt: currentPrompt.prompt, tag: currentPrompt.tag },
          aiDivergence,
          existingNotes: aiContextNotes.map((n) => ({ text: n.text, tag: n.tag, aiWeight: n.aiWeight })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
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
        .map((idea) => createNote({
          text: idea,
          tag: currentPrompt.tag,
          author: text.authors.ideaEngine,
          source: 'ai',
          fallbackAuthor: locale.defaults.owner,
        }));
      if (!generatedNotes.length) throw new Error(text.notices.aiRequestFailed(text.promptStatus.failed));
      const modelName = payload.model ?? fallbackModelName;
      setAiAssist({ available: true, loading: false, model: modelName, reason: 'ready' });
      startTransition(() => {
        setBoard((c) => appendNotes(c, generatedNotes));
        setNotice({ tone: 'success', text: text.notices.generated(modelName) });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : text.promptStatus.failed;
      const reason = error?.reason ?? 'generation_failed';
      const model = error?.model ?? fallbackModelName;
      setAiAssist((c) => ({
        ...c,
        available: reason === 'connection_failed' || reason === 'model_missing' ? false : c.available,
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
    setBoard((c) => appendNotes(c, [note]));
    setNotice({ tone: 'success', text: text.notices.promptPinned });
  }

  function handleVote(noteId, delta = 1) {
    setBoard((c) => patchNote(c, noteId, (n) => ({ votes: Math.max(0, n.votes + delta) })));
  }
  function handleAiWeightChange(noteId, aiWeight) {
    setBoard((c) => patchNote(c, noteId, () => ({ aiWeight: normalizeAiWeight(aiWeight) })));
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
  function handleArchiveToggle(noteId) { setBoard((c) => patchNote(c, noteId, (n) => ({ archived: !n.archived }))); }
  function handlePinToggle(noteId) { setBoard((c) => patchNote(c, noteId, (n) => ({ pinned: !n.pinned }))); }
  function handleSaveNote(noteId, updates, options = {}) {
    setBoard((c) => patchNote(c, noteId, () => ({ text: updates.text, tag: updates.tag })));
    if (!options.silent) {
      setNotice({ tone: 'success', text: text.notices.saved });
    }
  }
  function handleDeleteNote(noteId) {
    setBoard((c) => deleteNote(c, noteId));
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
      const imported = normalizeBoard(JSON.parse(fileText), language);
      startTransition(() => {
        setBoard(imported);
        setNotice({ tone: 'success', text: text.notices.imported });
      });
    } catch {
      setNotice({ tone: 'error', text: text.notices.importFailed });
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

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
                  onChange={(e) => setComposer((c) => ({ ...c, text: e.target.value }))}
                />
              </label>
              <div className="chip-row">
                {locale.tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    className={`chip ${composer.tag === tag ? 'chip--active' : ''}`}
                    type="button"
                    onClick={() => setComposer((c) => ({ ...c, tag }))}
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
                  onChange={(e) => setComposer((c) => ({ ...c, tag: e.target.value }))}
                  placeholder={text.quickPanel.tagPlaceholder}
                />
              </label>
              <button className="button button--accent button--full" type="submit">
                <Plus size={15} /> {text.quickPanel.submit}
              </button>
            </form>
          </section>

          <CollapsibleSection
            title={language === 'zh' ? 'AI 灵感引擎' : 'AI Idea Engine'}
            defaultOpen={true}
          >
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
                <button className="button button--ghost button--full" type="button" onClick={() => setPromptIndex((c) => (c + 1) % promptDeck.length)}>
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
          <CollapsibleSection
            title={`${text.filters.title} · ${text.filters.showing(visibleNotes.length)}`}
            defaultOpen={false}
          >
            <div className="filter-layout">
              <div className="segmented">
                <button className={filters.scope === 'active' ? 'is-active' : ''} type="button" onClick={() => setFilters((c) => ({ ...c, scope: 'active' }))}>
                  {text.filters.scopeActive}
                </button>
                <button className={filters.scope === 'archived' ? 'is-active' : ''} type="button" onClick={() => setFilters((c) => ({ ...c, scope: 'archived' }))}>
                  {text.filters.scopeArchived}
                </button>
              </div>
              <label className="field">
                <span className="field__label">{text.filters.searchLabel}</span>
                <input
                  className="field__control"
                  placeholder={text.filters.searchPlaceholder}
                  value={filters.search}
                  onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">{text.filters.sortLabel}</span>
                <select
                  className="field__control"
                  value={filters.sort}
                  onChange={(e) => setFilters((c) => ({ ...c, sort: e.target.value }))}
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
              <button className={`chip ${filters.tag === 'all' ? 'chip--active' : ''}`} type="button" onClick={() => setFilters((c) => ({ ...c, tag: 'all' }))}>
                {text.filters.allTags}
              </button>
              {tagOptions.map((tag) => (
                <button key={tag} className={`chip ${filters.tag === tag ? 'chip--active' : ''}`} type="button" onClick={() => setFilters((c) => ({ ...c, tag }))}>
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
                  onFilterTag={(tag) => setFilters((c) => ({ ...c, scope: 'active', tag: tag || 'all' }))}
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
            <StatCard label={text.stats.topVotesLabel} value={activeNotes.reduce((m, n) => Math.max(m, n.votes), 0)} hint={text.stats.topVotesHint} />
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
