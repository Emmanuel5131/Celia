// Long enough to catch every address family Celia reads (EVM 42, Tron 34, Solana 32 to 44, Bitcoin 26 to 62), short enough to skip words.
const addressLike = /[A-Za-z0-9]{25,}/gu;

/**
 * Finds the words in a tool call that could be a wallet address, however deep they sit in the arguments and inside notebook
 * code. They are lower-cased so a match does not depend on how an address was written.
 * @param value - The arguments of a tool call.
 * @returns The distinct address-like words.
 */
export function addressCandidates(value: unknown): string[] {
  const found = new Set<string>();

  const visit = (part: unknown) => {
    if (typeof part === 'string') {
      for (const match of part.matchAll(addressLike)) {
        found.add(match[0].toLowerCase());
      }
    } else if (Array.isArray(part)) {
      for (const item of part) {
        visit(item);
      }
    } else if (part && typeof part === 'object') {
      for (const item of Object.values(part)) {
        visit(item);
      }
    }
  };

  visit(value);

  return [...found];
}
