export const RULESET = 'echo-v1' as const;
export const TICK_RATE = 120;
export const WIDTH = 10;
export const HEIGHT = 40;
export const HIDDEN = 20;
export const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type Kind = typeof KINDS[number];
export type Cell = Kind | 'G' | null;
export type Board = Cell[][];
export type Rotation = 0 | 1 | 2 | 3;
export type Mode = 'marathon' | 'sprint' | 'ultra' | 'master' | 'blitz' | 'puzzle';
export type Preset = 'beginner' | 'standard' | 'hardcore';
export type Spin = 'none' | 'mini' | 'full';
export type Action = 'left' | 'right' | 'soft' | 'hard' | 'cw' | 'ccw' | 'rotate180' | 'hold';
export type Input = { tick: number; sequence: number; action: Action; pressed: boolean };
export type Point = readonly [number, number];
export interface Piece { kind: Kind; rotation: Rotation; x: number; y: number }
export interface RotationMark { kick: number; extended: boolean }
export interface Controls { das: number; arr: number; lock: number; soft: number; resets: number }
export interface Puzzle {
  id: string;
  board: Board;
  queue: Kind[];
  targetLines: number;
  maxPieces: number;
  hold: boolean;
}
export interface Config {
  seed: number;
  mode: Mode;
  preset: Preset;
  allow180: boolean;
  puzzle: Puzzle | null;
}
export interface RandomState { value: number; bag: Kind[] }
export interface Garbage { due: number; sequence: number; holes: number[] }
export interface ScoreEvent {
  type: 'lock'; tick: number; lines: number; spin: Spin; base: number;
  level: number; combo: number; comboScore: number; b2b: boolean;
  perfectClear: boolean; perfectScore: number; drop: number;
  total: number; attack: number;
}
export interface SpawnEvent { type: 'spawn'; tick: number; kind: Kind }
export interface EndEvent { type: 'end'; tick: number; reason: 'topout' | 'goal' | 'time' | 'pieces' }
export type GameEvent = ScoreEvent | SpawnEvent | EndEvent;
export interface GameState {
  schema: 1;
  ruleset: typeof RULESET;
  config: Config;
  tick: number;
  board: Board;
  random: RandomState;
  garbageRandom: number;
  queue: Kind[];
  puzzleIndex: number;
  active: Piece | null;
  hold: Kind | null;
  holdUsed: boolean;
  rotationMark: RotationMark | null;
  gravity: number;
  lockTicks: number;
  lockResets: number;
  held: { left: boolean; right: boolean; soft: boolean; direction: -1 | 0 | 1; age: number };
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: boolean;
  pieces: number;
  dropScore: number;
  status: 'playing' | 'won' | 'lost';
  garbage: Garbage[];
}
