import { HEIGHT, WIDTH } from './types.ts';
import type { Board, Kind, Piece, Point, Rotation } from './types.ts';

// Coordinates are local to a 3x3 frame, or 4x4 for I/O. y increases downwards.
export const SHAPES: Record<Kind, readonly (readonly Point[])[]> = {
  I: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]],
  O: Array.from({length: 4}, () => [[1,0],[2,0],[1,1],[2,1]] as const),
  T: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
  S: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]],
  Z: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]],
  J: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
  L: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]],
};

// SRS offsets converted from y-up tables to this engine's y-down coordinates.
const JLSTZ: Record<string, readonly Point[]> = {
  '01': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '10': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '12': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '21': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '23': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '32': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '30': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '03': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
};
const I_KICKS: Record<string, readonly Point[]> = {
  '01': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '10': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '12': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  '21': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '23': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '32': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '30': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '03': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
};
export function cells(piece: Piece): Point[] {
  return SHAPES[piece.kind][piece.rotation]!.map(([x,y]) => [x + piece.x, y + piece.y]);
}
export function occupied(board: Board, x: number, y: number): boolean {
  return x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y]![x] !== null;
}
export function collides(board: Board, piece: Piece): boolean {
  return cells(piece).some(([x,y]) => occupied(board, x, y));
}
export function rotate(board: Board, piece: Piece, delta: -1 | 1 | 2): { piece: Piece; kick: number } | null {
  const rotation = ((piece.rotation + delta + 4) % 4) as Rotation;
  const offsets = piece.kind === 'O' || delta === 2 ? [[0,0] as const] :
    (piece.kind === 'I' ? I_KICKS : JLSTZ)[`${piece.rotation}${rotation}`]!;
  for (let kick = 0; kick < offsets.length; kick++) {
    const [dx,dy] = offsets[kick]!;
    const candidate = {...piece, rotation, x: piece.x + dx, y: piece.y + dy};
    if (!collides(board, candidate)) return {piece: candidate, kick};
  }
  return null;
}
export function ghost(board: Board, piece: Piece): Piece {
  let result = {...piece};
  while (!collides(board, {...result, y: result.y + 1})) result.y++;
  return result;
}
