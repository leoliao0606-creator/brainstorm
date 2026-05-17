import { normalizeLanguage } from './locale.js';

export const AI_SETTINGS_KEY = 'brainstorm:ai-settings:v1';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b-it-q4_K_M';
export const DEFAULT_AI_GENERATION_COUNT = 5;
export const MIN_AI_GENERATION_COUNT = 1;
export const MAX_AI_GENERATION_COUNT = 10;

export const DEFAULT_AI_SETTINGS = {
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  generationCount: DEFAULT_AI_GENERATION_COUNT,
  languagePreference: 'auto',
};

export function normalizeOllamaBaseUrl(value) {
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

export function normalizeOllamaModel(value) {
  return String(value ?? '').trim() || DEFAULT_OLLAMA_MODEL;
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

export function normalizeAiSettings(rawSettings) {
  return {
    ollamaBaseUrl: normalizeOllamaBaseUrl(rawSettings?.ollamaBaseUrl ?? rawSettings?.baseUrl),
    ollamaModel: normalizeOllamaModel(rawSettings?.ollamaModel ?? rawSettings?.model),
    generationCount: normalizeAiGenerationCount(rawSettings?.generationCount),
    languagePreference: normalizeAiLanguagePreference(rawSettings?.languagePreference),
  };
}

export function loadAiSettings(storage = globalThis.window?.localStorage) {
  try {
    const raw = storage?.getItem(AI_SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return normalizeAiSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function persistAiSettings(settings, storage = globalThis.window?.localStorage) {
  try {
    storage?.setItem(AI_SETTINGS_KEY, JSON.stringify(normalizeAiSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
