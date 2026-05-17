import { RefreshCw, Save, X } from 'lucide-react';
import {
  MAX_AI_GENERATION_COUNT,
  MIN_AI_GENERATION_COUNT,
} from '../lib/aiSettings.js';
import { getLocale } from '../lib/locale.js';

export function AiSettingsModal({
  language,
  draft,
  installedModels,
  loading,
  statusMessage,
  onClose,
  onDraftChange,
  onRefresh,
  onSave,
}) {
  const copy = getLocale(language).text.aiSettings;
  const modelOptions = [...new Set([draft.ollamaModel, ...installedModels].filter(Boolean))];

  function updateDraft(field, value) {
    onDraftChange({ ...draft, [field]: value });
  }

  return (
    <div
      className="settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <header className="settings-dialog__header">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2 id="ai-settings-title" className="settings-dialog__title">{copy.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>
            <X size={17} />
          </button>
        </header>

        <div className="settings-dialog__status">
          <span>{copy.statusLabel}</span>
          <strong>{statusMessage}</strong>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="field">
            <span className="field__label">{copy.modelLabel}</span>
            <input
              className="field__control"
              list="ollama-model-options"
              value={draft.ollamaModel}
              onChange={(event) => updateDraft('ollamaModel', event.target.value)}
              placeholder={copy.modelPlaceholder}
            />
            <datalist id="ollama-model-options">
              {modelOptions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field__label">{copy.baseUrlLabel}</span>
            <input
              className="field__control"
              value={draft.ollamaBaseUrl}
              onChange={(event) => updateDraft('ollamaBaseUrl', event.target.value)}
              placeholder={copy.baseUrlPlaceholder}
            />
          </label>

          <label className="field">
            <span className="field__label">{copy.countLabel}</span>
            <input
              className="field__control"
              type="number"
              min={MIN_AI_GENERATION_COUNT}
              max={MAX_AI_GENERATION_COUNT}
              step="1"
              value={draft.generationCount}
              onChange={(event) => updateDraft('generationCount', event.target.value)}
            />
          </label>

          <div className="field">
            <span className="field__label">{copy.languageLabel}</span>
            <div className="segmented segmented--wrap">
              {Object.entries(copy.languageOptions).map(([key, label]) => (
                <button
                  key={key}
                  className={draft.languagePreference === key ? 'is-active' : ''}
                  type="button"
                  onClick={() => updateDraft('languagePreference', key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <footer className="settings-dialog__footer">
            <button className="button button--ghost" type="button" onClick={() => onRefresh(draft)} disabled={loading}>
              <RefreshCw size={14} /> {copy.refresh}
            </button>
            <button className="button button--secondary" type="button" onClick={onClose}>
              {copy.cancel}
            </button>
            <button className="button button--accent" type="submit">
              <Save size={14} /> {copy.save}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
