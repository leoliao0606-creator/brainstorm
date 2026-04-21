import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:e4b-it-q4_K_M';
const MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_AI_DIVERGENCE = 55;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'zh';
}

function normalizeAiDivergence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_DIVERGENCE;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error('Request body too large.');
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function formatNoteEntry(n, i) {
  if (typeof n === 'string') return `${i + 1}. ${n}`;
  const tag = n.tag ? `[${n.tag}] ` : '';
  const aiWeight = Number.isFinite(Number(n.aiWeight)) && Number(n.aiWeight) > 0
    ? ` {AI weight: ${Math.max(0, Math.min(3, Math.round(Number(n.aiWeight))))}}`
    : '';
  return `${i + 1}. ${tag}${n.text}${aiWeight}`;
}

function buildLensInstruction({ language, prompt }) {
  const title = String(prompt?.title ?? '').trim();

  if (language === 'en') {
    if (title === 'Discover Problems Worth Solving') {
      return 'Use the board to identify the most painful bottleneck, blind spot, failure mode, or costly decision gap inside these ideas.';
    }
    if (title === 'Understand Your First Users') {
      return 'Use the board to identify the clearest first user, buyer, or workflow owner and the inefficient step you could remove for them.';
    }
    if (title === 'How You Beat Existing Solutions') {
      return 'Use the board to identify the specific edge, differentiated workflow, or product decision that would beat existing alternatives.';
    }
    if (title === 'What Can You Ship This Week') {
      return 'Use the board to turn the strongest direction into the smallest prototype, experiment, or validation step you could ship this week.';
    }
    if (title === 'What Your Stack Makes Possible') {
      return 'Use the board to identify which model, API, dataset, or technical approach creates leverage that simpler solutions do not have.';
    }

    return String(prompt?.prompt ?? '').trim() || 'Use this lens to expand the current board without changing its domain.';
  }

  if (title === '发现值得解决的问题') {
    return '请围绕这些便签，找出其中最痛、最慢、最贵、最容易误判的具体环节。';
  }
  if (title === '了解你的第一批用户') {
    return '请围绕这些便签，找出最明确的第一批用户或使用者，以及他们当前流程里最低效的一步。';
  }
  if (title === '比现有方案好在哪') {
    return '请围绕这些便签，找出可以显著拉开差异的功能设计、数据优势或工作流优势。';
  }
  if (title === '一周内能做出什么') {
    return '请围绕这些便签，把最强的方向收敛成一周内能验证价值的最小原型或实验。';
  }
  if (title === '技术选型能带来什么机会') {
    return '请围绕这些便签，找出哪种模型、API、数据源或技术路线能形成明显杠杆。';
  }

  return String(prompt?.prompt ?? '').trim() || '请把这个角度应用在当前便签墙上，但不要改变问题领域。';
}

function buildDivergenceInstructions(language) {
  if (language === 'en') {
    return [
      'Idea 1 should turn the strongest pain point into a sharper product or workflow.',
      'Idea 2 should introduce a new data source, API, signal, or integration.',
      'Idea 3 should add a coordination, service, marketplace, or social layer.',
      'Idea 4 should reframe the problem through prediction, scoring, simulation, personalization, or risk reduction.',
      'Idea 5 should be a surprising but realistic MVP, concierge test, or lightweight experiment.',
    ].join('\n');
  }

  return [
    '想法1：把最核心的痛点收敛成一个更明确的产品或工作流。',
    '想法2：引入新的数据源、API、信号或系统集成。',
    '想法3：加入协作、服务撮合、社区或运营层。',
    '想法4：从预测、评分、模拟、个性化或降风险的角度重构问题。',
    '想法5：给出一个有点反直觉但现实可做的 MVP、人工服务版或轻量实验。',
  ].join('\n');
}

function buildDivergenceDirective(language, aiDivergence) {
  const level = normalizeAiDivergence(aiDivergence);

  if (language === 'en') {
    if (level <= 25) return 'Stay close to the strongest notes. Prefer practical, incremental, low-risk extensions.';
    if (level >= 75) return 'Allow bolder jumps, less obvious combinations, and more surprising MVPs, while still staying in-domain.';
    return 'Balance novelty and feasibility. Keep the ideas relevant, but do not be too conservative.';
  }

  if (level <= 25) return '尽量贴近最强的便签主线，优先给出务实、低风险、渐进式延展。';
  if (level >= 75) return '允许更大胆的跨点组合、反直觉切入和更有惊喜感的 MVP，但仍必须留在同一主题内。';
  return '在相关性和新意之间取平衡，不要太保守，也不要跑题。';
}

function computeTemperature(hasNotes, aiDivergence) {
  const level = normalizeAiDivergence(aiDivergence) / 100;
  const base = hasNotes ? 0.34 : 0.56;
  const span = hasNotes ? 0.56 : 0.38;
  return Number((base + level * span).toFixed(2));
}

function buildMessages({ language, topic, prompt, existingNotes = [], aiDivergence = DEFAULT_AI_DIVERGENCE }) {
  const hasNotes = existingNotes.length > 0;
  const lensInstruction = buildLensInstruction({ language, prompt });
  const divergenceInstructions = buildDivergenceInstructions(language);
  const divergenceDirective = buildDivergenceDirective(language, aiDivergence);

  if (language === 'en') {
    if (hasNotes) {
      const notesList = existingNotes.map(formatNoteEntry).join('\n');
      return [
        {
          role: 'system',
          content:
            'You are a grounded brainstorming assistant. Treat the existing board notes as the single source of truth. The prompt card is only a thinking lens, never a new topic. If the lens mentions students, classmates, or campus life but the board does not, reinterpret that lens inside the board domain. Return strict JSON only: {"ideas":["..."]}. No markdown.',
        },
        {
          role: 'user',
          content: `Board title: ${topic || '(untitled)'}\nExisting notes:\n${notesList}\n\nThinking lens: ${prompt.title}\nLens instruction: ${lensInstruction}\nDivergence setting: ${normalizeAiDivergence(aiDivergence)}/100\nDivergence guidance: ${divergenceDirective}\n\nGenerate 5 next-step ideas that:\n- stay in the exact same domain as the notes above\n- combine, sharpen, or operationalize one or more existing notes\n- use the lens as a reasoning angle, not as a replacement topic\n- when a note includes "AI weight: 1-3", treat higher weight as a stronger anchor for the output\n- do NOT invent unrelated campus or generic student app ideas\n- do NOT merely paraphrase an existing note with slightly different wording\n- each idea must add at least one genuinely new mechanism, workflow twist, data source, or product form\n- the 5 ideas must feel clearly different from each other in shape\n- at least 2 ideas should feel slightly surprising or non-obvious, while still realistic\n- are concrete, actionable, and 1 sentence each\n- stay under 28 words each\n- whenever useful, explicitly mention the note concepts you are building on\n- use this diversity plan, one move per idea:\n${divergenceInstructions}\n- return valid JSON only: {"ideas":["idea 1","idea 2","idea 3","idea 4","idea 5"]}`,
        },
      ];
    }

    return [
      {
        role: 'system',
        content:
          'You are a creative brainstorming assistant helping college students find project ideas. Respond with strict JSON only in the shape {"ideas":["..."]}. Generate exactly 5 specific, actionable ideas. No markdown.',
      },
      {
        role: 'user',
        content: `Project topic: ${topic}\nBrainstorm angle: ${prompt.title}\nGuiding question: ${prompt.prompt}\nGenerate 5 specific, actionable ideas for a student project, 1 sentence each, under 28 words.\nReturn valid JSON only: {"ideas":["idea 1","idea 2","idea 3","idea 4","idea 5"]}`,
      },
    ];
  }

  if (hasNotes) {
    const notesList = existingNotes.map(formatNoteEntry).join('\n');
    return [
      {
        role: 'system',
        content:
          '你是一位贴着便签墙工作的头脑风暴助手。已有便签是唯一主语境，题卡只是思考角度，绝不能把题卡当成新的主题来源。若题卡里出现“同学”“校园”等词，但便签主题并不是校园，就必须把这些词改写到当前便签领域里再思考。只返回严格 JSON：{"ideas":["..."]}。不要 markdown。',
      },
      {
        role: 'user',
        content: `项目标题：${topic || '未命名项目'}\n便签墙上已有的想法：\n${notesList}\n\n思考透镜：${prompt.title}\n透镜说明：${lensInstruction}\n发散程度：${normalizeAiDivergence(aiDivergence)}/100\n发散引导：${divergenceDirective}\n\n请生成 5 条“下一步可继续展开”的新想法，要求：\n- 必须严格留在上面这些便签的同一问题领域内\n- 必须是在现有便签上继续细化、组合、推进或产品化，而不是换题\n- 题卡只是一种思考角度，不能覆盖便签本身的主题\n- 如果某条便签带有 “AI weight: 1-3”，数字越高，说明这条便签越应该主导生成方向\n- 不要生成与现有便签无关的通用校园应用或泛泛创意\n- 不要只是把现有便签换个说法重新写一遍\n- 每条都必须额外引入一个新的机制、流程设计、数据来源、交互方式或产品形态\n- 5 条想法彼此之间必须明显不同，不能都落在同一种解法上\n- 至少 2 条要有一点反直觉或让人眼前一亮，但仍然现实可做\n- 尽量直接点名你承接了哪些现有概念，例如 BERT、多模态、投资评估、风险投资者\n- 每条具体、可执行，控制在 15-40 个汉字\n- 严格按下面 5 种不同发散路径各写 1 条，不要重复路径：\n${divergenceInstructions}\n- 只返回合法 JSON：{"ideas":["想法1","想法2","想法3","想法4","想法5"]}`,
      },
    ];
  }

  return [
    {
      role: 'system',
      content:
        '你是一位专门帮助大学生发散思维、探索项目创意的头脑风暴助手。只返回严格 JSON，格式为 {"ideas":["..."]}。生成 5 条具体可执行的想法。不要 markdown。',
    },
    {
      role: 'user',
      content: `项目主题：${topic}\n思考角度：${prompt.title}\n引导问题：${prompt.prompt}\n请生成 5 条针对大学生项目的具体可执行想法，每条 15-40 个汉字。\n只返回合法 JSON：{"ideas":["想法1","想法2","想法3","想法4","想法5"]}`,
    },
  ];
}

function sanitizeIdeaText(value) {
  return String(value ?? '')
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .trim();
}

function parseIdeaPayload(content) {
  const cleaned = String(content ?? '').replace(/```json|```/gi, '').trim();
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      parsed = JSON.parse(match[1]);
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

async function fetchOllamaStatus() {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama status check failed with ${response.status}.`);
  }

  const data = await response.json();
  const installedModels = Array.isArray(data.models)
    ? data.models.map((model) => model.name).filter(Boolean)
    : [];

  return {
    available: installedModels.includes(OLLAMA_MODEL),
    installedModels,
  };
}

async function generateIdeas({ language, topic, prompt, existingNotes = [], aiDivergence = DEFAULT_AI_DIVERGENCE }) {
  const hasNotes = existingNotes.length > 0;
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: 'json',
      options: {
        temperature: computeTemperature(hasNotes, aiDivergence),
      },
      messages: buildMessages({
        language,
        topic,
        prompt,
        existingNotes,
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

async function handleStatus(response) {
  try {
    const status = await fetchOllamaStatus();
    sendJson(response, 200, {
      ok: true,
      available: status.available,
      reason: status.available ? 'ready' : 'model_missing',
      model: OLLAMA_MODEL,
      installedModels: status.installedModels,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      available: false,
      reason: 'connection_failed',
      model: OLLAMA_MODEL,
      message: error instanceof Error ? error.message : 'Unknown Ollama error.',
    });
  }
}

async function handleIdeaGeneration(request, response) {
  let payload;

  try {
    const rawBody = await readRequestBody(request);
    payload = JSON.parse(rawBody || '{}');
  } catch {
    sendJson(response, 400, {
      ok: false,
      reason: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
    return;
  }

  const language = normalizeLanguage(payload.language);
  const topic = String(payload.topic ?? '').trim();
  const prompt = {
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

  if (!topic && !prompt.prompt) {
    sendJson(response, 400, {
      ok: false,
      reason: 'missing_context',
      message: 'A topic or prompt card is required.',
    });
    return;
  }

  try {
    const status = await fetchOllamaStatus();
    if (!status.available) {
      sendJson(response, 503, {
        ok: false,
        available: false,
        reason: 'model_missing',
        model: OLLAMA_MODEL,
        installedModels: status.installedModels,
        message: `Model ${OLLAMA_MODEL} is not available in Ollama.`,
      });
      return;
    }

    const ideas = await generateIdeas({ language, topic, prompt, existingNotes, aiDivergence });
    sendJson(response, 200, {
      ok: true,
      ideas,
      model: OLLAMA_MODEL,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      reason: 'generation_failed',
      model: OLLAMA_MODEL,
      message: error instanceof Error ? error.message : 'Unknown generation error.',
    });
  }
}

async function serveStaticAsset(requestPath, response, method) {
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.join(DIST_DIR, cleanPath);

  try {
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      throw new Error('Cannot serve directories.');
    }

    const extension = path.extname(filePath);
    const fileContent = await readFile(filePath);
    const headers = {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    };
    if (requestPath !== '/index.html') {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    response.writeHead(200, headers);
    response.end(method === 'HEAD' ? undefined : fileContent);
    return;
  } catch {
    if (cleanPath !== '/index.html') {
      return serveStaticAsset('/index.html', response, method);
    }

    sendText(
      response,
      503,
      'dist not found. Run "npm run build" before starting the production server.'
    );
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendText(response, 400, 'Missing request URL.');
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `${HOST}:${PORT}`}`);

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/ai/status' && request.method === 'GET') {
    await handleStatus(response);
    return;
  }

  if (url.pathname === '/api/ai/ideas' && request.method === 'POST') {
    await handleIdeaGeneration(request, response);
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { ok: false, message: 'Unknown API route.' });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method not allowed.');
    return;
  }

  await serveStaticAsset(url.pathname, response, request.method);
});

server.listen(PORT, HOST, () => {
  console.log(
    `Brainstorm server listening on http://${HOST}:${PORT} using Ollama model ${OLLAMA_MODEL}`
  );
});
