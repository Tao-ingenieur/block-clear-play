import {createGame, emptyBoard, step} from '../packages/core/src/index.ts';
import type {Action, GameEvent, GameState, Input, Kind, Piece} from '../packages/core/src/index.ts';

export function command(state: GameState, action: Action, pressed = true, sequence = 0): Input {
  return {tick: state.tick+1, sequence, action, pressed};
}
export function tap(state: GameState, action: Action): GameEvent[] {
  const events = step(state, [command(state, action)]);
  if (state.status === 'playing') events.push(...step(state, [command(state, action, false)]));
  return events;
}
export function ticks(state: GameState, count: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++) events.push(...step(state));
  return events;
}
export function positioned(kind: Kind, x = 3, y = 36, rotation: Piece['rotation'] = 0): GameState {
  const state = createGame();
  state.active = {kind, x, y, rotation};
  state.board = emptyBoard();
  return state;
}
export function fourLine(state: GameState, hole = 5): void {
  state.board = emptyBoard();
  for (let y = 36; y < 40; y++) state.board[y] = Array.from({length: 10}, (_, x) => x === hole ? null : 'G');
  state.active = {kind: 'I', rotation: 1, x: hole-2, y: 36};
  state.lockTicks = 0;
  state.gravity = 0;
}
