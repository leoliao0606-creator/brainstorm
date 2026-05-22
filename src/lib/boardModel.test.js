import { describe, expect, it } from 'vitest';
import {
  createNote,
  deleteNote,
  getDefaultNotePosition,
  mergeBoards,
  normalizeBoard,
  normalizeDismissedNotes,
  normalizeNoteColor,
  normalizeNotePosition,
  selectAiContextNotes,
} from './boardModel.js';

describe('boardModel', () => {
  it('normalizes imported board data and keeps version 3', () => {
    const board = normalizeBoard({
      title: '',
      userName: 'Alice',
      aiDivergence: 500,
      aiSpecificity: -20,
      noteFontScale: 4,
      notes: [
        { text: '  Keep this idea ', tags: ['Idea'], votes: -2, createdAt: 10, color: 'mint' },
        { text: '   ' },
      ],
    }, 'en');

    expect(board.version).toBe(3);
    expect(board.title).toBe('New Brainstorm Topic');
    expect(board.owner).toBe('Alice');
    expect(board.aiDivergence).toBe(100);
    expect(board.aiSpecificity).toBe(0);
    expect(board.noteFontScale).toBe(1.45);
    expect(board.notes).toHaveLength(1);
    expect(board.notes[0]).toMatchObject({
      text: 'Keep this idea',
      tag: 'Idea',
      votes: 0,
      position: getDefaultNotePosition(0),
      color: 'mint',
    });
  });

  it('normalizes note color choices', () => {
    expect(normalizeNoteColor('blue')).toBe('blue');
    expect(normalizeNoteColor('not-a-color')).toBe('');
    expect(createNote({ text: 'Color', color: 'rose', fallbackAuthor: 'Me' }).color).toBe('rose');
  });

  it('normalizes note positions for the freeform canvas', () => {
    expect(normalizeNotePosition({ x: 12.4, y: 98.8 })).toEqual({ x: 12, y: 99 });
    expect(normalizeNotePosition({ x: -50, y: 9001 })).toEqual({ x: -50, y: 9001 });
    expect(normalizeNotePosition({ x: -60000, y: 60000 })).toEqual({ x: -50000, y: 50000 });
    expect(normalizeNotePosition(null, { x: 120, y: 240 })).toEqual({ x: 120, y: 240 });
  });

  it('can drop stale generating notes when loading saved boards', () => {
    const rawBoard = {
      title: 'Topic',
      notes: [
        { id: 'stale', text: 'Gemma is generating...', generationState: 'generating' },
        { id: 'ready', text: 'Ready idea', generationState: 'ready' },
      ],
    };

    expect(normalizeBoard(rawBoard, 'en').notes.map((note) => note.id)).toEqual(['stale', 'ready']);
    expect(normalizeBoard(rawBoard, 'en', { dropGeneratingNotes: true }).notes.map((note) => note.id)).toEqual(['ready']);
  });

  it('deduplicates dismissed notes and keeps the most recent entries', () => {
    const dismissed = Array.from({ length: 26 }, (_, index) => `Idea ${index}`);
    const normalized = normalizeDismissedNotes([...dismissed, ' idea 25 ']);

    expect(normalized).toHaveLength(24);
    expect(normalized[0]).toBe('Idea 2');
    expect(normalized.at(-1)).toBe('Idea 25');
  });

  it('prioritizes weighted and user notes for AI context', () => {
    const notes = [
      { id: 'prompt', text: 'Prompt', source: 'prompt', aiWeight: 3, pinned: true, votes: 10, updatedAt: 5 },
      { id: 'ai', text: 'Weighted AI', source: 'ai', aiWeight: 3, pinned: false, votes: 0, updatedAt: 3 },
      { id: 'user', text: 'User idea', source: 'user', aiWeight: 0, pinned: true, votes: 1, updatedAt: 4 },
    ];

    expect(selectAiContextNotes(notes).map((note) => note.id)).toEqual(['ai', 'user']);
  });

  it('does not add generating placeholders to dismissed notes', () => {
    const generating = createNote({
      text: 'Gemma is generating...',
      generationState: 'generating',
      fallbackAuthor: 'Me',
    });
    const board = { title: 'Topic', dismissedNotes: [], notes: [generating] };

    expect(deleteNote(board, generating.id).dismissedNotes).toEqual([]);
  });

  it('merges older cross-tab boards without overwriting newer local note edits', () => {
    const merged = mergeBoards({
      title: 'Local',
      updatedAt: 30,
      dismissedNotes: ['Old'],
      notes: [
        { id: 'same', text: 'Local edit', updatedAt: 25, createdAt: 1 },
        { id: 'local-only', text: 'Local note', updatedAt: 22, createdAt: 2 },
      ],
    }, {
      title: 'Incoming',
      updatedAt: 20,
      dismissedNotes: ['Incoming'],
      notes: [
        { id: 'same', text: 'Older edit', updatedAt: 10, createdAt: 1 },
        { id: 'incoming-only', text: 'Incoming note', updatedAt: 18, createdAt: 3 },
      ],
    }, 'en');

    expect(merged.title).toBe('Local');
    expect(merged.dismissedNotes).toEqual(['Old', 'Incoming']);
    expect(merged.notes.map((note) => note.id)).toContain('incoming-only');
    expect(merged.notes.find((note) => note.id === 'same').text).toBe('Local edit');
  });
});
