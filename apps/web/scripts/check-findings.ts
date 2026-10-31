import { readFileSync } from 'node:fs';
import { FindingsValidation } from '@/validations/FindingsValidation';

/**
 * Checks a findings file a template notebook wrote against Celia's contract, and that no wallet address got into it. Run with:
 * `pnpm exec dotenv -c -- tsx scripts/check-findings.ts <path to findings.json>`
 */
const path = process.argv.at(2);

if (!path) {
  throw new Error('Give the path to a findings.json file.');
}

const text = readFileSync(path, 'utf-8');
const parsed = FindingsValidation.safeParse(JSON.parse(text));
const wallets = text.match(/0x[\da-fA-F]{40}/gu) ?? [];

if (!parsed.success) {
  console.log('REFUSED: the file does not match the contract.');

  for (const issue of parsed.error.issues) {
    console.log(`  ${issue.path.join('.')}: ${issue.message}`);
  }
} else if (wallets.length > 0) {
  console.log(
    `REFUSED: ${wallets.length} wallet address(es) in the file, which holds counts and shares only.`,
  );
} else {
  console.log(
    `OK: ${parsed.data.tests.length} tests, ${parsed.data.tests.map((test) => `${test.id}=${test.verdict}`).join(', ')}`,
  );
}

process.exit(parsed.success && wallets.length === 0 ? 0 : 1);
