import { ACTIONS } from './engine.ts';
import { RULESET } from './types.ts';
import type { Input } from './types.ts';

export interface Session {
  phase: 'idle' | 'connecting' | 'handshake' | 'ready' | 'backoff' | 'closed';
  attempts: number;
  retryAt: number;
  lastNow: number;
}
export type SessionEvent =
  { type: 'start' | 'transportOpen' | 'disconnect' | 'poll' | 'close'; now: number } |
  { type: 'welcome'; now: number; protocol: number; ruleset: string };
export type SessionEffect = 'connect' | 'sendHello' | 'closeTransport' | 'ready';
export function createSession(): Session { return {phase:'idle',attempts:0,retryAt:0,lastNow:0}; }
// Pure state machine. Caller supplies a monotonic clock and executes effects via its adapter.
export function sessionStep(session: Session, event: SessionEvent): SessionEffect[] {
  if (!Number.isSafeInteger(event.now) || event.now < session.lastNow) throw new Error('Non-monotonic session time');
  session.lastNow=event.now;
  if (session.phase==='closed') return [];
  if (event.type==='close') { session.phase='closed'; return ['closeTransport']; }
  if (event.type==='start' && session.phase==='idle') { session.phase='connecting'; return ['connect']; }
  if (event.type==='transportOpen' && session.phase==='connecting') { session.phase='handshake'; return ['sendHello']; }
  if (event.type==='welcome' && session.phase==='handshake') {
    if(event.protocol!==1 || event.ruleset!==RULESET) { session.phase='closed'; return ['closeTransport']; }
    session.phase='ready'; session.attempts=0; return ['ready'];
  }
  if (event.type==='disconnect' && ['connecting','handshake','ready'].includes(session.phase)) {
    session.phase='backoff';
    session.retryAt=event.now+Math.min(8000,500*2**Math.min(session.attempts,4));
    session.attempts++;
    return ['closeTransport'];
  }
  if (event.type==='poll' && session.phase==='backoff' && event.now>=session.retryAt) {
    session.phase='connecting'; return ['connect'];
  }
  return [];
}
export interface InputGate { lastSequence: number; acceptedPerTick: Record<string, number> }
export function createInputGate(): InputGate { return {lastSequence:-1,acceptedPerTick:{}}; }
// For authoritative online games only. Offline replay intentionally has different timing policy.
export function acceptInputs(gate: InputGate, inputs: readonly Input[], serverTick: number): void {
  if (!Number.isSafeInteger(serverTick) || serverTick < 0 || inputs.length>64) throw new Error('Invalid input envelope');
  const counts={...gate.acceptedPerTick};
  let sequence=gate.lastSequence;
  for(const input of inputs) {
    if(!Number.isSafeInteger(input.tick) || input.tick<Math.max(1,serverTick-60) || input.tick>serverTick+6 ||
      !Number.isSafeInteger(input.sequence) || input.sequence<=sequence || !ACTIONS.includes(input.action) ||
      input.action==='rotate180' || typeof input.pressed!=='boolean') throw new Error('Rejected online input');
    sequence=input.sequence;
    const count=(counts[input.tick]??0)+1;
    if(count>8) throw new Error('Input rate limit');
    counts[input.tick]=count;
  }
  for(const tick of Object.keys(counts)) if(Number(tick)<serverTick-60) delete counts[tick];
  gate.lastSequence=sequence;
  gate.acceptedPerTick=counts;
}
