import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Minus,
  Move,
  Palette,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  Vote,
} from 'lucide-react';
import { MAX_AI_WEIGHT, NOTE_COLOR_OPTIONS } from '../lib/boardModel.js';
import { getLocale } from '../lib/locale.js';
import { formatNoteTime } from '../lib/formatters.js';
import { autoResizeTextarea, tiltForNote, toneIndexForNote } from '../lib/ui.js';

export function NoteCard({
  language,
  note,
  onArchiveToggle,
  onDelete,
  onFilterTag,
  onPinToggle,
  onColorChange,
  onSave,
  onVote,
  onWeightChange,
  isDragging = false,
  onDragPointerCancel,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
}) {
  const copy = getLocale(language).text.noteCard;
  const [openPanel, setOpenPanel] = useState(null);
  const textRef = useRef(null);
  const tagRef = useRef(null);
  const tone = toneIndexForNote(note);
  const colorClass = note.color ? `note-card--${note.color}` : `note-card--${tone}`;
  const tilt = tiltForNote(note.id);
  const isGenerating = note.generationState === 'generating';
  const noteStyle = {
    '--note-tilt': `${tilt}deg`,
    '--note-enter-delay': `${note.generationIndex * 110}ms`,
  };

  useEffect(() => {
    if (textRef.current && document.activeElement !== textRef.current) {
      textRef.current.value = note.text;
      autoResizeTextarea(textRef.current);
    }
    if (tagRef.current && document.activeElement !== tagRef.current) {
      tagRef.current.value = note.tag;
    }
  }, [note.text, note.tag, note.updatedAt]);

  function commitChanges() {
    if (isGenerating) return;
    const nextText = String(textRef.current?.value ?? note.text).trim();
    const nextTag = String(tagRef.current?.value ?? note.tag).trim();

    if (!nextText) {
      if (textRef.current) {
        textRef.current.value = note.text;
        autoResizeTextarea(textRef.current);
      }
      if (tagRef.current) {
        tagRef.current.value = note.tag;
      }
      return;
    }

    if (nextText !== note.text || nextTag !== note.tag) {
      onSave(note.id, { text: nextText, tag: nextTag }, { silent: true });
    }
  }

  function togglePanel(panel) {
    commitChanges();
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function selectWeight(aiWeight) {
    onWeightChange(note.id, aiWeight);
    setOpenPanel(null);
  }

  return (
    <article
      className={`note-card ${colorClass}${isGenerating ? ' note-card--generating' : ''}${isDragging ? ' note-card--dragging' : ''}`}
      style={noteStyle}
      onPointerCancel={onDragPointerCancel}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
    >
      <div className="note-card__tape" aria-hidden="true" />
      <header className="note-card__header">
        <button
          className="note-card__tag"
          type="button"
          onClick={() => onFilterTag(note.tag)}
          disabled={!note.tag}
        >
          {note.tag || copy.untagged}
        </button>
        {note.pinned ? (
          <span className="note-card__pin" aria-label={copy.pinned} title={copy.pinned}>
            <Pin size={12} />
          </span>
        ) : null}
        {isGenerating ? <span className="note-card__status-pill">{copy.generatingBadge}</span> : null}
        <span className="note-card__move-handle" title={copy.move}>
          <Move size={14} aria-hidden="true" />
        </span>
      </header>

      <textarea
        ref={textRef}
        className={`note-card__body-input${isGenerating ? ' note-card__body-input--loading' : ''}`}
        defaultValue={note.text}
        onChange={(e) => {
          autoResizeTextarea(e.target);
        }}
        onBlur={() => commitChanges()}
        rows={3}
        readOnly={isGenerating}
      />

      <footer className="note-card__meta">
        <span>{note.author}</span>
        <span>{formatNoteTime(language, note.updatedAt || note.createdAt)}</span>
      </footer>

      <div className="note-card__actions">
        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${openPanel === 'vote' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('vote')}
            aria-label={`${copy.vote} ${note.votes}`}
            title={copy.vote}
            disabled={isGenerating}
          >
            <Vote size={16} />
            <span>{note.votes}</span>
          </button>

          {openPanel === 'vote' ? (
            <div className="note-card__panel note-card__panel--compact">
              <div className="note-card__vote-stepper">
                <button
                  className="note-card__icon-step"
                  type="button"
                  onClick={() => onVote(note.id, -1)}
                  aria-label={copy.voteDown}
                  title={copy.voteDown}
                  disabled={note.votes <= 0}
                >
                  <Minus size={14} />
                </button>
                <span className="note-card__panel-value">{note.votes}</span>
                <button
                  className="note-card__icon-step"
                  type="button"
                  onClick={() => onVote(note.id, 1)}
                  aria-label={copy.voteUp}
                  title={copy.voteUp}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${note.aiWeight ? ' note-card__action-button--active' : ''}${openPanel === 'weight' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('weight')}
            aria-label={`${copy.weight} ${note.aiWeight}`}
            title={copy.weight}
            disabled={isGenerating}
          >
            <Sparkles size={16} />
            <span>{note.aiWeight}</span>
          </button>

          {openPanel === 'weight' ? (
            <div className="note-card__panel">
              <div className="note-card__weight-grid">
                {Array.from({ length: MAX_AI_WEIGHT + 1 }, (_, value) => (
                  <button
                    key={value}
                    className={`note-card__weight-option${note.aiWeight === value ? ' note-card__weight-option--active' : ''}`}
                    type="button"
                    onClick={() => selectWeight(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="note-card__menu-anchor">
          <button
            className={`note-card__action-button${openPanel === 'menu' ? ' note-card__action-button--open' : ''}`}
            type="button"
            onClick={() => togglePanel('menu')}
            aria-label={copy.more}
            title={copy.more}
            disabled={isGenerating}
          >
            <ChevronDown size={16} className="note-card__more-icon" />
          </button>

          {openPanel === 'menu' ? (
            <div className="note-card__menu">
              <label className="note-card__menu-field">
                <span>{copy.tagLabel}</span>
                <input
                  ref={tagRef}
                  className="note-card__menu-input"
                  defaultValue={note.tag}
                  onBlur={() => commitChanges()}
                  placeholder={copy.tagPlaceholder}
                />
              </label>

              <div className="note-card__menu-field">
                <span>{copy.colorLabel}</span>
                <div className="note-card__color-grid" role="group" aria-label={copy.colorLabel}>
                  <button
                    className={`note-card__color-option note-card__color-option--auto${!note.color ? ' note-card__color-option--active' : ''}`}
                    type="button"
                    onClick={() => onColorChange(note.id, '')}
                    aria-label={copy.colorAuto}
                    title={copy.colorAuto}
                  >
                    <Palette size={13} />
                  </button>
                  {NOTE_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      className={`note-card__color-option note-card__color-option--${color}${note.color === color ? ' note-card__color-option--active' : ''}`}
                      type="button"
                      onClick={() => onColorChange(note.id, color)}
                      aria-label={copy.colors[color]}
                      title={copy.colors[color]}
                    />
                  ))}
                </div>
              </div>

              <div className="note-card__menu-actions">
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => {
                    onPinToggle(note.id);
                    setOpenPanel(null);
                  }}
                >
                  <Pin size={14} /> {note.pinned ? copy.unpin : copy.pin}
                </button>
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => {
                    onArchiveToggle(note.id);
                    setOpenPanel(null);
                  }}
                >
                  {note.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  {note.archived ? copy.restore : copy.archive}
                </button>
                <button
                  className="mini-button mini-button--danger"
                  type="button"
                  onClick={() => {
                    setOpenPanel(null);
                    onDelete(note.id);
                  }}
                >
                  <Trash2 size={14} /> {copy.delete}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
