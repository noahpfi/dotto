// mulberry32 = small, fast, seedable, non-cryptographic PRNG
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomIntBetween(random: () => number, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError(`randomIntBetween: non-finite bounds ${min}..${max}`);
  }
  if (max < min) throw new RangeError(`randomIntBetween: inverted range ${min}..${max}`);
  return min + Math.floor(random() * (max - min + 1));
}

// empty pool = config bug
export function pick<T>(random: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pick: empty list');
  const item = items[Math.floor(random() * items.length)];
  // unreachable, satisfies noUncheckedIndexedAccess
  if (item === undefined) throw new RangeError('pick: index out of range');
  return item;
}
