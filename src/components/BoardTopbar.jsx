import { ArrowLeft, RefreshCw, Undo2, Users } from 'lucide-react';
import { formatClock } from '../lib/formatters.js';

export function BoardTopbar({
  language,
  locale,
  text,
  board,
  canUndo,
  onBack,
  onBoardField,
  onLanguageChange,
  onUndo,
}) {
  return (
    <header className="board-topbar">
      <button className="board-topbar__back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>{text.backToHome}</span>
      </button>
      <label className="board-topbar__title-wrap">
        <span className="sr-only">{text.titleSr}</span>
        <input
          className="board-topbar__title"
          value={board?.title ?? ''}
          onChange={(event) => onBoardField('title', event.target.value, locale.defaults.title)}
        />
      </label>
      <div className="board-topbar__controls">
        <button
          className="board-topbar__back board-topbar__tool"
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={text.undo.button}
        >
          <Undo2 size={16} />
          <span>{text.undo.button}</span>
        </button>
        <label className="presence-card">
          <Users size={15} />
          <span className="sr-only">{text.hostSr}</span>
          <input
            className="presence-card__input"
            value={board?.owner ?? ''}
            onChange={(event) => onBoardField('owner', event.target.value, locale.defaults.owner)}
          />
        </label>
        <div className="language-switch">
          <span className="language-switch__label">{text.languageLabel}</span>
          <div className="segmented">
            {Object.entries(text.languageOptions).map(([key, label]) => (
              <button key={key} className={language === key ? 'is-active' : ''} type="button" onClick={() => onLanguageChange(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="autosave-pill">
          <RefreshCw size={13} />
          {text.autosaved(formatClock(language, board?.updatedAt))}
        </span>
      </div>
    </header>
  );
}
