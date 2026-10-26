import { createGame, generateHoles, receiveGarbage, step } from './engine.ts';
import type { GameEvent, GameState, Input } from './types.ts';

export interface Duel {
  players: [GameState, GameState];
  nextPacket: number;
  result: 'playing' | 'draw' | 'player0' | 'player1';
}
export function createDuel(seed: number): Duel {
  return {players: [createGame({seed}), createGame({seed})], nextPacket: 0, result: 'playing'};
}
export function stepDuel(duel: Duel, inputs: readonly [readonly Input[], readonly Input[]]): [GameEvent[], GameEvent[]] {
  if (duel.result !== 'playing') return [[],[]];
  // Validate both batches before advancing either state (atomic rejection).
  const copies = duel.players.map(p => structuredCloneFree(p)) as [GameState, GameState];
  const events: [GameEvent[], GameEvent[]] = [step(copies[0], inputs[0]), step(copies[1], inputs[1])];
  duel.players = copies;
  const [a,b] = copies;
  if (a.status !== 'playing' || b.status !== 'playing') {
    duel.result = a.status !== 'playing' && b.status !== 'playing' ? 'draw' : a.status === 'playing' ? 'player0' : 'player1';
    return events;
  }
  for (const player of [0,1] as const) {
    const source = copies[player], target = copies[player === 0 ? 1 : 0];
    for (const event of events[player]) {
      if (event.type === 'lock' && event.attack > 0) receiveGarbage(target, generateHoles(source, event.attack), source.tick + 60, duel.nextPacket++);
    }
  }
  return events;
}
function structuredCloneFree<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
