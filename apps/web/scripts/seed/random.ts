const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A small seeded random generator, so the same run gives the same data. */
function mulberry32(seed: number) {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const random = mulberry32(20_261_027);
export const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
export const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)] as T;
const chars = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[int(0, alphabet.length - 1)]).join('');
export const hex = (length: number) => chars('0123456789abcdef', length);
export const base58Chars = (length: number) => chars(base58, length);

/** Picks an item with the chance given by its weight. */
export function weighted<T>(items: [T, number][]) {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;

  for (const [item, weight] of items) {
    roll -= weight;

    if (roll < 0) {
      return item;
    }
  }

  return items[0]?.[0] as T;
}

/** A standard normal number, so sizes cluster around the middle with a long tail of large ones. */
const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

/** A number from a log-normal spread: `median` is the middle, `spread` how wide it is. */
export const logNormal = (median: number, spread: number) => median * Math.exp(spread * normal());

/** A wait with a long tail: most arrive soon, a few much later. */
export const waiting = (mean: number) => -Math.log(1 - random()) * mean;
