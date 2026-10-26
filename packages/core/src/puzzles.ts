import { emptyBoard } from './engine.ts';
import type { Action, Puzzle } from './types.ts';

export interface PuzzleEntry { puzzle: Puzzle; solution: Action[] }
function travel(distance: number): Action[] {
  return Array.from({length: Math.abs(distance)}, () => distance < 0 ? 'left' : 'right');
}
// Original introductory scenarios. Each ships with an independently replayable solution.
export function introductoryPuzzles(): PuzzleEntry[] {
  const entries: PuzzleEntry[] = [];
  for (let hole = 0; hole < 10; hole++) {
    const board = emptyBoard();
    for (let y = 36; y < 40; y++) board[y] = Array.from({length: 10}, (_, x) => x === hole ? null : 'G');
    entries.push({puzzle: {id: `column-${hole+1}`, board, queue: ['I'], targetLines: 4, maxPieces: 1, hold: false},
      solution: ['cw', ...travel(hole - 5), 'hard']});
  }
  for (let hole = 0; hole < 9; hole++) {
    const board = emptyBoard();
    for (let y = 38; y < 40; y++) board[y] = Array.from({length: 10}, (_, x) => x === hole || x === hole+1 ? null : 'G');
    entries.push({puzzle: {id: `square-${hole+1}`, board, queue: ['O'], targetLines: 2, maxPieces: 1, hold: false},
      solution: [...travel(hole - 4), 'hard']});
  }
  const board = emptyBoard();
  board[39] = Array.from({length: 10}, (_, x) => x >= 3 && x <= 6 ? null : 'G');
  entries.push({puzzle: {id: 'first-line', board, queue: ['I'], targetLines: 1, maxPieces: 1, hold: false}, solution: ['hard']});
  return entries;
}
