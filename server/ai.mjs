const DEFAULT_AI_DIVERGENCE = 55;
const MAX_DISMISSED_NOTES = 12;

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

export function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'zh';
}

export function normalizeAiDivergence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_DIVERGENCE;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeIdeaFingerprint(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeDismissedNotes(rawDismissedNotes) {
  if (!Array.isArray(rawDismissedNotes)) return [];

  const uniqueNotes = [];
  const seen = new Set();

  rawDismissedNotes.forEach((entry) => {
    const text = String(entry ?? '').trim();
    const fingerprint = normalizeIdeaFingerprint(text);
    if (!fingerprint || seen.has(fingerprint)) return;
    seen.add(fingerprint);
    uniqueNotes.push(text);
  });

  return uniqueNotes.slice(-MAX_DISMISSED_NOTES);
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
  if (lensInstruction) return lensInstruction;

  if (normalizedLanguage === 'en') {
    return String(prompt?.prompt ?? '').trim() || 'Use this lens to expand the current board without changing its domain or intent.';
  }

  return String(prompt?.prompt ?? '').trim() || '请把这个角度应用在当前便签墙上，但不要改变主题领域或意图。';
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
      return 'Divergence is 100/100: completely ignore existing notes. Use only the board title and thinking lens.';
    }

    return `Divergence is ${level}/100. Continuous setting: existing-note influence is about ${noteInfluence}%, and new-direction freedom is about ${level}%. At 0/100, every idea should directly preserve or extend the strongest notes. At 100/100, existing notes are omitted completely. Between those endpoints, reduce note dependence smoothly as divergence rises.`;
  }

  if (level >= 100) {
    return '发散程度为 100/100：完全忽略现有便签，只根据工作板标题和思考透镜生成。';
  }

  return `发散程度为 ${level}/100。连续解释：现有便签影响力约 ${noteInfluence}%，新方向自由度约 ${level}%。0/100 时每条都应直接承接最强便签；100/100 时现有便签会被完全省略；中间档位按比例平滑减少对便签的依赖。`;
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
}) {
  const normalizedLanguage = normalizeLanguage(language);
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const effectiveNotes = divergenceLevel >= 100 ? [] : existingNotes;
  const hasNotes = effectiveNotes.length > 0;
  const hasDismissedNotes = dismissedNotes.length > 0;
  const lensInstruction = buildLensInstruction({ language: normalizedLanguage, prompt });
  const divergenceInstructions = buildDivergenceInstructions(normalizedLanguage);
  const divergenceDirective = buildDivergenceDirective(normalizedLanguage, divergenceLevel);

  if (normalizedLanguage === 'en') {
    if (hasNotes) {
      const notesList = effectiveNotes.map(formatNoteEntry).join('\n');
      const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
      return [
        {
          role: 'system',
          content:
            'You are a general-purpose brainstorming assistant working on one board. The board title defines the main topic and intent; existing notes refine that topic. Deleted notes are explicit exclusions, not hidden context. The prompt card is only a thinking lens, never a replacement topic. Do not turn the topic into a product, startup, software tool, or student project unless the board title or notes explicitly ask for that. Return strict JSON only: {"ideas":["..."]}. No markdown.',
        },
        {
          role: 'user',
          content: `Board title / main topic: ${topic || '(untitled)'}\nExisting notes:\n${notesList}${hasDismissedNotes ? `\n\nRemoved notes to avoid reviving:\n${dismissedList}` : ''}\n\nThinking lens: ${prompt.title}\nLens instruction: ${lensInstruction}\nDivergence guidance: ${divergenceDirective}\n\nGenerate 5 next-step ideas that:\n- treat the board title as the primary topic and the notes as weighted context\n- follow the continuous divergence guidance exactly; do not treat divergence as a low/medium/high bucket\n- stay in the exact same real-world domain as the board title\n- if the topic is travel, an event, food, learning, life planning, or another everyday subject, keep it literal\n- use the lens as a reasoning angle, not as a replacement topic\n- when note influence is high, visibly build on the stronger notes; when note influence is low, use notes only as light inspiration\n- when a note includes "AI weight: 1-3", treat higher weight as a stronger anchor only in proportion to the note influence\n- if a concept appears in the removed-notes list, do NOT revive it, paraphrase it, or generate a near-duplicate\n- do NOT turn the topic into a product, startup, software tool, or student project unless explicitly requested\n- do NOT merely paraphrase an existing note with slightly different wording\n- each idea must add at least one concrete option, detail, action, constraint, resource, route, comparison, or twist\n- the 5 ideas must feel clearly different from each other\n- at least 2 ideas should feel slightly surprising or non-obvious, while still realistic\n- are concrete, actionable, and 1 sentence each\n- stay under 28 words each\n- do not prefix items with labels like "Idea 1:"\n- use this diversity plan, one move per idea:\n${divergenceInstructions}\n- return valid JSON only with one key named "ideas" whose value is an array of 5 strings`,
        },
      ];
    }

    const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
    return [
      {
        role: 'system',
        content:
          'You are a general-purpose brainstorming assistant. The board topic is the primary context. The prompt card is only a thinking lens. Deleted notes are explicit exclusions, not hidden context. Do not turn the topic into a product, startup, software tool, or student project unless the topic explicitly asks for that. Respond with strict JSON only in the shape {"ideas":["..."]}. No markdown.',
      },
      {
        role: 'user',
        content: `Board topic: ${topic}\nBrainstorm lens: ${prompt.title}\nGuiding question: ${prompt.prompt}\nDivergence guidance: ${divergenceDirective}${hasDismissedNotes ? `\nAvoid reviving these removed ideas:\n${dismissedList}` : ''}\nGenerate 5 specific, actionable ideas for this exact topic, 1 sentence each, under 28 words.\nIf the topic is travel, an event, food, learning, life planning, or another everyday subject, keep it literal.\nDo not turn it into a product, startup, software tool, or student project unless explicitly requested.\nDo not prefix items with labels like "Idea 1:".\nReturn valid JSON only with one key named "ideas" whose value is an array of 5 strings.`,
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
          '你是一位通用头脑风暴助手，正在围绕一张工作板思考。工作板标题定义主要主题和意图，已有便签用于补充这个主题。已删除便签是明确排除项，不是隐藏上下文。题卡只是思考角度，绝不能替换主题。除非标题或便签明确要求，否则不要把主题变成产品、创业、软件工具或学生项目。只返回严格 JSON：{"ideas":["..."]}。不要 markdown。',
      },
      {
        role: 'user',
        content: `工作板标题 / 主题：${topic || '未命名主题'}\n便签墙上已有的想法：\n${notesList}${hasDismissedNotes ? `\n\n已删除、不能再捡回来的想法：\n${dismissedList}` : ''}\n\n思考透镜：${prompt.title}\n透镜说明：${lensInstruction}\n发散引导：${divergenceDirective}\n\n请生成 5 条“下一步可继续展开”的新想法，要求：\n- 必须把工作板标题当作主主题，便签是有权重的补充上下文\n- 必须严格执行连续的发散引导，不要把发散程度粗暴当成低/中/高三档\n- 必须严格留在标题指向的现实领域内\n- 如果主题是旅行、活动、美食、学习、生活安排等日常话题，就直接围绕这个话题本身发散\n- 题卡只是一种思考角度，不能覆盖便签本身的主题\n- 便签影响力高时，要明显承接较强便签；便签影响力低时，便签只能作为轻量参考\n- 如果某条便签带有 “AI weight: 1-3”，数字越高，说明这条便签越重要，但仍要按便签影响力的比例使用\n- 如果某个概念出现在“已删除”列表里，就不要把它捡回来，不要改写重提，也不要生成近似变体\n- 除非标题或便签明确要求，否则不要生成产品、创业、软件工具或学生项目想法\n- 不要只是把现有便签换个说法重新写一遍\n- 每条都必须额外引入一个具体选项、细节、行动、限制、资源、路线、比较或变化\n- 5 条想法彼此之间必须明显不同，不能都落在同一种解法上\n- 至少 2 条要有一点反直觉或让人眼前一亮，但仍然现实可做\n- 每条具体、可执行，控制在 15-40 个汉字\n- 不要在内容前加“想法1：”这类编号前缀\n- 严格按下面 5 种不同发散路径各写 1 条，不要重复路径：\n${divergenceInstructions}\n- 只返回合法 JSON，唯一键名为 "ideas"，值为 5 个字符串组成的数组`,
      },
    ];
  }

  const dismissedList = hasDismissedNotes ? dismissedNotes.map(formatNoteEntry).join('\n') : '';
  return [
    {
      role: 'system',
      content:
        '你是一位通用头脑风暴助手。工作板主题是主要上下文，题卡只是思考角度。已删除便签是明确排除项，不是隐藏上下文。除非主题明确要求，否则不要把主题变成产品、创业、软件工具或学生项目。只返回严格 JSON，格式为 {"ideas":["..."]}。不要 markdown。',
    },
    {
      role: 'user',
      content: `工作板主题：${topic}\n思考角度：${prompt.title}\n引导问题：${prompt.prompt}\n发散引导：${divergenceDirective}${hasDismissedNotes ? `\n不要捡回这些已删除想法：\n${dismissedList}` : ''}\n请生成 5 条严格围绕这个主题的具体可执行想法，每条 15-40 个汉字。\n如果主题是旅行、活动、美食、学习、生活安排等日常话题，就直接围绕这个话题本身发散。\n除非主题明确要求，否则不要生成产品、创业、软件工具或学生项目想法。\n不要在内容前加“想法1：”这类编号前缀。\n只返回合法 JSON，唯一键名为 "ideas"，值为 5 个字符串组成的数组。`,
    },
  ];
}

function sanitizeIdeaText(value) {
  return String(value ?? '')
    .replace(/^\s*(想法|点子|建议)\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*idea\s*\d+\s*[:：.)、-]?\s*/i, '')
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .trim();
}

export function parseIdeaPayload(content) {
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
    const normalized =
      typeof candidate === 'string'
        ? sanitizeIdeaText(candidate)
        : sanitizeIdeaText(candidate?.idea ?? candidate?.text);

    if (!normalized || uniqueIdeas.includes(normalized)) continue;
    uniqueIdeas.push(normalized);
  }

  if (uniqueIdeas.length < 3) {
    throw new Error('The model response did not contain enough usable ideas.');
  }

  return uniqueIdeas.slice(0, 5);
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
          message: 'A topic or prompt card is required.',
        },
      },
    };
  }

  return {
    ok: true,
    value: { language, topic, prompt, aiDivergence, existingNotes, dismissedNotes },
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
}) {
  const divergenceLevel = normalizeAiDivergence(aiDivergence);
  const hasNotes = divergenceLevel < 100 && existingNotes.length > 0;
  const response = await fetchImpl(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
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
      }),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Ollama responded with ${response.status}.`);
  }

  const data = await response.json();
  return parseIdeaPayload(data?.message?.content);
}
