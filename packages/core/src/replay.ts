import { createGame, step, validateConfig, validBoard } from './engine.ts';
import { collides } from './shapes.ts';
import { KINDS, RULESET } from './types.ts';
import type { Config, GameEvent, GameState, Input, Piece } from './types.ts';

export interface Replay {
  schema: 1;
  ruleset: typeof RULESET;
  config: Config;
  endTick: number;
  inputs: Input[];
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function isKind(value: unknown): boolean { return KINDS.includes(value as typeof KINDS[number]); }
function isPiece(value: unknown): value is Piece {
  if (!value || typeof value !== 'object') return false;
  const p = value as Piece;
  return isKind(p.kind) && integer(p.rotation, 0, 3) && integer(p.x, -3, 9) && integer(p.y, -3, 39);
}
export function serialize(state: GameState): string { return JSON.stringify(state); }
export function restore(json: string): GameState {
  if (json.length > 1_000_000) throw new Error('Snapshot too large');
  const state = JSON.parse(json) as GameState;
  if (!state || state.schema !== 1 || state.ruleset !== RULESET || !state.config) throw new Error('Unsupported snapshot');
  validateConfig(state.config);
  const template = createGame(state.config);
  const keys = Object.keys(state).sort().join(',');
  if (keys !== Object.keys(template).sort().join(',') || !validBoard(state.board)) throw new Error('Invalid snapshot shape');
  for (const key of ['tick','score','lines','pieces','dropScore','lockTicks','puzzleIndex'] as const) {
    if (!integer(state[key], 0)) throw new Error(`Invalid ${key}`);
  }
  if (!integer(state.level, 1, 40) || !integer(state.combo, -1) || !integer(state.lockResets, 0, 15) ||
    !integer(state.gravity, 0, 120_000_000-1) || typeof state.b2b !== 'boolean' || typeof state.holdUsed !== 'boolean' ||
    !['playing','won','lost'].includes(state.status) || (state.hold !== null && !isKind(state.hold))) throw new Error('Invalid game state');
  if (!state.random || !integer(state.random.value, 0, 0xffffffff) || !Array.isArray(state.random.bag) ||
    state.random.bag.length > 7 || !state.random.bag.every(isKind) || new Set(state.random.bag).size !== state.random.bag.length ||
    !integer(state.garbageRandom, 0, 0xffffffff) || !Array.isArray(state.queue) || state.queue.length > 5 || !state.queue.every(isKind)) throw new Error('Invalid random state');
  if (state.active !== null && (!isPiece(state.active) || collides(state.board, state.active))) throw new Error('Invalid active piece');
  if ((state.status === 'playing') !== (state.active !== null)) throw new Error('Invalid lifecycle');
  const held = state.held;
  if (!held || typeof held.left !== 'boolean' || typeof held.right !== 'boolean' || typeof held.soft !== 'boolean' ||
    ![-1,0,1].includes(held.direction) || !integer(held.age, -1)) throw new Error('Invalid held input');
  const mark = state.rotationMark;
  if (mark !== null && (!mark || !integer(mark.kick, 0, 4) || typeof mark.extended !== 'boolean')) throw new Error('Invalid rotation mark');
  if (!Array.isArray(state.garbage) || state.garbage.length > 1000) throw new Error('Invalid garbage queue');
  const sequences = new Set<number>();
  let previousDue = -1, previousSequence = -1;
  for (const packet of state.garbage) {
    if (!packet || !integer(packet.due, 0) || !integer(packet.sequence, 0) || !Array.isArray(packet.holes) ||
      packet.holes.length === 0 || packet.holes.length > 100 || !packet.holes.every(h => integer(h, 0, 9)) ||
      sequences.has(packet.sequence) || packet.due < previousDue || (packet.due === previousDue && packet.sequence <= previousSequence)) throw new Error('Invalid garbage packet');
    sequences.add(packet.sequence);
    previousDue = packet.due;
    previousSequence = packet.sequence;
  }
  return state;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
// Diagnostic FNV-1a only; not an authentication or anti-cheat proof.
export function stateHash(state: GameState): string {
  const text = canonical(state);
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return value.toString(16).padStart(8, '0');
}
export function playReplay(replay: Replay): {state: GameState; events: GameEvent[]} {
  if (replay.schema !== 1 || replay.ruleset !== RULESET || !integer(replay.endTick, 0, 10_000_000) ||
    !Array.isArray(replay.inputs) || replay.inputs.length > 1_000_000) throw new Error('Invalid replay header');
  let lastTick = 0, lastSequence = -1;
  for (const input of replay.inputs) {
    if (!integer(input.tick, 1, replay.endTick) || input.tick < lastTick || !integer(input.sequence, 0) || input.sequence <= lastSequence) throw new Error('Unordered replay');
    lastTick = input.tick;
    lastSequence = input.sequence;
  }
  const state = createGame(replay.config), events: GameEvent[] = [];
  let cursor = 0;
  while (state.tick < replay.endTick && state.status === 'playing') {
    const inputs: Input[] = [];
    while (replay.inputs[cursor]?.tick === state.tick + 1) inputs.push(replay.inputs[cursor++]!);
    events.push(...step(state, inputs));
  }
  if (cursor !== replay.inputs.length || state.tick !== replay.endTick) throw new Error('Replay extends past end of game');
  return {state, events};
}
