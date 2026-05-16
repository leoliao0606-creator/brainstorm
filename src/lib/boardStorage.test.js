import { describe, expect, it } from 'vitest';
import {
  BOARD_KEY_PREFIX,
  LEGACY_KEY,
  PROJECTS_KEY,
  getBoardStorageKey,
  loadBoardById,
  loadProjects,
  persistProjects,
} from './boardStorage.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store),
  };
}

describe('boardStorage', () => {
  it('migrates a legacy single board into a project entry', () => {
    const legacyBoard = {
      title: 'Legacy Topic',
      updatedAt: 123,
      notes: [
        { text: 'Active', tag: 'Idea', archived: false },
        { text: 'Archived', tag: 'Idea', archived: true },
      ],
    };
    const storage = createMemoryStorage({ [LEGACY_KEY]: JSON.stringify(legacyBoard) });

    const projects = loadProjects('en', storage);
    const dump = storage.dump();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ title: 'Legacy Topic', updatedAt: 123, noteCount: 1, topTag: 'Idea' });
    expect(dump[PROJECTS_KEY]).toBe(JSON.stringify(projects));
    expect(dump[BOARD_KEY_PREFIX + projects[0].id]).toBe(JSON.stringify(legacyBoard));
  });

  it('returns existing project arrays and ignores corrupted project payloads', () => {
    const storage = createMemoryStorage({ [PROJECTS_KEY]: JSON.stringify([{ id: 'p1', title: 'Topic' }]) });
    expect(loadProjects('en', storage)).toEqual([{ id: 'p1', title: 'Topic' }]);

    const brokenStorage = createMemoryStorage({ [PROJECTS_KEY]: '{bad json' });
    expect(loadProjects('en', brokenStorage)).toEqual([]);
  });

  it('loads boards defensively and clears stale generating notes', () => {
    const storage = createMemoryStorage({
      [getBoardStorageKey('p1')]: JSON.stringify({
        title: 'Saved',
        notes: [
          { id: 'stale', text: 'Gemma is generating...', generationState: 'generating' },
          { id: 'ready', text: 'Ready idea' },
        ],
      }),
    });

    const board = loadBoardById('p1', 'en', storage);

    expect(board.title).toBe('Saved');
    expect(board.notes.map((note) => note.id)).toEqual(['ready']);
  });

  it('reports write failures instead of throwing', () => {
    const storage = {
      setItem: () => {
        throw new Error('quota');
      },
    };

    expect(persistProjects([], storage)).toBe(false);
  });
});
