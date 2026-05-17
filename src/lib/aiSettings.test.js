import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  normalizeAiSettings,
  resolveAiLanguagePreference,
} from './aiSettings.js';

describe('aiSettings', () => {
  it('normalizes incomplete or invalid settings', () => {
    expect(normalizeAiSettings({
      ollamaBaseUrl: 'ftp://example.com',
      ollamaModel: '',
      generationCount: 99,
      languagePreference: 'fr',
    })).toEqual({
      ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
      generationCount: 10,
      languagePreference: 'auto',
    });
  });

  it('resolves automatic AI language from the UI language', () => {
    expect(resolveAiLanguagePreference('auto', 'en')).toBe('en');
    expect(resolveAiLanguagePreference('zh', 'en')).toBe('zh');
  });
});
