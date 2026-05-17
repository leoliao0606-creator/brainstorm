import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import {
  fetchOllamaStatus,
  generateIdeas,
  normalizeIdeaGenerationPayload,
} from './server/ai.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:e4b-it-q4_K_M';
const MAX_BODY_SIZE = 1024 * 1024;

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

function normalizeOllamaBaseUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_OLLAMA_BASE_URL;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_OLLAMA_BASE_URL;
    }
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return DEFAULT_OLLAMA_BASE_URL;
  }
}

function normalizeOllamaRuntimeSettings(payload = {}) {
  return {
    ollamaBaseUrl: normalizeOllamaBaseUrl(payload.ollamaBaseUrl ?? payload.baseUrl ?? DEFAULT_OLLAMA_BASE_URL),
    ollamaModel: String(payload.ollamaModel ?? payload.model ?? DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL,
  };
}

async function readJsonBody(request) {
  const rawBody = await readRequestBody(request);
  if (!rawBody.trim()) return {};
  return JSON.parse(rawBody);
}

async function handleStatus(request, response, overrides = {}) {
  let payload = overrides;

  if (request.method === 'POST') {
    try {
      payload = await readJsonBody(request);
    } catch {
      sendJson(response, 400, {
        ok: false,
        reason: 'invalid_json',
        message: 'Request body must be valid JSON.',
      });
      return;
    }
  }

  const runtime = normalizeOllamaRuntimeSettings(payload);

  try {
    const status = await fetchOllamaStatus({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
    });
    sendJson(response, 200, {
      ok: true,
      available: status.available,
      reason: status.available ? 'ready' : 'model_missing',
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      installedModels: status.installedModels,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      available: false,
      reason: 'connection_failed',
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: error instanceof Error ? error.message : 'Unknown Ollama error.',
    });
  }
}

async function handleIdeaGeneration(request, response) {
  let payload;

  try {
    payload = await readJsonBody(request);
  } catch {
    sendJson(response, 400, {
      ok: false,
      reason: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
    return;
  }

  const normalized = normalizeIdeaGenerationPayload(payload);
  if (!normalized.ok) {
    sendJson(response, normalized.response.statusCode, normalized.response.payload);
    return;
  }

  const runtime = normalizeOllamaRuntimeSettings(payload);

  try {
    const status = await fetchOllamaStatus({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
    });
    if (!status.available) {
      sendJson(response, 503, {
        ok: false,
        available: false,
        reason: 'model_missing',
        model: runtime.ollamaModel,
        baseUrl: runtime.ollamaBaseUrl,
        installedModels: status.installedModels,
        message: `Model ${runtime.ollamaModel} is not available in Ollama.`,
      });
      return;
    }

    const ideas = await generateIdeas({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
      ...normalized.value,
    });
    sendJson(response, 200, {
      ok: true,
      ideas,
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      reason: 'generation_failed',
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: error instanceof Error ? error.message : 'Unknown generation error.',
    });
  }
}

function resolveStaticAssetPath(requestPath) {
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(cleanPath);
  } catch {
    return null;
  }

  const relativePath = path.posix.normalize(decodedPath).replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, relativePath);
  const distRoot = path.resolve(DIST_DIR);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
    return null;
  }

  return { cleanPath, filePath };
}

async function serveStaticAsset(requestPath, response, method) {
  const resolved = resolveStaticAssetPath(requestPath);
  if (!resolved) {
    sendText(response, 400, 'Invalid asset path.');
    return;
  }

  try {
    const fileStats = await stat(resolved.filePath);
    if (fileStats.isDirectory()) {
      throw new Error('Cannot serve directories.');
    }

    const extension = path.extname(resolved.filePath);
    const fileContent = await readFile(resolved.filePath);
    const headers = {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    };
    if (resolved.cleanPath !== '/index.html') {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    response.writeHead(200, headers);
    response.end(method === 'HEAD' ? undefined : fileContent);
    return;
  } catch {
    if (resolved.cleanPath !== '/index.html') {
      await serveStaticAsset('/index.html', response, method);
      return;
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

  if (url.pathname === '/api/ai/status' && (request.method === 'GET' || request.method === 'POST')) {
    await handleStatus(request, response, Object.fromEntries(url.searchParams));
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
    `Brainstorm server listening on http://${HOST}:${PORT} using default Ollama model ${DEFAULT_OLLAMA_MODEL}`
  );
});
