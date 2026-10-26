import { occupied } from './shapes.ts';
import type { Board, Piece, RotationMark, Spin } from './types.ts';

export function classifySpin(board: Board, piece: Piece, mark: RotationMark | null): Spin {
  if (piece.kind !== 'T' || !mark || mark.extended) return 'none';
  const x = piece.x, y = piece.y;
  const corners = [[x,y],[x+2,y],[x+2,y+2],[x,y+2]].map(([cx,cy]) => occupied(board, cx!, cy!));
  if (corners.filter(Boolean).length < 3) return 'none';
  const fronts = [[0,1],[1,2],[2,3],[3,0]][piece.rotation]!;
  return (corners[fronts[0]!] && corners[fronts[1]!]) || mark.kick === 4 ? 'full' : 'mini';
}
export function calculateScore(lines: number, spin: Spin, level: number, previousCombo: number,
  previousB2b: boolean, perfect: boolean, drop: number) {
  const maxLines = spin === 'full' ? 3 : spin === 'mini' ? 2 : 4;
  if (!Number.isInteger(lines) || lines < 0 || lines > maxLines || !Number.isInteger(level) || level < 1 || level > 40 ||
    !Number.isSafeInteger(previousCombo) || previousCombo < -1 || !Number.isSafeInteger(drop) || drop < 0 ||
    (perfect && lines === 0)) throw new Error('Invalid score input');
  const table = spin === 'full' ? [400,800,1200,1600] : spin === 'mini' ? [100,200,400] : [0,100,300,500,800];
  const difficult = lines > 0 && (lines === 4 || spin !== 'none');
  const b2bBonus = difficult && previousB2b;
  const base = table[lines]! * level * (b2bBonus ? 1.5 : 1);
  const combo = lines > 0 ? previousCombo + 1 : -1;
  const comboScore = Math.max(0, combo) * 50 * level;
  const perfectScore = perfect ? [0,800,1200,1800,2000][lines]! * level : 0;
  let attack = lines === 0 ? 0 : (spin === 'full' ? [0,2,4,6] : spin === 'mini' ? [0,0,1] : [0,0,1,2,4])[lines]!;
  if (lines > 0) attack += (b2bBonus ? 1 : 0) + Math.min(4, Math.floor(Math.max(0, combo) / 2)) + (perfect ? 10 : 0);
  return {base, combo, comboScore, perfectScore, total: base + comboScore + perfectScore + drop,
    attack, b2bBonus, b2b: lines === 0 ? previousB2b : difficult};
}
