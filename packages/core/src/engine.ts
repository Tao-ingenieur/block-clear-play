import { HEIGHT, HIDDEN, KINDS, RULESET, TICK_RATE, WIDTH } from './types.ts';
import type { Action, Board, Config, Controls, GameEvent, GameState, Input, Kind, Piece, Preset } from './types.ts';
import { draw, nextRandom } from './random.ts';
import { cells, collides, ghost, rotate } from './shapes.ts';
import { calculateScore, classifySpin } from './scoring.ts';

export const CONTROLS: Record<Preset, Controls> = {
  beginner: {das: 22, arr: 6, lock: 90, soft: 10, resets: 15},
  standard: {das: 18, arr: 3, lock: 60, soft: 20, resets: 15},
  hardcore: {das: 12, arr: 0, lock: 36, soft: 40, resets: 15},
};
export const GRAVITY_UNIT = 1_000_000;
// Microcells per second; precomputed integer recurrence is identical across hosts.
export const GRAVITY = [GRAVITY_UNIT];
for (let level = 1; level < 40; level++) GRAVITY.push(Math.min(2400 * GRAVITY_UNIT, Math.floor(GRAVITY[level-1]! * 3 / 2)));
const MODES = ['marathon','sprint','ultra','master','blitz','puzzle'];
const PRESETS = ['beginner','standard','hardcore'];
export const ACTIONS: readonly Action[] = ['left','right','soft','hard','cw','ccw','rotate180','hold'];

export function emptyBoard(): Board {
  return Array.from({length: HEIGHT}, () => Array<null>(WIDTH).fill(null));
}
export function validBoard(value: unknown): value is Board {
  return Array.isArray(value) && value.length === HEIGHT && value.every(row => Array.isArray(row) && row.length === WIDTH &&
    row.every(cell => cell === null || cell === 'G' || KINDS.includes(cell)));
}
export function validateConfig(config: Config): void {
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff ||
    !MODES.includes(config.mode) || !PRESETS.includes(config.preset) || typeof config.allow180 !== 'boolean') throw new Error('Invalid config');
  if (config.mode === 'puzzle') {
    const p = config.puzzle;
    if (!p || typeof p.id !== 'string' || !validBoard(p.board) || !Array.isArray(p.queue) || p.queue.length === 0 ||
      !p.queue.every(k => KINDS.includes(k)) || !Number.isSafeInteger(p.targetLines) || p.targetLines < 1 ||
      !Number.isSafeInteger(p.maxPieces) || p.maxPieces < 1 || typeof p.hold !== 'boolean') throw new Error('Invalid puzzle');
  } else if (config.puzzle !== null) throw new Error('Puzzle config in non-puzzle mode');
}
export function createGame(options: Partial<Config> = {}): GameState {
  const config: Config = {seed: 1, mode: 'marathon', preset: 'standard', allow180: false, puzzle: null, ...options};
  validateConfig(config);
  const state: GameState = {
    schema: 1, ruleset: RULESET, config: JSON.parse(JSON.stringify(config)) as Config,
    tick: 0, board: config.puzzle ? config.puzzle.board.map(row => [...row]) : emptyBoard(),
    random: {value: config.seed, bag: []}, garbageRandom: (config.seed ^ 0x9e3779b9) >>> 0,
    queue: [], puzzleIndex: 0, active: null, hold: null, holdUsed: false, rotationMark: null,
    gravity: 0, lockTicks: 0, lockResets: 0,
    held: {left: false, right: false, soft: false, direction: 0, age: 0},
    score: 0, lines: 0, level: 1, combo: -1, b2b: false, pieces: 0, dropScore: 0,
    status: 'playing', garbage: [],
  };
  spawn(state, [], null);
  return state;
}
function end(state: GameState, events: GameEvent[], reason: 'topout' | 'goal' | 'time' | 'pieces'): void {
  state.status = reason === 'goal' || reason === 'time' ? 'won' : 'lost';
  state.active = null;
  events.push({type: 'end', tick: state.tick, reason});
}
function nextKind(state: GameState): Kind | null {
  const puzzle = state.config.puzzle;
  if (puzzle) return puzzle.queue[state.puzzleIndex++] ?? null;
  while (state.queue.length < 6) state.queue.push(draw(state.random));
  return state.queue.shift()!;
}
function spawn(state: GameState, events: GameEvent[], heldKind: Kind | null): void {
  const kind = heldKind ?? nextKind(state);
  if (!kind) { end(state, events, 'pieces'); return; }
  // Top edge of spawn frame is the final hidden row; I appears in visible row 0.
  const piece: Piece = {kind, rotation: 0, x: 3, y: HIDDEN - 1};
  state.active = piece;
  state.gravity = 0;
  state.lockTicks = 0;
  state.lockResets = 0;
  state.rotationMark = null;
  if (collides(state.board, piece)) { end(state, events, 'topout'); return; }
  events.push({type: 'spawn', tick: state.tick, kind});
}
function grounded(state: GameState): boolean {
  return state.active !== null && collides(state.board, {...state.active, y: state.active.y + 1});
}
function resetLock(state: GameState, wasGrounded: boolean): void {
  const controls = CONTROLS[state.config.preset];
  if (wasGrounded && state.lockResets < controls.resets) { state.lockTicks = 0; state.lockResets++; }
}
function shift(state: GameState, dx: number, dy: number): boolean {
  const piece = state.active!;
  const candidate = {...piece, x: piece.x + dx, y: piece.y + dy};
  if (collides(state.board, candidate)) return false;
  const wasGrounded = grounded(state);
  state.active = candidate;
  state.rotationMark = null;
  if (dx !== 0) resetLock(state, wasGrounded);
  return true;
}
function rotateActive(state: GameState, delta: -1 | 1 | 2): void {
  const piece = state.active;
  if (!piece || (delta === 2 && !state.config.allow180)) return;
  const wasGrounded = grounded(state);
  const result = rotate(state.board, piece, delta);
  if (!result) return;
  state.active = result.piece;
  state.rotationMark = {kick: result.kick, extended: delta === 2};
  if (piece.kind !== 'O') resetLock(state, wasGrounded);
}
export function clearLines(board: Board): number {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const count = HEIGHT - remaining.length;
  board.splice(0, HEIGHT, ...Array.from({length: count}, () => Array<null>(WIDTH).fill(null)), ...remaining);
  return count;
}
function cancelGarbage(state: GameState, attack: number): number {
  for (const entry of state.garbage) {
    if (entry.due > state.tick || attack === 0) continue;
    const canceled = Math.min(attack, entry.holes.length);
    entry.holes.splice(0, canceled);
    attack -= canceled;
  }
  state.garbage = state.garbage.filter(entry => entry.holes.length > 0);
  return attack;
}
function injectGarbage(state: GameState, events: GameEvent[]): void {
  let budget = 8;
  for (const entry of state.garbage) {
    while (entry.due <= state.tick && entry.holes.length > 0 && budget > 0) {
      const hole = entry.holes.shift()!;
      const top = state.board.shift()!;
      state.board.push(Array.from({length: WIDTH}, (_, x) => x === hole ? null : 'G'));
      budget--;
      if (top.some(cell => cell !== null)) { end(state, events, 'topout'); return; }
    }
  }
  state.garbage = state.garbage.filter(entry => entry.holes.length > 0);
}
function lock(state: GameState, events: GameEvent[]): void {
  const piece = state.active!;
  const spin = classifySpin(state.board, piece, state.rotationMark);
  for (const [x,y] of cells(piece)) state.board[y]![x] = piece.kind;
  const lines = clearLines(state.board);
  const perfectClear = lines > 0 && state.board.every(row => row.every(cell => cell === null));
  const score = calculateScore(lines, spin, state.level, state.combo, state.b2b, perfectClear, state.dropScore);
  const attack = cancelGarbage(state, score.attack);
  events.push({type: 'lock', tick: state.tick, lines, spin, base: score.base, level: state.level,
    combo: score.combo, comboScore: score.comboScore, b2b: score.b2bBonus, perfectClear,
    perfectScore: score.perfectScore, drop: state.dropScore, total: score.total, attack});
  // Drop points were credited immediately for live score feedback.
  state.score += score.total - state.dropScore;
  state.dropScore = 0;
  state.combo = score.combo;
  state.b2b = score.b2b;
  state.lines += lines;
  state.pieces++;
  state.holdUsed = false;
  if (lines === 0) injectGarbage(state, events);
  if (state.status !== 'playing') return;
  if (state.board.slice(0, HIDDEN).some(row => row.some(cell => cell !== null))) { end(state, events, 'topout'); return; }
  if ((state.config.mode === 'sprint' && state.lines >= 40) || (state.config.mode === 'master' && state.lines >= 200) ||
    (state.config.puzzle && state.lines >= state.config.puzzle.targetLines)) { end(state, events, 'goal'); return; }
  if (state.config.puzzle && state.pieces >= state.config.puzzle.maxPieces) { end(state, events, 'pieces'); return; }
  if (state.config.mode !== 'blitz') state.level = Math.min(40, Math.floor(state.lines / 10) + 1);
  spawn(state, events, null);
}
function creditDrop(state: GameState, points: number): void { state.score += points; state.dropScore += points; }
function press(state: GameState, action: Exclude<Action, 'soft'>, events: GameEvent[]): void {
  switch (action) {
    case 'left': shift(state, -1, 0); break;
    case 'right': shift(state, 1, 0); break;
    case 'cw': rotateActive(state, 1); break;
    case 'ccw': rotateActive(state, -1); break;
    case 'rotate180': rotateActive(state, 2); break;
    case 'hard': {
      const piece = state.active!;
      const landing = ghost(state.board, piece);
      const distance = landing.y - piece.y;
      if (distance > 0) state.rotationMark = null;
      state.active = landing;
      creditDrop(state, distance * 2);
      lock(state, events);
      break;
    }
    case 'hold': {
      if (state.holdUsed || (state.config.puzzle && !state.config.puzzle.hold)) break;
      const previous = state.hold;
      state.hold = state.active!.kind;
      state.holdUsed = true;
      // Accrued drop points remain credited but belong to the held piece's turn.
      state.dropScore = 0;
      spawn(state, events, previous);
      break;
    }
  }
}
function handleInput(state: GameState, input: Input, events: GameEvent[]): void {
  const held = state.held;
  if (input.action === 'left' || input.action === 'right') {
    if (held[input.action] === input.pressed) return;
    held[input.action] = input.pressed;
    held.direction = input.pressed ? (input.action === 'left' ? -1 : 1) : held.left ? -1 : held.right ? 1 : 0;
    held.age = -1;
    if (input.pressed) press(state, input.action, events);
  } else if (input.action === 'soft') held.soft = input.pressed;
  else if (input.pressed) press(state, input.action, events);
}
function repeatMovement(state: GameState): void {
  const held = state.held, controls = CONTROLS[state.config.preset];
  if (held.direction === 0) return;
  held.age++;
  if (held.age < controls.das) return;
  if (controls.arr === 0) {
    while (shift(state, held.direction, 0)) { /* at most WIDTH cells */ }
  } else if ((held.age - controls.das) % controls.arr === 0) shift(state, held.direction, 0);
}
export function releaseInputs(state: GameState): void {
  state.held = {left: false, right: false, soft: false, direction: 0, age: 0};
}
export function step(state: GameState, inputs: readonly Input[] = []): GameEvent[] {
  let previousSequence = -1;
  for (const input of inputs) {
    if (!Number.isSafeInteger(input.sequence) || input.sequence <= previousSequence || input.tick !== state.tick + 1 ||
      !ACTIONS.includes(input.action) || typeof input.pressed !== 'boolean') throw new Error('Invalid tick input');
    previousSequence = input.sequence;
  }
  if (state.status !== 'playing') return [];
  state.tick++;
  const events: GameEvent[] = [];
  const timed = state.config.mode === 'ultra' || state.config.mode === 'blitz';
  if (timed && state.tick >= 120 * TICK_RATE) { end(state, events, 'time'); return events; }
  if (state.config.mode === 'blitz') state.level = Math.min(10, Math.floor(state.tick / (15 * TICK_RATE)) + 1);
  for (const input of inputs) {
    if (state.status !== 'playing') break;
    handleInput(state, input, events);
  }
  if (state.status !== 'playing') return events;
  repeatMovement(state);
  if (state.config.mode !== 'puzzle') {
    const speed = state.config.mode === 'master' ? 1200 * GRAVITY_UNIT : GRAVITY[state.level-1]!;
    state.gravity += Math.min(2400 * GRAVITY_UNIT, speed * (state.held.soft ? CONTROLS[state.config.preset].soft : 1));
    const threshold = TICK_RATE * GRAVITY_UNIT;
    while (state.gravity >= threshold) {
      state.gravity -= threshold;
      if (!shift(state, 0, 1)) { state.gravity = 0; break; }
      if (state.held.soft) creditDrop(state, 1);
    }
    if (grounded(state)) {
      state.lockTicks++;
      const delay = state.config.mode === 'master' ? 36 : CONTROLS[state.config.preset].lock;
      if (state.lockTicks >= delay) lock(state, events);
    }
  }
  return events;
}
export function receiveGarbage(state: GameState, holes: readonly number[], due: number, sequence: number): void {
  if (!Number.isSafeInteger(due) || due < state.tick || !Number.isSafeInteger(sequence) || sequence < 0 ||
    holes.length === 0 || holes.length > 100 || holes.some(x => !Number.isInteger(x) || x < 0 || x >= WIDTH) ||
    state.garbage.some(entry => entry.sequence === sequence)) throw new Error('Invalid garbage');
  state.garbage.push({due, sequence, holes: [...holes]});
  state.garbage.sort((a,b) => a.due - b.due || a.sequence - b.sequence);
}
export function generateHoles(state: GameState, count: number): number[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > 100) throw new Error('Invalid attack size');
  return Array.from({length: count}, () => {
    // Rejection sampling, independent of the piece bag stream.
    do { state.garbageRandom = nextRandom(state.garbageRandom); } while (state.garbageRandom >= 4294967290);
    return state.garbageRandom % WIDTH;
  });
}
