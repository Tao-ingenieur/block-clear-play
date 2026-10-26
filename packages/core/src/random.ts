import { KINDS } from './types.ts';
import type { Kind, RandomState } from './types.ts';

// All 2^32 seeds are supported. This stream does not use system randomness.
export function nextRandom(value: number): number {
  return (Math.imul(value, 1664525) + 1013904223) >>> 0;
}
export function draw(random: RandomState): Kind {
  if (random.bag.length === 0) {
    random.bag = [...KINDS];
    for (let i = 6; i > 0; i--) {
      // Rejection sampling avoids modulo bias in Fisher-Yates.
      const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      do { random.value = nextRandom(random.value); } while (random.value >= limit);
      const j = random.value % (i + 1);
      [random.bag[i], random.bag[j]] = [random.bag[j]!, random.bag[i]!];
    }
  }
  return random.bag.pop()!;
}
