import { createId } from './ids.js';
import { DEFAULT_LANGUAGE, getLocale } from './locale.js';

export const DEFAULT_AI_DIVERGENCE = 55;
export const DEFAULT_NOTE_FONT_SCALE = 1.12;
export const MAX_AI_WEIGHT = 3;
export const MAX_DISMISSED_NOTES = 24;
export const BOARD_VERSION = 3;
export const AI_GENERATION_COUNT = 5;
export const AI_REVEAL_STEP_MS = 180;

const AI_AUTHOR_ALIASES = new Set(['AI 灵感', 'AI Ideas']);
const PROMPT_AUTHOR_ALIASES = new Set(['引导提示', 'Prompt']);

export function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeTimestamp(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeAiWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_AI_WEIGHT, Math.round(parsed)));
}

export function normalizeAiDivergence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_DIVERGENCE;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeNoteFontScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_NOTE_FONT_SCALE;
  return Math.max(0.9, Math.min(1.45, Number(parsed.toFixed(2))));
}

export function normalizeNoteSource(source) {
  return source === 'ai' || source === 'prompt' ? source : 'user';
}

export function normalizeGenerationState(state) {
  return state === 'generating' ? 'generating' : 'ready';
}

export function normalizeNoteFingerprint(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeDismissedNotes(rawDismissedNotes) {
  if (!Array.isArray(rawDismissedNotes)) return [];

  const uniqueNotes = [];
  const seen = new Set();

  rawDismissedNotes.forEach((entry) => {
    const text = normalizeText(entry).trim();
    const fingerprint = normalizeNoteFingerprint(text);
    if (!fingerprint || seen.has(fingerprint)) return;
    seen.add(fingerprint);
    uniqueNotes.push(text);
  });

  return uniqueNotes.slice(-MAX_DISMISSED_NOTES);
}

function inferNoteSource(rawSource, author) {
  if (rawSource === 'ai' || rawSource === 'prompt' || rawSource === 'user') return rawSource;
  if (AI_AUTHOR_ALIASES.has(author)) return 'ai';
  if (PROMPT_AUTHOR_ALIASES.has(author)) return 'prompt';
  return 'user';
}

export function createNote({
  text,
  tag = '',
  author = '',
  pinned = false,
  source = 'user',
  fallbackAuthor,
  generationState = 'ready',
  generationIndex = 0,
}) {
  const stamp = Date.now();
  return {
    id: createId(),
    text: text.trim(),
    tag: tag.trim(),
    author: author.trim() || fallbackAuthor || getLocale(DEFAULT_LANGUAGE).defaults.owner,
    source: normalizeNoteSource(source),
    votes: 0,
    aiWeight: 0,
    archived: false,
    pinned,
    generationState: normalizeGenerationState(generationState),
    generationIndex: Math.max(0, Math.round(Number(generationIndex) || 0)),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function touchBoard(board) {
  return { ...board, updatedAt: Date.now() };
}

export function appendNotes(board, notes) {
  return touchBoard({ ...board, notes: [...notes, ...board.notes] });
}

export function patchNote(board, noteId, updater) {
  const stamp = Date.now();
  return touchBoard({
    ...board,
    notes: board.notes.map((note) =>
      note.id === noteId ? { ...note, ...updater(note), updatedAt: stamp } : note
    ),
  });
}

export function deleteNote(board, noteId) {
  const removedNote = board.notes.find((note) => note.id === noteId);
  const shouldTrackDismissal = removedNote?.generationState !== 'generating';
  const dismissedNotes = shouldTrackDismissal && removedNote?.text?.trim()
    ? normalizeDismissedNotes([...(board.dismissedNotes ?? []), removedNote.text])
    : normalizeDismissedNotes(board.dismissedNotes);

  return touchBoard({
    ...board,
    notes: board.notes.filter((note) => note.id !== noteId),
    dismissedNotes,
  });
}

export function removeNotesById(board, noteIds) {
  const idSet = new Set(noteIds);
  return touchBoard({
    ...board,
    notes: board.notes.filter((note) => !idSet.has(note.id)),
    dismissedNotes: normalizeDismissedNotes(board.dismissedNotes),
  });
}

export function normalizeNote(rawNote, index, language) {
  const text = normalizeText(rawNote?.text).trim();
  if (!text) return null;
  const locale = getLocale(language);
  const createdAt = normalizeTimestamp(rawNote?.createdAt, index);
  const updatedAt = normalizeTimestamp(rawNote?.updatedAt, createdAt);
  const author = normalizeText(rawNote?.author ?? rawNote?.userName, locale.defaults.owner).trim() || locale.defaults.owner;
  return {
    id: normalizeText(rawNote?.id, `legacy-${index}`),
    text,
    tag: normalizeText(rawNote?.tag ?? rawNote?.tags?.[0]).trim(),
    author,
    source: inferNoteSource(rawNote?.source, author),
    votes: Math.max(0, normalizeTimestamp(rawNote?.votes, 0)),
    aiWeight: normalizeAiWeight(rawNote?.aiWeight),
    archived: Boolean(rawNote?.archived),
    pinned: Boolean(rawNote?.pinned),
    generationState: normalizeGenerationState(rawNote?.generationState),
    generationIndex: Math.max(0, Math.round(Number(rawNote?.generationIndex) || 0)),
    createdAt,
    updatedAt,
  };
}

export function normalizeBoard(rawBoard, language = DEFAULT_LANGUAGE, options = {}) {
  const locale = getLocale(language);
  const dropGeneratingNotes = Boolean(options.dropGeneratingNotes);
  const notes = Array.isArray(rawBoard?.notes)
    ? rawBoard.notes
        .map((note, i) => normalizeNote(note, i, language))
        .filter(Boolean)
        .filter((note) => !dropGeneratingNotes || note.generationState !== 'generating')
    : [];

  return {
    version: BOARD_VERSION,
    title: normalizeText(rawBoard?.title, locale.defaults.title).trim() || locale.defaults.title,
    owner: normalizeText(rawBoard?.owner ?? rawBoard?.userName, locale.defaults.owner).trim() || locale.defaults.owner,
    aiDivergence: normalizeAiDivergence(rawBoard?.aiDivergence),
    noteFontScale: normalizeNoteFontScale(rawBoard?.noteFontScale),
    dismissedNotes: normalizeDismissedNotes(rawBoard?.dismissedNotes),
    notes,
    updatedAt: normalizeTimestamp(
      rawBoard?.updatedAt,
      notes.reduce((latest, note) => Math.max(latest, note.updatedAt, note.createdAt), 0)
    ),
  };
}

export function createInitialBoard(language = DEFAULT_LANGUAGE) {
  const locale = getLocale(language);
  return touchBoard({
    version: BOARD_VERSION,
    title: locale.defaults.title,
    owner: locale.defaults.owner,
    aiDivergence: DEFAULT_AI_DIVERGENCE,
    noteFontScale: DEFAULT_NOTE_FONT_SCALE,
    dismissedNotes: [],
    notes: [],
  });
}

export function selectAiContextNotes(notes) {
  const weightedNotes = notes.filter((note) => note.aiWeight > 0 && note.source !== 'prompt');
  const userNotes = notes.filter((note) => note.source === 'user');
  const mergedNotes = weightedNotes.length
    ? [...new Map([...weightedNotes, ...userNotes].map((note) => [note.id, note])).values()]
    : userNotes;
  const sourceNotes = mergedNotes.length ? mergedNotes : notes.filter((note) => note.source !== 'prompt');

  return [...sourceNotes]
    .sort((a, b) => {
      if (a.aiWeight !== b.aiWeight) return b.aiWeight - a.aiWeight;
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (a.votes !== b.votes) return b.votes - a.votes;
      if (a.text.length !== b.text.length) return b.text.length - a.text.length;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 12);
}

export function sortNotes(notes, sortBy, language) {
  const sorted = [...notes];
  const locale = getLocale(language);
  sorted.sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    if (sortBy === 'votes') return b.votes - a.votes || b.updatedAt - a.updatedAt;
    if (sortBy === 'tag') return a.tag.localeCompare(b.tag, locale.sortLocale) || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
  return sorted;
}

export function computeTopTag(notes) {
  const counts = new Map();
  notes.filter((n) => !n.archived && n.tag).forEach((n) => {
    counts.set(n.tag, (counts.get(n.tag) || 0) + 1);
  });
  let best = '';
  let max = 0;
  counts.forEach((count, tag) => {
    if (count > max) {
      best = tag;
      max = count;
    }
  });
  return best;
}
