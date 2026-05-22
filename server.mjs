import http from 'node:http';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import {
  buildOllamaChatPayload,
  fetchOllamaStatus,
  formatMessagesForDisplay,
  generateIdeas,
  normalizeIdeaGenerationPayload,
  parseIdeaPayload,
} from './server/ai.mjs';
import {
  DEFAULT_OLLAMA_BASE_URL as SHARED_DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL as SHARED_DEFAULT_OLLAMA_MODEL,
  normalizeOllamaBaseUrl,
  normalizeOllamaModel,
} from './shared/aiCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? SHARED_DEFAULT_OLLAMA_BASE_URL;
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? SHARED_DEFAULT_OLLAMA_MODEL;
const MAX_BODY_SIZE = 1024 * 1024;
const ALLOW_REMOTE_OLLAMA = process.env.ALLOW_REMOTE_OLLAMA === '1';
const OLLAMA_STATUS_TIMEOUT_MS = Number(process.env.OLLAMA_STATUS_TIMEOUT_MS ?? 5000);
const OLLAMA_GENERATION_TIMEOUT_MS = Number(process.env.OLLAMA_GENERATION_TIMEOUT_MS ?? 120000);

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

function isPrivateOllamaHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') return true;

  if (net.isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  if (net.isIP(normalized) === 6) {
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd');
  }

  return normalized.endsWith('.local');
}

function assertAllowedOllamaBaseUrl(baseUrl) {
  if (ALLOW_REMOTE_OLLAMA) return null;

  try {
    const parsed = new URL(baseUrl);
    if (isPrivateOllamaHost(parsed.hostname)) return null;
  } catch {
    // The URL was already normalized, but keep this defensive for future changes.
  }

  return {
    ok: false,
    reason: 'remote_ollama_blocked',
    message: 'Remote Ollama URLs are disabled by default. Set ALLOW_REMOTE_OLLAMA=1 to allow them.',
  };
}

function fetchWithTimeout(resource, options = {}, timeoutMs = OLLAMA_GENERATION_TIMEOUT_MS) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(new Error('Ollama request timed out.')), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      timeoutController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => timeoutController.abort(options.signal.reason), { once: true });
    }
  }

  return fetch(resource, { ...options, signal: timeoutController.signal }).finally(() => clearTimeout(timer));
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

function normalizeOllamaRuntimeSettings(payload = {}) {
  const runtime = {
    ollamaBaseUrl: normalizeOllamaBaseUrl(payload.ollamaBaseUrl ?? payload.baseUrl ?? DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_BASE_URL),
    ollamaModel: normalizeOllamaModel(payload.ollamaModel ?? payload.model ?? DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_MODEL),
  };
  const blocked = assertAllowedOllamaBaseUrl(runtime.ollamaBaseUrl);
  return blocked ? { ok: false, ...blocked, runtime } : { ok: true, runtime };
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

  const runtimeResult = normalizeOllamaRuntimeSettings(payload);
  const runtime = runtimeResult.runtime;
  if (!runtimeResult.ok) {
    sendJson(response, 400, {
      ok: false,
      available: false,
      reason: runtimeResult.reason,
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: runtimeResult.message,
    });
    return;
  }

  try {
    const status = await fetchOllamaStatus({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
      fetchImpl: (resource, options) => fetchWithTimeout(resource, options, OLLAMA_STATUS_TIMEOUT_MS),
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

  const runtimeResult = normalizeOllamaRuntimeSettings(payload);
  const runtime = runtimeResult.runtime;
  if (!runtimeResult.ok) {
    sendJson(response, 400, {
      ok: false,
      available: false,
      reason: runtimeResult.reason,
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: runtimeResult.message,
    });
    return;
  }

  try {
    const status = await fetchOllamaStatus({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
      fetchImpl: (resource, options) => fetchWithTimeout(resource, options, OLLAMA_STATUS_TIMEOUT_MS),
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
      fetchImpl: (resource, options) => fetchWithTimeout(resource, options, OLLAMA_GENERATION_TIMEOUT_MS),
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

function writeStreamEvent(response, payload) {
  if (response.writableEnded || response.destroyed) return;
  response.write(`${JSON.stringify(payload)}\n`);
}

async function handleIdeaGenerationStream(request, response) {
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

  const runtimeResult = normalizeOllamaRuntimeSettings(payload);
  const runtime = runtimeResult.runtime;
  if (!runtimeResult.ok) {
    sendJson(response, 400, {
      ok: false,
      available: false,
      reason: runtimeResult.reason,
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: runtimeResult.message,
    });
    return;
  }

  try {
    const status = await fetchOllamaStatus({
      ollamaBaseUrl: runtime.ollamaBaseUrl,
      ollamaModel: runtime.ollamaModel,
      fetchImpl: (resource, options) => fetchWithTimeout(resource, options, OLLAMA_STATUS_TIMEOUT_MS),
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

    const upstreamController = new AbortController();
    let clientClosed = false;
    response.on('close', () => {
      if (!response.writableEnded) {
        clientClosed = true;
        upstreamController.abort();
      }
    });

    const chatPayload = buildOllamaChatPayload({
      ollamaModel: runtime.ollamaModel,
      ...normalized.value,
      stream: true,
    });

    const upstreamResponse = await fetchWithTimeout(`${runtime.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: upstreamController.signal,
      body: JSON.stringify(chatPayload),
    }, OLLAMA_GENERATION_TIMEOUT_MS);

    if (!upstreamResponse.ok) {
      const detail = await upstreamResponse.text();
      throw new Error(detail || `Ollama responded with ${upstreamResponse.status}.`);
    }

    response.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    writeStreamEvent(response, {
      type: 'meta',
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      finalPrompt: formatMessagesForDisplay(chatPayload.messages),
    });

    const decoder = new TextDecoder();
    let buffer = '';
    let rawContent = '';

    for await (const chunk of upstreamResponse.body) {
      if (clientClosed) return;
      buffer += decoder.decode(chunk, { stream: true });
      let lineBreakIndex = buffer.indexOf('\n');

      while (lineBreakIndex !== -1) {
        const line = buffer.slice(0, lineBreakIndex).trim();
        buffer = buffer.slice(lineBreakIndex + 1);
        lineBreakIndex = buffer.indexOf('\n');
        if (!line) continue;

        const event = JSON.parse(line);
        const content = String(event?.message?.content ?? '');
        if (content) {
          rawContent += content;
          writeStreamEvent(response, { type: 'chunk', content });
        }

        if (event?.done) {
          const ideas = parseIdeaPayload(rawContent, { generationCount: normalized.value.generationCount });
          writeStreamEvent(response, {
            type: 'done',
            ideas,
            rawContent,
            model: runtime.ollamaModel,
            baseUrl: runtime.ollamaBaseUrl,
          });
          response.end();
          return;
        }
      }
    }

    const trailingLine = buffer.trim();
    if (trailingLine) {
      const event = JSON.parse(trailingLine);
      const content = String(event?.message?.content ?? '');
      if (content) rawContent += content;
    }

    const ideas = parseIdeaPayload(rawContent, { generationCount: normalized.value.generationCount });
    writeStreamEvent(response, {
      type: 'done',
      ideas,
      rawContent,
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
    });
    response.end();
  } catch (error) {
    if (error?.name === 'AbortError') return;

    const payload = {
      ok: false,
      reason: 'generation_failed',
      model: runtime.ollamaModel,
      baseUrl: runtime.ollamaBaseUrl,
      message: error instanceof Error ? error.message : 'Unknown generation error.',
    };

    if (response.headersSent) {
      writeStreamEvent(response, { type: 'error', ...payload });
      response.end();
      return;
    }

    sendJson(response, 503, payload);
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

  if (url.pathname === '/api/ai/ideas/stream' && request.method === 'POST') {
    await handleIdeaGenerationStream(request, response);
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
