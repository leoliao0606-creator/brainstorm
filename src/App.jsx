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
const LANGUAGE_STORAGE_KEY = 'brainstorm:studio:language';
const DEFAULT_LANGUAGE = 'zh';

const LOCALE_CONFIG = {
  zh: {
    htmlLang: 'zh-CN',
    dateLocale: 'zh-CN',
    sortLocale: 'zh-Hans-CN',
    defaults: {
      title: '新产品头脑风暴',
      owner: '主持人',
    },
    tagSuggestions: ['产品', '增长', '体验', '技术', '运营', '商业'],
    promptDeck: [
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
    ],
    ideaBlocks: {
      leadIns: ['试着让', '把', '围绕', '为'],
      audiences: [
        '第一次接触的用户',
        '已经感兴趣却没转化的人',
        '高价值客户',
        '最容易流失的用户',
        '内部运营团队',
      ],
      moves: [
        '压缩成 30 秒体验',
        '改成一句承诺就能说清的方案',
        '拆成可以分享的小片段',
        '做成无需下载的试点',
        '变成高频可回流的触点',
      ],
      constraints: [
        '先不用新增研发投入',
        '只改文案与节奏',
        '先用人工兜底',
        '两天内能上线',
        '只服务一个细分场景',
      ],
      proofs: ['转化率', '完成率', '复访率', '用户主动提及率', '口碑反馈'],
      outputs: [
        '一张落地页草图',
        '一段上手引导',
        '一个 concierge 流程',
        '一组对比卡片',
        '一个候补名单实验',
      ],
    },
    buildIdea({
      focus,
      leadIn,
      audience,
      move,
      constraint,
      proof,
      output,
    }) {
      return `${leadIn}${focus}面向${audience}${move}，${constraint}，并用${proof}验证${output}`;
    },
    text: {
      documentTitle: 'Brainstorm Studio | 双语头脑风暴板',
      documentDescription:
        '支持中英文切换的头脑风暴工作板，提供自动保存、同步、筛选和 JSON 导入导出。',
      languageLabel: '语言',
      languageOptions: {
        zh: '中文',
        en: 'EN',
      },
      appEyebrow: '可直接主持的 Brainstorm Studio',
      titleSr: '工作板标题',
      hostSr: '主持人名称',
      description:
        '一个可直接拿来主持讨论的灵感板。支持中英文切换、本地自动保存、跨标签页同步、按标签筛选，以及 JSON 导入导出。',
      autosaved: (time) => `已自动保存 · ${time}`,
      justCreated: '刚创建',
      timeMissing: '未记录时间',
      topTagFallback: '等待聚类',
      stats: {
        activeLabel: '活跃卡片',
        activeHint: '当前参与筛选与投票',
        archivedLabel: '归档卡片',
        archivedHint: '沉淀过的历史方向',
        topVotesLabel: '最高票数',
        topVotesHint: '方便会后优先排期',
        topTagLabel: '最热标签',
        topTagHint: '现在最集中的讨论区',
      },
      promptActions: {
        rotate: '换一张题卡',
        pin: '贴到墙上',
        generate: '补 5 张热身卡',
      },
      quickPanel: {
        eyebrow: '快速记录',
        title: '立刻贴一张',
        hint: '手动输入适合现场主持。',
        ideaLabel: '想法内容',
        ideaPlaceholder: '把一句值得被讨论的想法写下来。',
        tagLabel: '标签',
        tagPlaceholder: '例如：产品、增长、商业',
        submit: '贴上去',
      },
      opsPanel: {
        eyebrow: '工作板管理',
        title: '搬运与交接',
        hint: '把工作板带到别的机器或会前准备里。',
        export: '导出当前 JSON',
        import: '导入已有工作板',
      },
      filters: {
        eyebrow: '筛选控制',
        title: '筛选与排序',
        showing: (count) => `当前显示 ${count} 张卡片`,
        scopeActive: '活跃',
        scopeArchived: '归档',
        searchLabel: '搜索',
        searchPlaceholder: '按内容、作者或标签检索',
        sortLabel: '排序',
        sortRecent: '最近更新',
        sortVotes: '票数优先',
        sortTag: '按标签',
        allTags: '全部标签',
      },
      empty: {
        eyebrow: '墙上还没有内容',
        activeTitle: '还没有符合条件的卡片',
        activeDescription:
          '可以手动贴一张，或者用右上角题卡快速生成一组热身灵感。',
        archivedTitle: '归档区还是空的',
        archivedDescription: '把成熟或暂缓的方向归档后，它们会出现在这里。',
      },
      noteCard: {
        untagged: '未分类',
        pinned: '置顶',
        tagPlaceholder: '标签',
        pin: '置顶',
        unpin: '取消置顶',
        archive: '归档',
        restore: '恢复',
        save: '保存',
        cancel: '取消',
        edit: '编辑',
        delete: '删除',
      },
      authors: {
        ideaEngine: '灵感引擎',
        promptHost: '主持人提示',
      },
      notices: {
        sync: '已同步其他标签页里的最新内容。',
        syncReset: '共享板已被清空，当前视图已重置。',
        syncInvalid: '收到了一份损坏的同步数据，已忽略。',
        added: '新卡片已经贴到墙上。',
        generated: '已基于题卡补了 5 张热身卡。',
        promptPinned: '题卡已经贴到墙上作为讨论锚点。',
        saved: '卡片内容已更新。',
        deleted: '卡片已移除。',
        exported: '已导出当前工作板 JSON。',
        imported: '导入完成，当前工作板已替换。',
        importFailed: '导入失败，请确认文件是有效的 JSON 工作板。',
        languageSwitched: '界面语言已切换为中文。',
      },
    },
  },
  en: {
    htmlLang: 'en',
    dateLocale: 'en-US',
    sortLocale: 'en-US',
    defaults: {
      title: 'New Product Brainstorm',
      owner: 'Host',
    },
    tagSuggestions: ['Product', 'Growth', 'Experience', 'Tech', 'Operations', 'Business'],
    promptDeck: [
      {
        id: 'first-minute',
        kicker: 'Remove Friction',
        title: 'Make The First Minute Lighter',
        prompt:
          'If a user only gave you 60 seconds, which step would you remove so they reach value faster?',
        tag: 'Experience',
      },
      {
        id: 'show-value',
        kicker: 'Lead With Value',
        title: 'Let The Promise Speak First',
        prompt:
          'Which result deserves to appear in the first three screens instead of waiting for users to discover it?',
        tag: 'Business',
      },
      {
        id: 'opposite-play',
        kicker: 'Reverse It',
        title: 'Flip The Industry Default',
        prompt:
          'If you deliberately did the opposite of the standard industry flow, what sharper experience would appear?',
        tag: 'Strategy',
      },
      {
        id: 'human-touch',
        kicker: 'More Human',
        title: 'Add Warmth To The Flow',
        prompt:
          'Which step should move from cold automation to a human gesture users would actually remember?',
        tag: 'Service',
      },
      {
        id: 'tiny-bet',
        kicker: 'Tiny Bet',
        title: 'Validate With The Smallest Move',
        prompt:
          'What is the smallest prototype you could test this week instead of building the full version first?',
        tag: 'Experiment',
      },
    ],
    ideaBlocks: {
      leadIns: ['Reframe', 'Design', 'Shape', 'Turn'],
      audiences: [
        'first-time users',
        'interested leads who have not converted',
        'high-value customers',
        'users most likely to churn',
        'internal operations teams',
      ],
      moves: [
        'into a 30-second experience',
        'into a one-line promise',
        'into shareable micro moments',
        'into a no-download pilot',
        'into a high-frequency return loop',
      ],
      constraints: [
        'without adding engineering scope first',
        'by only changing copy and pacing',
        'with a concierge step before automation',
        'in something you can ship within two days',
        'for one narrow segment first',
      ],
      proofs: [
        'conversion rate',
        'completion rate',
        'repeat usage',
        'unsolicited user mentions',
        'qualitative feedback',
      ],
      outputs: [
        'a landing page sketch',
        'a first-run onboarding flow',
        'a concierge workflow',
        'a set of comparison cards',
        'a waitlist experiment',
      ],
    },
    buildIdea({
      focus,
      leadIn,
      audience,
      move,
      constraint,
      proof,
      output,
    }) {
      return `${leadIn} ${focus} for ${audience} ${move}, ${constraint}, and validate it with ${proof} through ${output}.`;
    },
    text: {
      documentTitle: 'Brainstorm Studio | Bilingual Idea Board',
      documentDescription:
        'A bilingual brainstorm board with free language switching, autosave, sync, filters, and JSON import or export.',
      languageLabel: 'Language',
      languageOptions: {
        zh: '中文',
        en: 'EN',
      },
      appEyebrow: 'Workshop-ready Brainstorm Studio',
      titleSr: 'Board title',
      hostSr: 'Host name',
      description:
        'A facilitation-friendly idea wall with free Chinese and English switching, local autosave, cross-tab sync, filters, and JSON import or export.',
      autosaved: (time) => `Autosaved · ${time}`,
      justCreated: 'Just created',
      timeMissing: 'No timestamp',
      topTagFallback: 'Waiting for a cluster',
      stats: {
        activeLabel: 'Active Cards',
        activeHint: 'Currently in the working set',
        archivedLabel: 'Archived Cards',
        archivedHint: 'Ideas parked for later',
        topVotesLabel: 'Top Votes',
        topVotesHint: 'Useful for prioritization',
        topTagLabel: 'Hottest Tag',
        topTagHint: 'Where discussion is clustering',
      },
      promptActions: {
        rotate: 'Next prompt card',
        pin: 'Pin to wall',
        generate: 'Generate 5 warm-up cards',
      },
      quickPanel: {
        eyebrow: 'Quick Capture',
        title: 'Post A Card Now',
        hint: 'Manual capture works well during live facilitation.',
        ideaLabel: 'Idea',
        ideaPlaceholder: 'Write one idea worth discussing.',
        tagLabel: 'Tag',
        tagPlaceholder: 'For example: Product, Growth, Business',
        submit: 'Post it',
      },
      opsPanel: {
        eyebrow: 'Board Ops',
        title: 'Move And Handoff',
        hint: 'Carry this board into prep work or another device.',
        export: 'Export current JSON',
        import: 'Import saved board',
      },
      filters: {
        eyebrow: 'Signal Control',
        title: 'Filter And Sort',
        showing: (count) => `Showing ${count} cards`,
        scopeActive: 'Active',
        scopeArchived: 'Archived',
        searchLabel: 'Search',
        searchPlaceholder: 'Search by content, author, or tag',
        sortLabel: 'Sort',
        sortRecent: 'Recently updated',
        sortVotes: 'Most votes',
        sortTag: 'By tag',
        allTags: 'All tags',
      },
      empty: {
        eyebrow: 'Nothing on the wall',
        activeTitle: 'No cards match this view yet',
        activeDescription:
          'Post one manually, or use the prompt card on the right to generate a warm-up pack.',
        archivedTitle: 'The archive is still empty',
        archivedDescription:
          'Archived ideas will appear here once you park mature or paused directions.',
      },
      noteCard: {
        untagged: 'Untagged',
        pinned: 'Pinned',
        tagPlaceholder: 'Tag',
        pin: 'Pin',
        unpin: 'Unpin',
        archive: 'Archive',
        restore: 'Restore',
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        delete: 'Delete',
      },
      authors: {
        ideaEngine: 'Idea Engine',
        promptHost: 'Prompt Host',
      },
      notices: {
        sync: 'Synced the latest board state from another tab.',
        syncReset: 'The shared board was cleared, so this view has been reset.',
        syncInvalid: 'Ignored a corrupted board payload from storage sync.',
        added: 'The new card is on the wall.',
        generated: 'Added 5 warm-up cards from the current prompt.',
        promptPinned: 'The prompt card is now pinned as a discussion anchor.',
        saved: 'Card content updated.',
        deleted: 'Card removed.',
        exported: 'Exported the current board as JSON.',
        imported: 'Import complete. The current board was replaced.',
        importFailed: 'Import failed. Please use a valid board JSON file.',
        languageSwitched: 'Interface language switched to English.',
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
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) return normalizeLanguage(storedLanguage);
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
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  } catch {
    // Ignore localStorage write failures.
  }
}

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

function createNote({
  text,
  tag = '',
  author = '',
  pinned = false,
  fallbackAuthor = getLocale(DEFAULT_LANGUAGE).defaults.owner,
}) {
  const stamp = Date.now();
  return {
    id: createId(),
    text: text.trim(),
    tag: tag.trim(),
    author: author.trim() || fallbackAuthor,
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

function normalizeNote(rawNote, index, language) {
  const text = normalizeText(rawNote?.text).trim();
  if (!text) return null;

  const locale = getLocale(language);
  const createdAt = normalizeTimestamp(rawNote?.createdAt, index);
  const updatedAt = normalizeTimestamp(rawNote?.updatedAt, createdAt);

  return {
    id: normalizeText(rawNote?.id, `legacy-${index}`),
    text,
    tag: normalizeText(rawNote?.tag ?? rawNote?.tags?.[0]).trim(),
    author:
      normalizeText(rawNote?.author ?? rawNote?.userName, locale.defaults.owner).trim() ||
      locale.defaults.owner,
    votes: normalizeTimestamp(rawNote?.votes, 0),
    archived: Boolean(rawNote?.archived),
    pinned: Boolean(rawNote?.pinned),
    createdAt,
    updatedAt,
  };
}

function normalizeBoard(rawBoard, language = DEFAULT_LANGUAGE) {
  const locale = getLocale(language);
  const notes = Array.isArray(rawBoard?.notes)
    ? rawBoard.notes.map((note, index) => normalizeNote(note, index, language)).filter(Boolean)
    : [];

  return {
    version: 2,
    title: normalizeText(rawBoard?.title, locale.defaults.title).trim() || locale.defaults.title,
    owner:
      normalizeText(rawBoard?.owner ?? rawBoard?.userName, locale.defaults.owner).trim() ||
      locale.defaults.owner,
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

function createInitialBoard(language = DEFAULT_LANGUAGE) {
  const locale = getLocale(language);
  return touchBoard({
    version: 2,
    title: locale.defaults.title,
    owner: locale.defaults.owner,
    notes: [],
  });
}

function loadBoard(language = DEFAULT_LANGUAGE) {
  if (typeof window === 'undefined') {
    return createInitialBoard(language);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialBoard(language);
    return normalizeBoard(JSON.parse(raw), language);
  } catch {
    return createInitialBoard(language);
  }
}

function persistBoard(serializedBoard) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, serializedBoard);
}

function formatDate(language, timestamp, options, fallback) {
  if (!timestamp) return fallback;

  return new Intl.DateTimeFormat(getLocale(language).dateLocale, options).format(
    new Date(timestamp)
  );
}

function formatClock(language, timestamp) {
  return formatDate(
    language,
    timestamp,
    { hour: '2-digit', minute: '2-digit' },
    getLocale(language).text.justCreated
  );
}

function formatNoteTime(language, timestamp) {
  return formatDate(
    language,
    timestamp,
    { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    getLocale(language).text.timeMissing
  );
}

function createIdeaBurst(language, topic, promptCard, count, offset) {
  const locale = getLocale(language);
  const focus = topic.trim() || locale.defaults.title;
  const ideas = [];
  let cursor = 0;

  while (ideas.length < count && cursor < count * 4) {
    const key = `${focus}:${promptCard.id}:${offset}:${cursor}`;
    const sentence = locale.buildIdea({
      focus,
      leadIn: pickFrom(locale.ideaBlocks.leadIns, `${key}:lead`),
      audience: pickFrom(locale.ideaBlocks.audiences, `${key}:audience`),
      move: pickFrom(locale.ideaBlocks.moves, `${key}:move`),
      constraint: pickFrom(locale.ideaBlocks.constraints, `${key}:constraint`),
      proof: pickFrom(locale.ideaBlocks.proofs, `${key}:proof`),
      output: pickFrom(locale.ideaBlocks.outputs, `${key}:output`),
    });

    if (!ideas.includes(sentence)) {
      ideas.push(sentence);
    }
    cursor += 1;
  }

  return ideas;
}

function downloadBoard(board) {
  if (typeof window === 'undefined') return;

  const fileName =
    `${board.title || getLocale(DEFAULT_LANGUAGE).defaults.title}`
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 24) || 'brainstorm-board';
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

function sortNotes(notes, sortBy, language) {
  const sorted = [...notes];
  const locale = getLocale(language);

  sorted.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    if (sortBy === 'votes') {
      return right.votes - left.votes || right.updatedAt - left.updatedAt;
    }

    if (sortBy === 'tag') {
      return left.tag.localeCompare(right.tag, locale.sortLocale) || right.updatedAt - left.updatedAt;
    }

    return right.updatedAt - left.updatedAt;
  });

  return sorted;
}

function remapSuggestedTag(tag, fromLanguage, toLanguage) {
  const sourceTags = getLocale(fromLanguage).tagSuggestions;
  const targetTags = getLocale(toLanguage).tagSuggestions;
  const index = sourceTags.indexOf(tag);

  if (index === -1) return tag;
  return targetTags[index] ?? tag;
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
}) {
  const copy = getLocale(language).text.noteCard;
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
          {note.tag || copy.untagged}
        </button>
        {note.pinned ? <span className="note-card__pin">{copy.pinned}</span> : null}
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
            placeholder={copy.tagPlaceholder}
          />
        </div>
      ) : (
        <p className="note-card__body">{note.text}</p>
      )}

      <footer className="note-card__meta">
        <span>{note.author}</span>
        <span>{formatNoteTime(language, note.updatedAt || note.createdAt)}</span>
      </footer>

      <div className="note-card__actions">
        <button className="mini-button" type="button" onClick={() => onVote(note.id)}>
          <Vote size={15} />
          {note.votes}
        </button>
        <button className="mini-button" type="button" onClick={() => onPinToggle(note.id)}>
          {note.pinned ? copy.unpin : copy.pin}
        </button>
        <button className="mini-button" type="button" onClick={() => onArchiveToggle(note.id)}>
          {note.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          {note.archived ? copy.restore : copy.archive}
        </button>
        {editing ? (
          <>
            <button className="mini-button mini-button--accent" type="button" onClick={submitEdit}>
              <Check size={15} />
              {copy.save}
            </button>
            <button className="mini-button" type="button" onClick={() => setEditing(false)}>
              <X size={15} />
              {copy.cancel}
            </button>
          </>
        ) : (
          <button className="mini-button" type="button" onClick={beginEdit}>
            <Pencil size={15} />
            {copy.edit}
          </button>
        )}
        <button
          className="mini-button mini-button--danger"
          type="button"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 size={15} />
          {copy.delete}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [language, setLanguage] = useState(loadLanguage);
  const [board, setBoard] = useState(() => loadBoard(language));
  const [composer, setComposer] = useState(() => ({
    text: '',
    tag: getLocale(language).tagSuggestions[0],
  }));
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

  const locale = getLocale(language);
  const text = locale.text;
  const tagSuggestions = locale.tagSuggestions;
  const sortLocale = locale.sortLocale;
  const topTagFallback = text.topTagFallback;
  const promptDeck = locale.promptDeck;

  const activeNotes = useMemo(
    () => board.notes.filter((note) => !note.archived),
    [board.notes]
  );
  const archivedNotes = useMemo(
    () => board.notes.filter((note) => note.archived),
    [board.notes]
  );
  const tagOptions = [...new Set(board.notes.map((note) => note.tag).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, sortLocale)
  );
  const topTag = (() => {
    const counts = new Map();
    activeNotes.forEach((note) => {
      if (!note.tag) return;
      counts.set(note.tag, (counts.get(note.tag) || 0) + 1);
    });

    let winner = topTagFallback;
    let max = 0;
    counts.forEach((count, tag) => {
      if (count > max) {
        winner = tag;
        max = count;
      }
    });
    return winner;
  })();
  const currentPrompt = promptDeck[promptIndex % promptDeck.length];
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

    return sortNotes(filtered, filters.sort, language);
  }, [
    activeNotes,
    archivedNotes,
    deferredSearch,
    filters.scope,
    filters.sort,
    filters.tag,
    language,
  ]);

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
        handleBoardReset();
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

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.lang = locale.htmlLang;
    document.title = text.documentTitle;

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', text.documentDescription);
    }
  }, [locale.htmlLang, text.documentDescription, text.documentTitle]);

  function handleLanguageChange(nextLanguage) {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    if (normalizedLanguage === language) return;

    persistLanguage(normalizedLanguage);
    setLanguage(normalizedLanguage);
    setComposer((current) => ({
      ...current,
      tag: remapSuggestedTag(current.tag, language, normalizedLanguage),
    }));
    setBoard((current) => {
      const currentDefaults = locale.defaults;
      const nextDefaults = getLocale(normalizedLanguage).defaults;
      let changed = false;
      const nextBoard = { ...current };

      if ((current.title || '').trim() === currentDefaults.title) {
        nextBoard.title = nextDefaults.title;
        changed = true;
      }

      if ((current.owner || '').trim() === currentDefaults.owner) {
        nextBoard.owner = nextDefaults.owner;
        changed = true;
      }

      return changed ? touchBoard(nextBoard) : current;
    });
    setNotice({
      tone: 'info',
      text: getLocale(normalizedLanguage).text.notices.languageSwitched,
    });
  }

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
    const idea = composer.text.trim();
    if (!idea) return;

    const note = createNote({
      text: idea,
      tag: composer.tag,
      author: board.owner,
      fallbackAuthor: locale.defaults.owner,
    });

    setBoard((current) => appendNotes(current, [note]));
    setComposer((current) => ({ ...current, text: '' }));
    setNotice({ tone: 'success', text: text.notices.added });
  }

  function handleGeneratePack() {
    const generatedNotes = createIdeaBurst(
      language,
      board.title,
      currentPrompt,
      5,
      burstCursor
    ).map((idea) =>
      createNote({
        text: idea,
        tag: currentPrompt.tag,
        author: text.authors.ideaEngine,
        fallbackAuthor: locale.defaults.owner,
      })
    );

    startTransition(() => {
      setBoard((current) => appendNotes(current, generatedNotes));
      setBurstCursor((current) => current + 1);
      setNotice({ tone: 'success', text: text.notices.generated });
    });
  }

  function handlePinPrompt() {
    const promptNote = createNote({
      text: currentPrompt.prompt,
      tag: currentPrompt.tag,
      author: text.authors.promptHost,
      pinned: true,
      fallbackAuthor: locale.defaults.owner,
    });

    setBoard((current) => appendNotes(current, [promptNote]));
    setNotice({ tone: 'success', text: text.notices.promptPinned });
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
    setNotice({ tone: 'success', text: text.notices.saved });
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
      const importedBoard = normalizeBoard(JSON.parse(fileText), language);

      startTransition(() => {
        setBoard(importedBoard);
        setNotice({ tone: 'success', text: text.notices.imported });
      });
    } catch {
      setNotice({ tone: 'error', text: text.notices.importFailed });
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--one" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--two" aria-hidden="true" />
      <div className="app-shell__grid" aria-hidden="true" />

      <header className="hero">
        <div className="hero__copy">
          <span className="eyebrow">{text.appEyebrow}</span>
          <label className="hero__title-wrap">
            <span className="sr-only">{text.titleSr}</span>
            <input
              className="hero__title"
              value={board.title}
              onChange={(event) =>
                handleBoardField('title', event.target.value, locale.defaults.title)
              }
            />
          </label>
          <p className="hero__description">{text.description}</p>

          <div className="hero__meta">
            <div className="language-switch">
              <span className="language-switch__label">{text.languageLabel}</span>
              <div className="segmented">
                {Object.entries(text.languageOptions).map(([languageKey, label]) => (
                  <button
                    key={languageKey}
                    className={language === languageKey ? 'is-active' : ''}
                    type="button"
                    onClick={() => handleLanguageChange(languageKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="presence-card">
              <Users size={18} />
              <span className="sr-only">{text.hostSr}</span>
              <input
                className="presence-card__input"
                value={board.owner}
                onChange={(event) =>
                  handleBoardField('owner', event.target.value, locale.defaults.owner)
                }
              />
            </label>

            <span className="autosave-pill">
              <RefreshCw size={15} />
              {text.autosaved(formatClock(language, board.updatedAt))}
            </span>
          </div>

          <div className="stats-grid">
            <StatCard
              label={text.stats.activeLabel}
              value={activeNotes.length}
              hint={text.stats.activeHint}
            />
            <StatCard
              label={text.stats.archivedLabel}
              value={archivedNotes.length}
              hint={text.stats.archivedHint}
            />
            <StatCard
              label={text.stats.topVotesLabel}
              value={activeNotes.reduce((max, note) => Math.max(max, note.votes), 0)}
              hint={text.stats.topVotesHint}
            />
            <StatCard
              label={text.stats.topTagLabel}
              value={topTag}
              hint={text.stats.topTagHint}
            />
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
              onClick={() => setPromptIndex((current) => (current + 1) % promptDeck.length)}
            >
              <RefreshCw size={16} />
              {text.promptActions.rotate}
            </button>
            <button className="button button--secondary" type="button" onClick={handlePinPrompt}>
              <Plus size={16} />
              {text.promptActions.pin}
            </button>
            <button className="button button--accent" type="button" onClick={handleGeneratePack}>
              <WandSparkles size={16} />
              {text.promptActions.generate}
            </button>
          </div>
        </aside>
      </header>

      {notice ? <div className={`notice notice--${notice.tone}`}>{notice.text}</div> : null}

      <main className="workspace">
        <aside className="workspace__aside">
          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">{text.quickPanel.eyebrow}</span>
                <h3>{text.quickPanel.title}</h3>
              </div>
              <span className="panel__hint">{text.quickPanel.hint}</span>
            </div>

            <form className="stack" onSubmit={handleAddNote}>
              <label className="field">
                <span className="field__label">{text.quickPanel.ideaLabel}</span>
                <textarea
                  className="field__control field__control--textarea"
                  placeholder={text.quickPanel.ideaPlaceholder}
                  value={composer.text}
                  onChange={(event) =>
                    setComposer((current) => ({ ...current, text: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">{text.quickPanel.tagLabel}</span>
                <input
                  className="field__control"
                  value={composer.tag}
                  onChange={(event) =>
                    setComposer((current) => ({ ...current, tag: event.target.value }))
                  }
                  placeholder={text.quickPanel.tagPlaceholder}
                />
              </label>

              <div className="chip-row">
                {tagSuggestions.map((tag) => (
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
                {text.quickPanel.submit}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">{text.opsPanel.eyebrow}</span>
                <h3>{text.opsPanel.title}</h3>
              </div>
              <span className="panel__hint">{text.opsPanel.hint}</span>
            </div>

            <div className="stack">
              <button
                className="button button--secondary button--full"
                type="button"
                onClick={handleExportBoard}
              >
                <Download size={16} />
                {text.opsPanel.export}
              </button>

              <label
                className="button button--ghost button--full upload-button"
                htmlFor={importInputId}
              >
                <Upload size={16} />
                {text.opsPanel.import}
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
                <span className="eyebrow">{text.filters.eyebrow}</span>
                <h3>{text.filters.title}</h3>
              </div>
              <span className="panel__hint">{text.filters.showing(visibleNotes.length)}</span>
            </div>

            <div className="filter-layout">
              <div className="segmented">
                <button
                  className={filters.scope === 'active' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, scope: 'active' }))}
                >
                  {text.filters.scopeActive}
                </button>
                <button
                  className={filters.scope === 'archived' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, scope: 'archived' }))}
                >
                  {text.filters.scopeArchived}
                </button>
              </div>

              <label className="field">
                <span className="field__label">{text.filters.searchLabel}</span>
                <input
                  className="field__control"
                  placeholder={text.filters.searchPlaceholder}
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">{text.filters.sortLabel}</span>
                <select
                  className="field__control"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, sort: event.target.value }))
                  }
                >
                  <option value="recent">{text.filters.sortRecent}</option>
                  <option value="votes">{text.filters.sortVotes}</option>
                  <option value="tag">{text.filters.sortTag}</option>
                </select>
              </label>
            </div>

            <div className="chip-row chip-row--spacious">
              <button
                className={`chip ${filters.tag === 'all' ? 'chip--active' : ''}`}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, tag: 'all' }))}
              >
                {text.filters.allTags}
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
                  language={language}
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
              <span className="empty-state__eyebrow">{text.empty.eyebrow}</span>
              <h3>
                {filters.scope === 'archived'
                  ? text.empty.archivedTitle
                  : text.empty.activeTitle}
              </h3>
              <p>
                {filters.scope === 'archived'
                  ? text.empty.archivedDescription
                  : text.empty.activeDescription}
              </p>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
