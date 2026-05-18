export async function fetchAiStatus(settings = {}, { signal } = {}) {
  const response = await fetch('/api/ai/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(settings),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export async function requestIdeaGeneration(payload, { signal } = {}) {
  const response = await fetch('/api/ai/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(payload),
  });
  const responsePayload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload: responsePayload };
}

export async function requestIdeaGenerationStream(payload, { signal, onEvent } = {}) {
  const response = await fetch('/api/ai/ideas/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responsePayload = await response.json().catch(() => ({}));
    return { ok: false, payload: responsePayload };
  }

  if (!response.body) {
    return { ok: false, payload: { reason: 'stream_unavailable', message: 'Streaming is not available.' } };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload = null;

  function handleLine(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    onEvent?.(event);
    if (event.type === 'done' || event.type === 'error') {
      finalPayload = event;
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineBreakIndex = buffer.indexOf('\n');

    while (lineBreakIndex !== -1) {
      handleLine(buffer.slice(0, lineBreakIndex));
      buffer = buffer.slice(lineBreakIndex + 1);
      lineBreakIndex = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  handleLine(buffer);

  if (finalPayload?.type === 'error') {
    return { ok: false, payload: finalPayload };
  }

  return { ok: true, payload: finalPayload ?? {} };
}
