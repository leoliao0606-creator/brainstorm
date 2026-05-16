import { createId } from './ids.js';
import { DEFAULT_LANGUAGE, getLocale } from './locale.js';
import { computeTopTag, createInitialBoard, normalizeBoard } from './boardModel.js';

export const PROJECTS_KEY = 'brainstorm:projects:v1';
export const BOARD_KEY_PREFIX = 'brainstorm:board:v1:';
export const LEGACY_KEY = 'brainstorm:studio:v2';

function getDefaultStorage() {
  return globalThis.window?.localStorage;
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readItem(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getBoardStorageKey(projectId) {
  return BOARD_KEY_PREFIX + projectId;
}

export function loadProjects(language = DEFAULT_LANGUAGE, storage = getDefaultStorage()) {
  const raw = readItem(storage, PROJECTS_KEY);
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) return parsed;

  const legacyRaw = readItem(storage, LEGACY_KEY);
  const legacyBoard = parseJson(legacyRaw);
  if (!legacyBoard) return [];

  const projectId = createId();
  const notes = Array.isArray(legacyBoard.notes) ? legacyBoard.notes : [];
  const project = {
    id: projectId,
    title: legacyBoard.title || getLocale(language).defaults.title,
    updatedAt: legacyBoard.updatedAt || Date.now(),
    noteCount: notes.filter((n) => !n.archived).length,
    topTag: computeTopTag(notes),
  };

  writeItem(storage, getBoardStorageKey(projectId), legacyRaw);
  writeItem(storage, PROJECTS_KEY, JSON.stringify([project]));
  return [project];
}

export function persistProjects(projects, storage = getDefaultStorage()) {
  return writeItem(storage, PROJECTS_KEY, JSON.stringify(projects));
}

export function loadBoardById(projectId, language, storage = getDefaultStorage()) {
  const raw = readItem(storage, getBoardStorageKey(projectId));
  const parsed = parseJson(raw);
  if (!parsed) return createInitialBoard(language);
  return normalizeBoard(parsed, language, { dropGeneratingNotes: true });
}

export function persistBoardById(projectId, serialized, storage = getDefaultStorage()) {
  return writeItem(storage, getBoardStorageKey(projectId), serialized);
}

export function removeBoardById(projectId, storage = getDefaultStorage()) {
  try {
    storage?.removeItem(getBoardStorageKey(projectId));
    return true;
  } catch {
    return false;
  }
}
