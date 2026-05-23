import { hashString } from './ids.js';

export function autoResizeTextarea(element) {
  if (!element) return;
  element.style.height = '0px';
  element.style.height = `${element.scrollHeight}px`;
}

export function downloadBoard(board) {
  if (typeof window === 'undefined') return;
  const fileName = `${board.title || 'brainstorm'}`.trim().replace(/\s+/g, '-').slice(0, 24) || 'brainstorm-board';
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.json`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function toneIndexForNote(note) {
  return (hashString(note.tag || note.id) % 6) + 1;
}

export function tiltForNote(noteId) {
  return ((hashString(noteId) % 9) - 4) * 1.1;
}

export function visualDepthForNote(note) {
  const votes = Math.max(0, Number(note?.votes) || 0);
  const aiWeight = Math.max(0, Math.min(3, Math.round(Number(note?.aiWeight) || 0)));
  const voteDepth = Math.min(1, Math.log2(votes + 1) / 4);
  const weightDepth = aiWeight / 3;

  return Math.min(1, voteDepth * 0.52 + weightDepth * 0.48);
}

const PROJECT_TONES = [
  { gradient: 'linear-gradient(145deg, #fff9e6, #fde68a)', tape: 'rgba(245,158,11,0.35)' },
  { gradient: 'linear-gradient(145deg, #e6fff6, #a7f3d0)', tape: 'rgba(16,185,129,0.30)' },
  { gradient: 'linear-gradient(145deg, #e6f0ff, #bfdbfe)', tape: 'rgba(59,130,246,0.28)' },
  { gradient: 'linear-gradient(145deg, #f0e6ff, #ddd6fe)', tape: 'rgba(139,92,246,0.28)' },
  { gradient: 'linear-gradient(145deg, #ffe6f4, #fbcfe8)', tape: 'rgba(236,72,153,0.26)' },
  { gradient: 'linear-gradient(145deg, #fff0e6, #fed7aa)', tape: 'rgba(249,115,22,0.28)' },
];

export function projectTone(id) {
  return PROJECT_TONES[hashString(id) % PROJECT_TONES.length];
}
