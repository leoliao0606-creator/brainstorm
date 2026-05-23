import {
  DEFAULT_AI_DIVERGENCE,
  DEFAULT_AI_GENERATION_COUNT,
  DEFAULT_AI_SPECIFICITY,
  MAX_AI_DISMISSED_NOTES,
  normalizeAiDivergence,
  normalizeAiGenerationCount,
  normalizeAiSpecificity,
  normalizeDismissedNotes as normalizeDismissedNotesCore,
  normalizeIdeaFingerprint,
  normalizeLanguage,
} from '../shared/aiCore.js';

export {
  normalizeAiDivergence,
  normalizeAiGenerationCount,
  normalizeAiSpecificity,
  normalizeIdeaFingerprint,
  normalizeLanguage,
};

const LENS_BY_ID = {
  en: {
    'explore-options': 'Expand the topic into varied concrete options without changing the topic type.',
    'clarify-context': 'Identify the conditions, constraints, preferences, or missing facts that would change the best answer.',
    'find-resources': 'Suggest useful resources, information sources, places, people, tools, or prior experience for the topic.',
    'spot-risks': 'Surface likely risks, bad assumptions, tradeoffs, and fallback options for the topic.',
    'next-actions': 'Turn the topic into concrete next actions someone can search, ask, book, prepare, compare, test, or decide.',
  },
  zh: {
    'explore-options': '请围绕主题拓展多种具体选项，但不要改变主题类型。',
    'clarify-context': '请找出会影响最佳答案的条件、限制、偏好或缺失信息。',
    'find-resources': '请给出与主题有关的信息来源、资源、人物、工具、地点或已有经验。',
    'spot-risks': '请指出与主题有关的风险、错误假设、取舍和备选方案。',
    'next-actions': '请把主题转成可以马上查询、询问、预订、准备、比较、测试或决定的具体行动。',
  },
};

const TITLE_TO_ID = {
  'What Else Is Possible': 'explore-options',
  'What Conditions Change The Answer': 'clarify-context',
  'What Can Help': 'find-resources',
  'Where Could This Go Wrong': 'spot-risks',
  'What Can Happen Now': 'next-actions',
  还有哪些可能: 'explore-options',
  哪些条件会改变答案: 'clarify-context',
  可以借助什么: 'find-resources',
  哪里可能踩坑: 'spot-risks',
  马上能做什么: 'next-actions',
};

export function normalizeDismissedNotes(rawDismissedNotes) {
  return normalizeDismissedNotesCore(rawDismissedNotes, MAX_AI_DISMISSED_NOTES);
}

function formatNoteEntry(n, i) {
  if (typeof n === 'string') return `${i + 1}. ${n}`;
  const tag = n.tag ? `[${n.tag}] ` : '';
  const aiWeight = Number.isFinite(Number(n.aiWeight)) && Number(n.aiWeight) > 0
    ? ` {AI weight: ${Math.max(0, Math.min(3, Math.round(Number(n.aiWeight))))}}`
    : '';
  return `${i + 1}. ${tag}${n.text}${aiWeight}`;
}

export function buildLensInstruction({ language, prompt }) {
  const normalizedLanguage = normalizeLanguage(language);
  const id = String(prompt?.id ?? TITLE_TO_ID[String(prompt?.title ?? '').trim()] ?? '').trim();
  const lensInstruction = LENS_BY_ID[normalizedLanguage]?.[id];
  const customPrompt = String(prompt?.prompt ?? '').trim();
  if (lensInstruction && customPrompt) {
    return normalizedLanguage === 'en'
      ? `${lensInstruction}\nAdditional user context: ${customPrompt}`
      : `${lensInstruction}\n用户补充上下文：${customPrompt}`;
  }
  if (lensInstruction) return lensInstruction;

  if (normalizedLanguage === 'en') {
    return customPrompt || 'Use the user prompt to expand the current board without changing its domain or intent.';
  }

  return customPrompt || '请根据用户输入扩展当前便签墙，但不要改变主题领域或意图。';
}

function buildDivergenceInstructions(language) {
  if (language === 'en') {
    return [
      'A concrete option directly tied to the board topic.',
      'A practical plan, sequence, preparation, or logistics angle.',
      'A people, timing, place, coordination, or experience angle.',
      'A risk, constraint, tradeoff, or fallback angle.',
      'A surprising but realistic variation or alternative.',
    ].join('\n');
  }

  return [
    '与工作板主题直接相关的具体选项或方向。',
    '从安排、步骤、准备或执行方式上补充。',
    '从人物、时间、地点、协作或体验角度扩展。',
    '补一个风险、限制、取舍或备选方案。',
    '给出一个有点意外但现实可做的变化或替代选择。',
  ].join('\n');
}

function buildDivergenceDirective(language, aiDivergence) {
  const level = normalizeAiDivergence(aiDivergence);
  const noteInfluence = Math.max(0, 100 - level);

  if (language === 'en') {
    if (level >= 100) {
      return 'Divergence is 100/100: completely ignore existing notes. Use only the board title and user prompt.';
    }

    return `Divergence is ${level}/100. Continuous setting: existing-note influence is about ${noteInfluence}%, and new-direction freedom is about ${level}%. At 0/100, every idea should directly preserve or extend the strongest notes. At 100/100, existing notes are omitted completely. Between those endpoints, reduce note dependence smoothly as divergence rises.`;
  }

  if (level >= 100) {
    return '发散程度为 100/100：完全忽略现有便签，只根据工作板标题和用户输入生成。';
  }

  return `发散程度为 ${level}/100。连续解释：现有便签影响力约 ${noteInfluence}%，新方向自由度约 ${level}%。0/100 时每条都应直接承接最强便签；100/100 时现有便签会被完全省略；中间档位按比例平滑减少对便签的依赖。`;
}

function buildSpecificityDirective(language, aiSpecificity) {
  const level = normalizeAiSpecificity(aiSpecificity);
  const broadness = Math.max(0, 100 - level);

  if (language === 'en') {
    return `Specificity is ${level}/100. Continuous setting: broad framing is about ${broadness}%, and concrete detail is about ${level}%. At 0/100, ideas may be high-level directions or principles. At 100/100, every idea must name a concrete action plus at least one specific detail such as time, quantity, resource, location, constraint, comparison, tool, owner, or next check. Between those endpoints, smoothly increase practical detail as specificity rises.`;
  }

  return `具体程度为 ${level}/100。连续解释：概括方向约 ${broadness}%，可执行细节约 ${level}%。0/100 时可以是较高层的方向或原则；100/100 时每条都必须包含一个具体行动，并至少补充一个具体细节，例如时间、数量、资源、地点、限制、比较对象、工具、负责人或下一步检查点；中间档位按比例增加细节密度。`;
}

function computeTemperature(hasNotes, aiDivergence) {
  const level = normalizeAiDivergence(aiDivergence) / 100;
  const base = hasNotes ? 0.34 : 0.56;
  const span = hasNotes ? 0.56 : 0.38;
  return Number((base + level * span).toFixed(2));
}

export function buildMessages({
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
}) {
  const normalizedLanguage = normalizeLanguage(language);
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const specificityLevel = normalizeAiSpecificity(aiSpecificity);
  const ideaCount = normalizeAiGenerationCount(generationCount);
  const surprisingCount = Math.min(2, ideaCount);
  const effectiveNotes = divergenceLevel >= 100 ? [] : existingNotes;
  const hasNotes = effectiveNotes.length > 0;
  const hasDismissedNotes = dismissedNotes.length > 0;
  const lensInstruction = buildLensInstruction({ language: normalizedLanguage, prompt });
  const divergenceInstructions = buildDivergenceInstructions(normalizedLanguage);
  const divergenceDirective = buildDivergenceDirective(normalizedLanguage, divergenceLevel);
  const specificityDirective = buildSpecificityDirective(normalizedLanguage, specificityLevel);
  const diversityDirective = normalizedLanguage === 'en'
    ? ideaCount === 5
      ? `- use this diversity plan, one move per idea:\n${divergenceInstructions}`
      : `- use these diversity moves as a menu and avoid repeating the same move back-to-back:\n${divergenceInstructions}`
    : ideaCount === 5
      ? `- 严格按下面 5 种不同发散路径各写 1 条，不要重复路径：\n${divergenceInstructions}`
      : `- 把下面这些发散路径当作菜单使用，不要连续重复同一种路径：\n${divergenceInstructions}`;

  if (normalizedLanguage === 'en') {
    if (hasNotes) {
      const notesList = effectiveNotes.map(formatNoteEntry).join('\n');
      const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
      return [
        {
          role: 'system',
          content:
            'You are a general-purpose brainstorming assistant working on one board. The board title defines the main topic and intent; existing notes refine that topic. Deleted notes are explicit exclusions, not hidden context. The user prompt is guidance, never a replacement topic. Do not turn the topic into a product, startup, software tool, or student project unless the board title or notes explicitly ask for that. Return strict JSON only: {"ideas":["..."]}. No markdown.',
        },
        {
          role: 'user',
          content: `Board title / main topic: ${topic || '(untitled)'}\nExisting notes:\n${notesList}${hasDismissedNotes ? `\n\nRemoved notes to avoid reviving:\n${dismissedList}` : ''}\n\nUser prompt title: ${prompt.title}\nUser prompt: ${lensInstruction}\nDivergence guidance: ${divergenceDirective}\nSpecificity guidance: ${specificityDirective}\n\nGenerate ${ideaCount} next-step ideas that:\n- treat the board title as the primary topic and the notes as weighted context\n- follow the continuous divergence guidance exactly; do not treat divergence as a low/medium/high bucket\n- follow the continuous specificity guidance exactly; do not treat specificity as a low/medium/high bucket\n- stay in the exact same real-world domain as the board title\n- if the topic is travel, an event, food, learning, life planning, or another everyday subject, keep it literal\n- use the user prompt as generation guidance, not as a replacement topic\n- when note influence is high, visibly build on the stronger notes; when note influence is low, use notes only as light inspiration\n- when a note includes "AI weight: 1-3", treat higher weight as a stronger anchor only in proportion to the note influence\n- if a concept appears in the removed-notes list, do NOT revive it, paraphrase it, or generate a near-duplicate\n- do NOT turn the topic into a product, startup, software tool, or student project unless explicitly requested\n- do NOT merely paraphrase an existing note with slightly different wording\n- each idea must add at least one option, detail, action, constraint, resource, route, comparison, or twist, with detail density controlled by specificity\n- the ideas must feel clearly different from each other\n- at least ${surprisingCount} idea${surprisingCount === 1 ? '' : 's'} should feel slightly surprising or non-obvious, while still realistic\n- are actionable and 1 sentence each\n- stay under 28 words each\n- do not prefix items with labels like "Idea 1:"\n${diversityDirective}\n- return valid JSON only with one key named "ideas" whose value is an array of ${ideaCount} strings`,
        },
      ];
    }

    const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
    return [
      {
        role: 'system',
        content:
          'You are a general-purpose brainstorming assistant. The board topic is the primary context. The user prompt is guidance. Deleted notes are explicit exclusions, not hidden context. Do not turn the topic into a product, startup, software tool, or student project unless the topic explicitly asks for that. Respond with strict JSON only in the shape {"ideas":["..."]}. No markdown.',
      },
      {
        role: 'user',
        content: `Board topic: ${topic}\nUser prompt title: ${prompt.title}\nUser prompt: ${lensInstruction}\nDivergence guidance: ${divergenceDirective}\nSpecificity guidance: ${specificityDirective}${hasDismissedNotes ? `\nAvoid reviving these removed ideas:\n${dismissedList}` : ''}\nGenerate ${ideaCount} actionable ideas for this exact topic, 1 sentence each, under 28 words.\nFollow both continuous guidance settings exactly.\nIf the topic is travel, an event, food, learning, life planning, or another everyday subject, keep it literal.\nDo not turn it into a product, startup, software tool, or student project unless explicitly requested.\nDo not prefix items with labels like "Idea 1:".\n${diversityDirective}\nReturn valid JSON only with one key named "ideas" whose value is an array of ${ideaCount} strings.`,
      },
    ];
  }

  if (hasNotes) {
    const notesList = effectiveNotes.map(formatNoteEntry).join('\n');
    const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
    return [
      {
        role: 'system',
        content:
          '你是一位通用头脑风暴助手，正在围绕一张工作板思考。工作板标题定义主要主题和意图，已有便签用于补充这个主题。已删除便签是明确排除项，不是隐藏上下文。用户输入是生成引导，绝不能替换主题。除非标题或便签明确要求，否则不要把主题变成产品、创业、软件工具或学生项目。只返回严格 JSON：{"ideas":["..."]}。不要 markdown。',
      },
      {
        role: 'user',
        content: `工作板标题 / 主题：${topic || '未命名主题'}\n便签墙上已有的想法：\n${notesList}${hasDismissedNotes ? `\n\n已删除、不能再捡回来的想法：\n${dismissedList}` : ''}\n\n用户输入标题：${prompt.title}\n用户输入内容：${lensInstruction}\n发散引导：${divergenceDirective}\n具体程度引导：${specificityDirective}\n\n请生成 ${ideaCount} 条“下一步可继续展开”的新想法，要求：\n- 必须把工作板标题当作主主题，便签是有权重的补充上下文\n- 必须严格执行连续的发散引导，不要把发散程度粗暴当成低/中/高三档\n- 必须严格执行连续的具体程度引导，不要把具体程度粗暴当成低/中/高三档\n- 必须严格留在标题指向的现实领域内\n- 如果主题是旅行、活动、美食、学习、生活安排等日常话题，就直接围绕这个话题本身发散\n- 用户输入只是生成引导，不能覆盖便签本身的主题\n- 便签影响力高时，要明显承接较强便签；便签影响力低时，便签只能作为轻量参考\n- 如果某条便签带有 “AI weight: 1-3”，数字越高，说明这条便签越重要，但仍要按便签影响力的比例使用\n- 如果某个概念出现在“已删除”列表里，就不要把它捡回来，不要改写重提，也不要生成近似变体\n- 除非标题或便签明确要求，否则不要生成产品、创业、软件工具或学生项目想法\n- 不要只是把现有便签换个说法重新写一遍\n- 每条都必须额外引入一个选项、细节、行动、限制、资源、路线、比较或变化，细节密度由具体程度控制\n- 所有想法彼此之间必须明显不同，不能都落在同一种解法上\n- 至少 ${surprisingCount} 条要有一点反直觉或让人眼前一亮，但仍然现实可做\n- 每条可执行，控制在 15-40 个汉字\n- 不要在内容前加“想法1：”这类编号前缀\n${diversityDirective}\n- 只返回合法 JSON，唯一键名为 "ideas"，值为 ${ideaCount} 个字符串组成的数组`,
      },
    ];
  }

  const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
  return [
    {
      role: 'system',
      content:
        '你是一位通用头脑风暴助手。工作板主题是主要上下文，用户输入是生成引导。已删除便签是明确排除项，不是隐藏上下文。除非主题明确要求，否则不要把主题变成产品、创业、软件工具或学生项目。只返回严格 JSON，格式为 {"ideas":["..."]}。不要 markdown。',
    },
    {
      role: 'user',
      content: `工作板主题：${topic}\n用户输入标题：${prompt.title}\n用户输入内容：${lensInstruction}\n发散引导：${divergenceDirective}\n具体程度引导：${specificityDirective}${hasDismissedNotes ? `\n不要捡回这些已删除想法：\n${dismissedList}` : ''}\n请生成 ${ideaCount} 条严格围绕这个主题的可执行想法，每条 15-40 个汉字。\n必须同时遵守两个连续参数的引导。\n如果主题是旅行、活动、美食、学习、生活安排等日常话题，就直接围绕这个话题本身发散。\n除非主题明确要求，否则不要生成产品、创业、软件工具或学生项目想法。\n不要在内容前加“想法1：”这类编号前缀。\n${diversityDirective}\n只返回合法 JSON，唯一键名为 "ideas"，值为 ${ideaCount} 个字符串组成的数组。`,
    },
  ];
}

export function buildQuestionMessages({
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
}) {
  const normalizedLanguage = normalizeLanguage(language);
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const specificityLevel = normalizeAiSpecificity(aiSpecificity);
  const questionCount = normalizeAiGenerationCount(generationCount);
  const effectiveNotes = divergenceLevel >= 100 ? [] : existingNotes;
  const hasNotes = effectiveNotes.length > 0;
  const hasDismissedNotes = dismissedNotes.length > 0;
  const divergenceDirective = buildDivergenceDirective(normalizedLanguage, divergenceLevel);
  const specificityDirective = buildSpecificityDirective(normalizedLanguage, specificityLevel);

  if (normalizedLanguage === 'en') {
    const notesList = hasNotes ? effectiveNotes.map(formatNoteEntry).join('\n') : '(none)';
    const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '(none)';
    const focus = String(prompt?.prompt ?? '').trim() || 'No extra focus.';
    return [
      {
        role: 'system',
        content:
          'You are a reflective brainstorming coach. Ask concise, useful questions grounded in the board topic and notes. Do not answer the questions. Do not generate new ideas disguised as questions. Return strict JSON only: {"questions":["..."]}. No markdown.',
      },
      {
        role: 'user',
        content: `Board title / main topic: ${topic || '(untitled)'}\nExisting notes:\n${notesList}\nRemoved notes to avoid reviving:\n${dismissedList}\nOptional user focus: ${focus}\nDivergence guidance: ${divergenceDirective}\nSpecificity guidance: ${specificityDirective}\n\nGenerate ${questionCount} thought-provoking questions for the user that:\n- treat the board title as the primary topic and the notes as weighted context\n- use the optional focus only as guidance, not as a replacement topic\n- reveal missing constraints, priorities, assumptions, tradeoffs, stakeholders, timing, risks, criteria, or next checks\n- stay in the exact same real-world domain as the board title\n- do not revive concepts from the removed-notes list\n- do not suggest a product, startup, software tool, or student project unless the board explicitly asks for that\n- are clearly different from each other\n- become more concrete as specificity rises\n- depend less on existing notes as divergence rises\n- are one sentence each, under 22 words each\n- end with a question mark\n- do not prefix items with labels like "Question 1:"\n- return valid JSON only with one key named "questions" whose value is an array of ${questionCount} strings`,
      },
    ];
  }

  const notesList = hasNotes ? effectiveNotes.map(formatNoteEntry).join('\n') : '无';
  const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '无';
  const focus = String(prompt?.prompt ?? '').trim() || '无额外关注点';
  return [
    {
      role: 'system',
      content:
        '你是一位启发式头脑风暴教练。请基于工作板主题和已有便签提出简洁、有用的问题。不要回答问题，不要把新想法伪装成问题。只返回严格 JSON：{"questions":["..."]}。不要 markdown。',
    },
    {
      role: 'user',
      content: `工作板标题 / 主题：${topic || '未命名主题'}\n便签墙上已有的想法：\n${notesList}\n已删除、不能再捡回来的想法：\n${dismissedList}\n用户额外关注点：${focus}\n发散引导：${divergenceDirective}\n具体程度引导：${specificityDirective}\n\n请生成 ${questionCount} 个给用户思考的启发性问题，要求：\n- 必须把工作板标题当作主主题，便签是有权重的补充上下文\n- 用户额外关注点只是引导，不能替换主题\n- 帮用户发现缺失限制、优先级、假设、取舍、相关人、时间点、风险、判断标准或下一步验证\n- 必须留在标题指向的现实领域内\n- 不要捡回已删除列表里的概念\n- 除非工作板明确要求，否则不要引向产品、创业、软件工具或学生项目\n- 问题之间要明显不同\n- 具体程度越高，问题越要带具体对象、条件或检查点\n- 发散程度越高，越少依赖已有便签\n- 每个问题一句话，15-42 个汉字\n- 必须以问号结尾\n- 不要在内容前加“问题1：”这类编号前缀\n- 只返回合法 JSON，唯一键名为 "questions"，值为 ${questionCount} 个字符串组成的数组`,
    },
  ];
}

function sanitizeQuestionText(value) {
  return String(value ?? '')
    .replace(/^\s*(问题|提问|追问)\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*question\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .trim();
}

function sanitizeIdeaText(value) {
  return String(value ?? '')
    .replace(/^\s*(想法|点子|建议)\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*idea\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .trim();
}

function expandIdeaCandidate(candidate) {
  const raw = typeof candidate === 'string'
    ? candidate
    : String(candidate?.idea ?? candidate?.text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const numberedParts = trimmed
    .split(/\n+\s*(?=(?:\d+|[一二三四五六七八九十]+)\s*[.、):：])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (numberedParts.length > 1) return numberedParts;

  return [trimmed];
}

export function parseIdeaPayload(content, { generationCount = DEFAULT_AI_GENERATION_COUNT } = {}) {
  const ideaCount = normalizeAiGenerationCount(generationCount);
  const cleaned = String(content ?? '').replace(/```json|```/gi, '').trim();
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        parsed = undefined;
      }
    }
  }

  let candidates = [];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (Array.isArray(parsed?.ideas)) {
    candidates = parsed.ideas;
  } else if (Array.isArray(parsed?.items)) {
    candidates = parsed.items;
  } else if (cleaned) {
    candidates = cleaned.split(/\n+/);
  }

  const uniqueIdeas = [];
  for (const candidate of candidates) {
    for (const expandedCandidate of expandIdeaCandidate(candidate)) {
      const normalized = sanitizeIdeaText(expandedCandidate);
      if (!normalized || uniqueIdeas.includes(normalized)) continue;
      uniqueIdeas.push(normalized);
    }
  }

  if (uniqueIdeas.length < Math.min(3, ideaCount)) {
    throw new Error('The model response did not contain enough usable ideas.');
  }

  return uniqueIdeas.slice(0, ideaCount);
}

export function parseQuestionPayload(content, { generationCount = DEFAULT_AI_GENERATION_COUNT } = {}) {
  const questionCount = normalizeAiGenerationCount(generationCount);
  const cleaned = String(content ?? '').replace(/```json|```/gi, '').trim();
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        parsed = undefined;
      }
    }
  }

  let candidates = [];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (Array.isArray(parsed?.questions)) {
    candidates = parsed.questions;
  } else if (Array.isArray(parsed?.items)) {
    candidates = parsed.items;
  } else if (Array.isArray(parsed?.ideas)) {
    candidates = parsed.ideas;
  } else if (cleaned) {
    candidates = cleaned.split(/\n+/);
  }

  const uniqueQuestions = [];
  for (const candidate of candidates) {
    for (const expandedCandidate of expandIdeaCandidate(candidate)) {
      const normalized = sanitizeQuestionText(expandedCandidate);
      if (!normalized || uniqueQuestions.includes(normalized)) continue;
      uniqueQuestions.push(normalized);
    }
  }

  if (uniqueQuestions.length < Math.min(3, questionCount)) {
    throw new Error('The model response did not contain enough usable questions.');
  }

  return uniqueQuestions.slice(0, questionCount);
}

export function normalizeIdeaGenerationPayload(payload) {
  const language = normalizeLanguage(payload.language);
  const topic = String(payload.topic ?? '').trim();
  const prompt = {
    id: String(payload.prompt?.id ?? '').trim(),
    title: String(payload.prompt?.title ?? '').trim(),
    prompt: String(payload.prompt?.prompt ?? '').trim(),
    tag: String(payload.prompt?.tag ?? '').trim(),
  };
  const aiDivergence = normalizeAiDivergence(payload.aiDivergence);
  const aiSpecificity = normalizeAiSpecificity(payload.aiSpecificity);
  const generationCount = normalizeAiGenerationCount(payload.generationCount);
  const existingNotes = Array.isArray(payload.existingNotes)
    ? payload.existingNotes
        .filter((n) => {
          if (typeof n === 'string') return n.trim();
          return n && typeof n === 'object' && typeof n.text === 'string' && n.text.trim();
        })
        .map((n) => {
          if (typeof n === 'string') return n.trim();
          return {
            text: String(n.text ?? '').trim(),
            tag: String(n.tag ?? '').trim(),
            aiWeight: Number.isFinite(Number(n.aiWeight)) ? Number(n.aiWeight) : 0,
          };
        })
        .slice(0, 12)
    : [];
  const activeNoteFingerprints = new Set(existingNotes.map((note) => normalizeIdeaFingerprint(note.text)).filter(Boolean));
  const dismissedNotes = normalizeDismissedNotes(payload.dismissedNotes).filter(
    (entry) => !activeNoteFingerprints.has(normalizeIdeaFingerprint(entry))
  );

  if (!topic && !prompt.prompt) {
    return {
      ok: false,
      response: {
        statusCode: 400,
        payload: {
          ok: false,
          reason: 'missing_context',
          message: 'A topic or user prompt is required.',
        },
      },
    };
  }

  return {
    ok: true,
    value: { language, topic, prompt, aiDivergence, aiSpecificity, generationCount, existingNotes, dismissedNotes },
  };
}

export async function fetchOllamaStatus({ ollamaBaseUrl, ollamaModel, fetchImpl = fetch }) {
  const response = await fetchImpl(`${ollamaBaseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama status check failed with ${response.status}.`);
  }

  const data = await response.json();
  const installedModels = Array.isArray(data.models)
    ? data.models.map((model) => model.name).filter(Boolean)
    : [];

  return {
    available: installedModels.includes(ollamaModel),
    installedModels,
  };
}

export function buildOllamaChatPayload({
  ollamaModel,
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
  stream = false,
}) {
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const ideaCount = normalizeAiGenerationCount(generationCount);
  const hasNotes = divergenceLevel < 100 && existingNotes.length > 0;

  return {
    model: ollamaModel,
    stream,
    format: 'json',
    options: {
      temperature: computeTemperature(hasNotes, divergenceLevel),
    },
    messages: buildMessages({
      language,
      topic,
      prompt,
      existingNotes,
      dismissedNotes,
      aiDivergence,
      aiSpecificity,
      generationCount: ideaCount,
    }),
  };
}

export function buildOllamaQuestionPayload({
  ollamaModel,
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
}) {
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const questionCount = normalizeAiGenerationCount(generationCount);
  const hasNotes = divergenceLevel < 100 && existingNotes.length > 0;

  return {
    model: ollamaModel,
    stream: false,
    format: 'json',
    options: {
      temperature: computeTemperature(hasNotes, divergenceLevel),
    },
    messages: buildQuestionMessages({
      language,
      topic,
      prompt,
      existingNotes,
      dismissedNotes,
      aiDivergence,
      aiSpecificity,
      generationCount: questionCount,
    }),
  };
}

export function formatMessagesForDisplay(messages = []) {
  return messages
    .map((message) => {
      const role = String(message?.role ?? 'message').toUpperCase();
      const content = String(message?.content ?? '').trim();
      return `[${role}]\n${content}`;
    })
    .join('\n\n---\n\n');
}

export async function generateIdeas({
  ollamaBaseUrl,
  ollamaModel,
  fetchImpl = fetch,
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
}) {
  const ideaCount = normalizeAiGenerationCount(generationCount);
  const response = await fetchImpl(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOllamaChatPayload({
      ollamaModel,
      language,
      topic,
      prompt,
      existingNotes,
      dismissedNotes,
      aiDivergence,
      aiSpecificity,
      generationCount: ideaCount,
      stream: false,
    })),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Ollama responded with ${response.status}.`);
  }

  const data = await response.json();
  return parseIdeaPayload(data?.message?.content, { generationCount: ideaCount });
}

export async function generateQuestions({
  ollamaBaseUrl,
  ollamaModel,
  fetchImpl = fetch,
  language,
  topic,
  prompt,
  existingNotes = [],
  dismissedNotes = [],
  aiDivergence = DEFAULT_AI_DIVERGENCE,
  aiSpecificity = DEFAULT_AI_SPECIFICITY,
  generationCount = DEFAULT_AI_GENERATION_COUNT,
}) {
  const questionCount = normalizeAiGenerationCount(generationCount);
  const response = await fetchImpl(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOllamaQuestionPayload({
      ollamaModel,
      language,
      topic,
      prompt,
      existingNotes,
      dismissedNotes,
      aiDivergence,
      aiSpecificity,
      generationCount: questionCount,
    })),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Ollama responded with ${response.status}.`);
  }

  const data = await response.json();
  return parseQuestionPayload(data?.message?.content, { generationCount: questionCount });
}
