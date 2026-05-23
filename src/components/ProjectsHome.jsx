import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { getLocale } from '../lib/locale.js';
import { formatNoteTime } from '../lib/formatters.js';
import { loadBoardById } from '../lib/boardStorage.js';
import { projectTone, toneIndexForNote, visualDepthForNote } from '../lib/ui.js';
import { hashString } from '../lib/ids.js';

const BACKDROP_PROJECT_LIMIT = 10;
const BACKDROP_NOTE_BUDGET = 72;
const BACKDROP_NOTE_LIMIT_PER_PROJECT = 16;
const BACKDROP_ANCHORS = [
  { x: [6, 18], y: [18, 30] },
  { x: [82, 94], y: [18, 30] },
  { x: [8, 22], y: [48, 62] },
  { x: [78, 92], y: [48, 62] },
  { x: [18, 32], y: [74, 88] },
  { x: [68, 82], y: [74, 88] },
  { x: [42, 56], y: [16, 28] },
  { x: [42, 58], y: [74, 90] },
  { x: [3, 14], y: [68, 84] },
  { x: [86, 97], y: [68, 84] },
];
const BACKDROP_NOTE_TONES = [
  { background: 'linear-gradient(180deg, rgba(255, 247, 150, 0.98), rgba(245, 200, 52, 0.94))', tape: 'rgba(177, 123, 16, 0.4)' },
  { background: 'linear-gradient(180deg, rgba(172, 245, 216, 0.96), rgba(70, 202, 157, 0.9))', tape: 'rgba(11, 122, 113, 0.34)' },
  { background: 'linear-gradient(180deg, rgba(255, 209, 187, 0.97), rgba(241, 137, 90, 0.9))', tape: 'rgba(189, 91, 58, 0.34)' },
  { background: 'linear-gradient(180deg, rgba(191, 222, 255, 0.97), rgba(111, 171, 226, 0.9))', tape: 'rgba(46, 95, 145, 0.34)' },
  { background: 'linear-gradient(180deg, rgba(224, 212, 255, 0.97), rgba(171, 143, 238, 0.9))', tape: 'rgba(104, 78, 156, 0.32)' },
  { background: 'linear-gradient(180deg, rgba(255, 203, 222, 0.97), rgba(232, 119, 155, 0.88))', tape: 'rgba(183, 75, 108, 0.32)' },
];
const BACKDROP_NOTE_COLOR_TONES = {
  yellow: BACKDROP_NOTE_TONES[0],
  mint: BACKDROP_NOTE_TONES[1],
  coral: BACKDROP_NOTE_TONES[2],
  blue: BACKDROP_NOTE_TONES[3],
  lavender: BACKDROP_NOTE_TONES[4],
  rose: BACKDROP_NOTE_TONES[5],
};

function clampNoteCount(project) {
  const count = Number(project?.noteCount);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.round(count));
}

function seededRatio(seed, salt) {
  return (hashString(`${seed}:${salt}`) % 1000) / 1000;
}

function seededRange(seed, salt, min, max) {
  return min + seededRatio(seed, salt) * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function pickGridStep(cellCount, seed) {
  if (cellCount <= 1) return 1;
  const candidates = [7, 5, 11, 3, cellCount - 1, 1];
  const start = hashString(`${seed}:step`) % candidates.length;

  for (let i = 0; i < candidates.length; i += 1) {
    const step = candidates[(start + i) % candidates.length] % cellCount;
    if (step > 0 && greatestCommonDivisor(step, cellCount) === 1) return step;
  }

  return 1;
}

function getBalancedBackdropPosition(layoutSeed, noteSeed, noteIndex, noteCount) {
  const safeCount = Math.max(1, noteCount);
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.35))));
  const rows = Math.max(1, Math.ceil(safeCount / columns));
  const cellCount = columns * rows;
  const offset = hashString(`${layoutSeed}:offset`) % cellCount;
  const cell = (offset + noteIndex * pickGridStep(cellCount, layoutSeed)) % cellCount;
  const column = cell % columns;
  const row = Math.floor(cell / columns);
  const xBase = columns === 1 ? 50 : 15 + (column / (columns - 1)) * 70;
  const yBase = rows === 1 ? 56 : 31 + (row / (rows - 1)) * 50;
  const xJitter = seededRange(noteSeed, 'x-jitter', -4.6, 4.6);
  const yJitter = seededRange(noteSeed, 'y-jitter', -4.2, 4.2);

  return {
    x: clamp(xBase + xJitter, 11, 89),
    y: clamp(yBase + yJitter, 27, 84),
  };
}

function getBackdropNoteTone(note, seed) {
  if (note?.color && BACKDROP_NOTE_COLOR_TONES[note.color]) return BACKDROP_NOTE_COLOR_TONES[note.color];
  if (note) return BACKDROP_NOTE_TONES[toneIndexForNote(note) - 1];
  return BACKDROP_NOTE_TONES[hashString(seed) % BACKDROP_NOTE_TONES.length];
}

function getBackdropBoardSize(noteCount) {
  if (!noteCount) return 0.82;
  return clamp(0.84 + Math.log2(noteCount + 1) * 0.13, 0.9, 1.5);
}

function makeBackdropNotes(project, sourceNotes, visualNoteCount) {
  return Array.from({ length: visualNoteCount }, (_, noteIndex) => {
    const sourceIndex = sourceNotes.length
      ? noteIndex % sourceNotes.length
      : -1;
    const sourceNote = sourceNotes[sourceIndex];
    const seed = `${project.id}:${sourceNote?.id ?? noteIndex}:${noteIndex}`;
    const position = getBalancedBackdropPosition(`${project.id}:notes:${visualNoteCount}`, seed, noteIndex, visualNoteCount);
    const tone = getBackdropNoteTone(sourceNote, seed);
    const visualDepth = visualDepthForNote(sourceNote);
    const emphasis = noteIndex % 5 === 0 ? 1.16 : noteIndex % 3 === 0 ? 1.05 : 1;
    const size = Math.min(1.52, seededRange(seed, 'size', 0.76, 1.3) * emphasis);

    return {
      key: `${project.id}-note-${noteIndex}`,
      text: sourceNote?.text ?? '',
      tag: sourceNote?.tag ?? '',
      x: position.x,
      y: position.y,
      rotate: seededRange(seed, 'rotate', -11, 11),
      scale: seededRange(seed, 'scale', 0.92, 1.08),
      size,
      zIndex: Math.round(size * 100),
      depthOverlay: (0.025 + visualDepth * 0.13).toFixed(3),
      background: tone.background,
      tape: tone.tape,
    };
  });
}

function getProjectBackdropNotes(project, language) {
  const board = loadBoardById(project.id, language);
  return (board.notes ?? [])
    .filter((note) => !note.archived && note.generationState !== 'generating')
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

function buildBackdropProjects(projects, language) {
  const sourceProjects = (projects ?? []).slice(0, BACKDROP_PROJECT_LIMIT).map((project) => {
    const notes = getProjectBackdropNotes(project, language);
    return {
      project,
      notes,
      noteCount: notes.length || clampNoteCount(project),
    };
  });
  const totalNotes = sourceProjects.reduce((sum, entry) => sum + entry.noteCount, 0);
  const noteBudgetScale = totalNotes > BACKDROP_NOTE_BUDGET ? BACKDROP_NOTE_BUDGET / totalNotes : 1;

  return sourceProjects.map(({ project, notes, noteCount }, index) => {
    const seed = `${project.id}:${project.title}`;
    const anchor = BACKDROP_ANCHORS[index % BACKDROP_ANCHORS.length];
    const visualNoteCount = noteCount
      ? Math.max(1, Math.min(BACKDROP_NOTE_LIMIT_PER_PROJECT, Math.ceil(noteCount * noteBudgetScale)))
      : 0;

    return {
      id: project.id,
      title: project.title,
      noteCount,
      topTag: project.topTag,
      tone: projectTone(project.id),
      x: seededRange(seed, 'board-x', anchor.x[0], anchor.x[1]),
      y: seededRange(seed, 'board-y', anchor.y[0], anchor.y[1]),
      rotate: seededRange(seed, 'board-rotate', -13, 13),
      scale: seededRange(seed, 'board-scale', 0.96, 1.04),
      boardSize: getBackdropBoardSize(noteCount),
      blur: seededRange(seed, 'board-blur', 0.6, 1.4),
      notes: makeBackdropNotes(project, notes, visualNoteCount),
    };
  });
}

function HomeBackdrop({ language, projects }) {
  const backdropProjects = useMemo(() => buildBackdropProjects(projects, language), [language, projects]);

  if (!backdropProjects.length) return null;

  return (
    <div className="home-backdrop" aria-hidden="true">
      {backdropProjects.map((project) => (
        <div
          key={project.id}
          className="home-backdrop__board"
          style={{
            '--backdrop-x': `${project.x}%`,
            '--backdrop-y': `${project.y}%`,
            '--backdrop-rotate': `${project.rotate}deg`,
            '--backdrop-scale': String(project.scale),
            '--backdrop-board-size': String(project.boardSize),
            '--backdrop-blur': `${project.blur}px`,
            '--project-gradient': project.tone.gradient,
            '--project-tape': project.tone.tape,
          }}
        >
          <div className="home-backdrop__board-tape" />
          <div className="home-backdrop__board-head">
            <span className="home-backdrop__board-title">{project.title}</span>
            <span className="home-backdrop__board-count">{project.noteCount}</span>
          </div>
          {project.topTag ? <span className="home-backdrop__tag">{project.topTag}</span> : null}
          <div className="home-backdrop__notes">
            {project.notes.map((note) => (
              <span
                key={note.key}
                className="home-backdrop__note"
                style={{
                  '--note-x': `${note.x}%`,
                  '--note-y': `${note.y}%`,
                  '--note-rotate': `${note.rotate}deg`,
                  '--note-scale': String(note.scale),
                  '--note-size': String(note.size),
                  '--note-depth-overlay': note.depthOverlay,
                  '--note-bg': note.background,
                  '--note-tape': note.tape,
                  zIndex: note.zIndex,
                }}
              >
                <span className="home-backdrop__note-text">{note.text}</span>
                {note.tag ? <span className="home-backdrop__note-tag">{note.tag}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ project, language, onEnter, onDelete }) {
  const t = getLocale(language).text.home;
  const tone = projectTone(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article
      className="project-card"
      style={{ '--project-gradient': tone.gradient, '--project-tape': tone.tape }}
    >
      <div className="project-card__tape" aria-hidden="true" />
      <button className="project-card__body" type="button" onClick={onEnter}>
        <h3 className="project-card__title">{project.title}</h3>
        <div className="project-card__chips">
          <span className="project-card__count">{t.notesCount(project.noteCount ?? 0)}</span>
          {project.topTag ? <span className="project-card__tag">{project.topTag}</span> : null}
        </div>
        <span className="project-card__time">{formatNoteTime(language, project.updatedAt)}</span>
      </button>
      <div className="project-card__footer">
        {confirmDelete ? (
          <>
            <button className="mini-button mini-button--danger" type="button" onClick={onDelete}>
              <Trash2 size={13} /> {t.confirmDelete}
            </button>
            <button className="mini-button" type="button" onClick={() => setConfirmDelete(false)}>
              <X size={13} />
            </button>
          </>
        ) : (
          <button className="mini-button mini-button--ghost" type="button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

export function ProjectsHome({ language, projects, onEnter, onCreate, onDelete, onLanguageChange }) {
  const [newTitle, setNewTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const locale = getLocale(language);
  const t = locale.text;
  const ht = t.home;

  function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewTitle('');
    setShowForm(false);
  }

  return (
    <div className="home-shell">
      <div className="home-shell__glow home-shell__glow--a" aria-hidden="true" />
      <div className="home-shell__glow home-shell__glow--b" aria-hidden="true" />
      <HomeBackdrop language={language} projects={projects} />

      <header className="home-header">
        <div className="home-header__brand">
          <span className="home-header__dot" aria-hidden="true" />
          <span className="home-header__name">Brainstorm Studio</span>
        </div>
        <div className="language-switch">
          <span className="language-switch__label">{t.languageLabel}</span>
          <div className="segmented">
            {Object.entries(t.languageOptions).map(([key, label]) => (
              <button
                key={key}
                className={language === key ? 'is-active' : ''}
                type="button"
                onClick={() => onLanguageChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="home-hero">
        <h1 className="home-hero__title">
          {language === 'zh' ? '灵感工坊' : 'Idea Lab'}
        </h1>
        <p className="home-hero__tagline">{ht.tagline}</p>

        {showForm ? (
          <form className="create-form" onSubmit={handleCreate}>
            <input
              className="field__control create-form__input"
              placeholder={ht.newProjectPlaceholder}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button className="button button--accent" type="submit">
              <Plus size={15} /> {ht.createProject}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => { setShowForm(false); setNewTitle(''); }}
            >
              {ht.cancel}
            </button>
          </form>
        ) : (
          <button className="button button--accent home-hero__cta" type="button" onClick={() => setShowForm(true)}>
            <Plus size={17} /> {ht.newProject}
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="home-empty">
          <p className="home-empty__title">{ht.emptyTitle}</p>
          <p className="home-empty__hint">{ht.emptyHint}</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              language={language}
              onEnter={() => onEnter(project.id)}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
