export const LANGUAGE_KEY = 'brainstorm:studio:language';
export const DEFAULT_LANGUAGE = 'zh';

const LOCALE_CONFIG = {
  zh: {
    htmlLang: 'zh-CN',
    dateLocale: 'zh-CN',
    sortLocale: 'zh-Hans-CN',
    defaults: {
      title: '新头脑风暴主题',
      owner: '我',
    },
    tagSuggestions: ['想法', '问题', '计划', '资源', '风险', '行动', '其他'],
    promptDeck: [
      {
        id: 'explore-options',
        kicker: '拓展选项',
        title: '还有哪些可能',
        prompt: '围绕当前主题，列出几种不同类型的可选方向：轻松的、特别的、实用的，以及有惊喜感的。',
        tag: '想法',
      },
      {
        id: 'clarify-context',
        kicker: '补条件',
        title: '哪些条件会改变答案',
        prompt: '时间、预算、地点、人数、偏好、限制或目标里，哪些信息会明显影响接下来的选择？',
        tag: '问题',
      },
      {
        id: 'find-resources',
        kicker: '找资源',
        title: '可以借助什么',
        prompt: '现在有哪些信息、资源、联系人、工具、地点或已有经验可以帮你推进？还缺什么关键资料？',
        tag: '资源',
      },
      {
        id: 'spot-risks',
        kicker: '看风险',
        title: '哪里可能踩坑',
        prompt: '哪些安排、假设或选择最容易出问题？有没有更稳妥的替代方案或预案？',
        tag: '风险',
      },
      {
        id: 'next-actions',
        kicker: '下一步',
        title: '马上能做什么',
        prompt: '下一步可以具体做什么？列出能马上查、问、预订、准备、测试或决定的动作。',
        tag: '行动',
      },
    ],
    text: {
      documentTitle: 'Brainstorm Studio | 头脑风暴工作板',
      documentDescription: '适合旅行、学习、活动、生活安排和项目讨论的通用头脑风暴工具。',
      languageLabel: '语言',
      languageOptions: { zh: '中文', en: 'EN' },
      titleSr: '主题标题',
      hostSr: '作者名称',
      autosaved: (time) => `已保存 · ${time}`,
      justCreated: '刚创建',
      timeMissing: '未记录',
      topTagFallback: '等待聚类',
      backToHome: '返回工作板',
      undo: {
        button: '撤销',
        empty: '没有可撤销的操作。',
        delete: '删除便签',
        archive: '归档便签',
        restore: '恢复便签',
        import: '导入覆盖',
      },
      aiSettings: {
        button: 'AI 设置',
        eyebrow: '模型设置',
        title: 'AI 模型设置',
        close: '关闭设置',
        statusLabel: '连接状态',
        modelLabel: 'Ollama 模型',
        modelPlaceholder: '例如 gemma4:e4b-it-q4_K_M',
        baseUrlLabel: 'Ollama Base URL',
        baseUrlPlaceholder: 'http://127.0.0.1:11434',
        countLabel: '生成条数',
        languageLabel: '语言偏好',
        languageOptions: { auto: '跟随界面', zh: '中文', en: 'English' },
        refresh: '刷新模型',
        cancel: '取消',
        save: '保存设置',
      },
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
        generate: (count) => `让 AI 补 ${count} 条`,
        generating: 'AI 思考中...',
      },
      promptStatus: {
        label: 'AI 辅助',
        checking: '正在检查本地 Ollama...',
        ready: (model) => `已连接 · ${model}`,
        modelMissing: (model) => `Ollama 已启动，但没有找到 ${model}`,
        offline: '本地 Ollama 当前不可达',
        failed: 'AI 生成失败，请稍后再试',
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
        tagPlaceholder: '例如：想法、行动',
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
        activeDescription: '在左侧输入你的第一个想法，或者让 AI 帮你热个身。',
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
        generating: 'AI 正在生成...',
        generatingBadge: '生成中',
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
        generated: (model, count) => `${model} 补充了 ${count} 条新想法。`,
        promptPinned: '引导提示已贴到墙上。',
        saved: '便签内容已更新。',
        archived: '便签已归档，可撤销。',
        restored: '便签已恢复，可撤销。',
        deleted: '便签已移除，可撤销。',
        exported: '已导出工作板 JSON。',
        imported: '导入完成，当前工作板已替换，可撤销。',
        importFailed: '导入失败，请确认文件是有效的 JSON 工作板。',
        languageSwitched: '界面语言已切换为中文。',
        aiSettingsSaved: 'AI 模型设置已保存。',
        aiConnectionFailed: '连接本地 Ollama 失败，请确认 `ollama serve` 正在运行。',
        aiModelMissing: (model) => `本地 Ollama 已连接，但没有找到模型 ${model}。`,
        aiRequestFailed: (message) => `AI 生成失败：${message}`,
        undone: (label) => `已撤销：${label}。`,
      },
      home: {
        tagline: '把零散想法整理成清晰方向',
        newProject: '新建主题',
        newProjectPlaceholder: '这次头脑风暴的主题是...',
        createProject: '创建',
        cancel: '取消',
        notesCount: (n) => `${n} 张便签`,
        emptyTitle: '还没有主题',
        emptyHint: '创建第一个主题，开始头脑风暴吧。',
        confirmDelete: '确认删除？',
      },
    },
  },
  en: {
    htmlLang: 'en',
    dateLocale: 'en-US',
    sortLocale: 'en-US',
    defaults: {
      title: 'New Brainstorm Topic',
      owner: 'Me',
    },
    tagSuggestions: ['Idea', 'Question', 'Plan', 'Resource', 'Risk', 'Action', 'Other'],
    promptDeck: [
      {
        id: 'explore-options',
        kicker: 'Explore',
        title: 'What Else Is Possible',
        prompt: 'List several different directions around the current topic: easy, unusual, practical, and pleasantly surprising.',
        tag: 'Idea',
      },
      {
        id: 'clarify-context',
        kicker: 'Clarify',
        title: 'What Conditions Change The Answer',
        prompt: 'Which details about time, budget, place, people, preferences, constraints, or goals would change the best next choice?',
        tag: 'Question',
      },
      {
        id: 'find-resources',
        kicker: 'Resources',
        title: 'What Can Help',
        prompt: 'What information, resources, people, tools, places, or prior experience could help move this forward? What key facts are missing?',
        tag: 'Resource',
      },
      {
        id: 'spot-risks',
        kicker: 'Risks',
        title: 'Where Could This Go Wrong',
        prompt: 'Which plans, assumptions, or choices are most likely to fail? What safer alternatives or backups would keep options open?',
        tag: 'Risk',
      },
      {
        id: 'next-actions',
        kicker: 'Next Step',
        title: 'What Can Happen Now',
        prompt: 'What concrete next actions can you take: search, ask, book, prepare, test, compare, or decide?',
        tag: 'Action',
      },
    ],
    text: {
      documentTitle: 'Brainstorm Studio | Brainstorm Board',
      documentDescription: 'A general brainstorming tool for travel, learning, events, life planning, and project discussions.',
      languageLabel: 'Language',
      languageOptions: { zh: '中文', en: 'EN' },
      titleSr: 'Topic title',
      hostSr: 'Author name',
      autosaved: (time) => `Saved · ${time}`,
      justCreated: 'Just created',
      timeMissing: 'No timestamp',
      topTagFallback: 'Waiting for a cluster',
      backToHome: 'Back to boards',
      undo: {
        button: 'Undo',
        empty: 'There is nothing to undo.',
        delete: 'delete note',
        archive: 'archive note',
        restore: 'restore note',
        import: 'import overwrite',
      },
      aiSettings: {
        button: 'AI Settings',
        eyebrow: 'Model Settings',
        title: 'AI Model Settings',
        close: 'Close settings',
        statusLabel: 'Connection status',
        modelLabel: 'Ollama model',
        modelPlaceholder: 'e.g. gemma4:e4b-it-q4_K_M',
        baseUrlLabel: 'Ollama base URL',
        baseUrlPlaceholder: 'http://127.0.0.1:11434',
        countLabel: 'Ideas per generation',
        languageLabel: 'Language preference',
        languageOptions: { auto: 'Follow UI', zh: '中文', en: 'English' },
        refresh: 'Refresh models',
        cancel: 'Cancel',
        save: 'Save settings',
      },
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
        generate: (count) => `Ask AI for ${count} more`,
        generating: 'AI is thinking...',
      },
      promptStatus: {
        label: 'AI Assist',
        checking: 'Checking local Ollama...',
        ready: (model) => `Connected · ${model}`,
        modelMissing: (model) => `Ollama is running but ${model} is missing`,
        offline: 'Local Ollama is unreachable',
        failed: 'AI generation failed. Try again.',
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
        tagPlaceholder: 'e.g. Idea, Action',
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
        activeDescription: 'Type your first idea on the left, or let AI warm things up.',
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
        generating: 'AI is generating...',
        generatingBadge: 'Generating',
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
        generated: (model, count) => `${model} added ${count} new idea${count === 1 ? '' : 's'}.`,
        promptPinned: 'Prompt pinned to the wall.',
        saved: 'Note updated.',
        archived: 'Note archived. You can undo it.',
        restored: 'Note restored. You can undo it.',
        deleted: 'Note removed. You can undo it.',
        exported: 'Exported the board as JSON.',
        imported: 'Import complete. Board replaced. You can undo it.',
        importFailed: 'Import failed. Please use a valid board JSON file.',
        languageSwitched: 'Interface language switched to English.',
        aiSettingsSaved: 'AI model settings saved.',
        aiConnectionFailed: 'Could not reach local Ollama. Make sure `ollama serve` is running.',
        aiModelMissing: (model) => `Local Ollama is up, but model ${model} is missing.`,
        aiRequestFailed: (message) => `AI generation failed: ${message}`,
        undone: (label) => `Undone: ${label}.`,
      },
      home: {
        tagline: 'Turn scattered thoughts into clear directions.',
        newProject: 'New Topic',
        newProjectPlaceholder: "What are you brainstorming today?",
        createProject: 'Create',
        cancel: 'Cancel',
        notesCount: (n) => `${n} note${n === 1 ? '' : 's'}`,
        emptyTitle: 'No topics yet',
        emptyHint: 'Create your first brainstorm topic to get started.',
        confirmDelete: 'Confirm delete?',
      },
    },
  },
};

export function normalizeLanguage(language) {
  return language === 'en' ? 'en' : DEFAULT_LANGUAGE;
}

export function getLocale(language) {
  return LOCALE_CONFIG[normalizeLanguage(language)] ?? LOCALE_CONFIG[DEFAULT_LANGUAGE];
}

export function loadLanguage(storage = globalThis.window?.localStorage) {
  try {
    const stored = storage?.getItem(LANGUAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    return DEFAULT_LANGUAGE;
  }

  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) {
    return 'en';
  }

  return DEFAULT_LANGUAGE;
}

export function persistLanguage(language, storage = globalThis.window?.localStorage) {
  try {
    storage?.setItem(LANGUAGE_KEY, normalizeLanguage(language));
    return true;
  } catch {
    return false;
  }
}

export function remapSuggestedTag(tag, fromLanguage, toLanguage) {
  const src = getLocale(fromLanguage).tagSuggestions;
  const dst = getLocale(toLanguage).tagSuggestions;
  const idx = src.indexOf(tag);
  if (idx === -1) return tag;
  return dst[idx] ?? tag;
}
