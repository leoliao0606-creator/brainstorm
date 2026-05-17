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
