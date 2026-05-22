export const DEFAULT_LANGUAGE = 'zh';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b-it-q4_K_M';
export const DEFAULT_AI_DIVERGENCE = 55;
export const DEFAULT_AI_SPECIFICITY = 70;
export const DEFAULT_AI_GENERATION_COUNT = 5;
export const MIN_AI_GENERATION_COUNT = 1;
export const MAX_AI_GENERATION_COUNT = 10;
export const MAX_AI_DISMISSED_NOTES = 12;

export function normalizeLanguage(language) {
  return language === 'en' ? 'en' : DEFAULT_LANGUAGE;
}

export function normalizeAiDivergence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_DIVERGENCE;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeAiSpecificity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_SPECIFICITY;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeAiGenerationCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_GENERATION_COUNT;
  return Math.max(MIN_AI_GENERATION_COUNT, Math.min(MAX_AI_GENERATION_COUNT, Math.round(parsed)));
}

export function normalizeAiLanguagePreference(value) {
  if (value === 'zh' || value === 'en') return value;
  return 'auto';
}

export function resolveAiLanguagePreference(preference, uiLanguage) {
  const normalized = normalizeAiLanguagePreference(preference);
  return normalized === 'auto' ? normalizeLanguage(uiLanguage) : normalized;
}

export function normalizeOllamaBaseUrl(value, fallback = DEFAULT_OLLAMA_BASE_URL) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

export function normalizeOllamaModel(value, fallback = DEFAULT_OLLAMA_MODEL) {
  return String(value ?? '').trim() || fallback;
}

export function normalizeIdeaFingerprint(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeDismissedNotes(rawDismissedNotes, maxNotes = MAX_AI_DISMISSED_NOTES) {
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

  return uniqueNotes.slice(-Math.max(0, Math.round(Number(maxNotes) || 0)));
}
