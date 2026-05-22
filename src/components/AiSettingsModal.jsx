import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Save, X } from 'lucide-react';
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
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  function updateDraft(field, value) {
    onDraftChange({ ...draft, [field]: value });
  }

  function selectModel(model) {
    updateDraft('ollamaModel', model);
    setModelMenuOpen(false);
  }

  return (
    <div
      className="settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <header className="settings-dialog__header">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2 id="ai-settings-title" className="settings-dialog__title">{copy.title}</h2>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>
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
          <div
            className="field model-picker"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setModelMenuOpen(false);
              }
            }}
          >
            <span className="field__label">{copy.modelLabel}</span>
            <div className="model-picker__control">
              <input
                className="field__control model-picker__input"
                value={draft.ollamaModel}
                onFocus={() => setModelMenuOpen(true)}
                onChange={(event) => {
                  updateDraft('ollamaModel', event.target.value);
                  setModelMenuOpen(true);
                }}
                placeholder={copy.modelPlaceholder}
              />
              <button
                className="model-picker__toggle"
                type="button"
                onClick={() => setModelMenuOpen((open) => !open)}
                aria-label={copy.modelLabel}
                title={copy.modelLabel}
              >
                <ChevronDown size={17} />
              </button>
            </div>
            {modelMenuOpen && modelOptions.length ? (
              <div className="model-picker__menu" role="listbox" aria-label={copy.modelLabel}>
                {modelOptions.map((model) => (
                  <button
                    key={model}
                    className={`model-picker__option${draft.ollamaModel === model ? ' model-picker__option--active' : ''}`}
                    type="button"
                    role="option"
                    aria-selected={draft.ollamaModel === model}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectModel(model)}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

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
