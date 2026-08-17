import type { WalnutContext } from './walnut';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** @walnut_method
 * name: Generate Unique Email
 * description: Generate a unique email address from ${baseEmail} and store in $[uniqueEmail]
 * actionType: custom_generate_unique_email
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */

// Persistent counter store — survives across steps AND across test runs.
// Runtime variables reset every run, so increment-on-every-call (even across
// runs) requires on-disk state. One counter per base address (username@domain).
const COUNTER_FILE = path.join(os.tmpdir(), 'walnut-unique-email-counters.json');

function readCounters(): Record<string, number> {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) { /* corrupted/missing file → start fresh and overwrite below */ }
  return {};
}

function writeCounters(counters: Record<string, number>): void {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(counters, null, 2), 'utf8');
}

export async function generateUniqueEmail(ctx: WalnutContext) {
  // ctx.args[0] = value of ${baseEmail} — the base email entered as a local variable (test data)
  // ctx.args[1] = "uniqueEmail" (from $[uniqueEmail]) — runtime variable name to store the generated email into
  const baseEmail = String(ctx.args[0] ?? '').trim();
  const outputVar = ctx.args[1];

  if (!baseEmail) {
    throw new Error('[GenerateUniqueEmail] ${baseEmail} is empty — enter a base email in the local variable (test data).');
  }

  // Basic structural validation — must be a plausible email address
  const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailPattern.test(baseEmail)) {
    throw new Error(`[GenerateUniqueEmail] "${baseEmail}" is not a valid email address.`);
  }

  // Split into local part and domain at the last '@'
  const atIndex = baseEmail.lastIndexOf('@');
  const localPart = baseEmail.slice(0, atIndex);
  const domain = baseEmail.slice(atIndex + 1);

  // Identify an existing trailing "+N" numeric tag in the local part
  const tagMatch = localPart.match(/^(.*)\+(\d+)$/);
  const username = tagMatch ? tagMatch[1] : localPart;
  const parsedN = tagMatch ? parseInt(tagMatch[2], 10) : null;

  const baseKey = `${username}@${domain}`.toLowerCase();

  // Candidate 1 — persistent on-disk counter (increments across steps and runs)
  const counters = readCounters();
  const fileN = typeof counters[baseKey] === 'number' ? counters[baseKey] : null;

  // Candidate 2 — previous value of the output runtime variable (same-run chaining)
  let prevN: number | null = null;
  const prevEmail = String(ctx.getVariable(outputVar) ?? '').trim();
  if (prevEmail) {
    const prevMatch = prevEmail.match(/^(.*)\+(\d+)@([^@\s]+)$/);
    if (prevMatch && `${prevMatch[1]}@${prevMatch[3]}`.toLowerCase() === baseKey) {
      prevN = parseInt(prevMatch[2], 10);
    }
  }

  // Candidate 3 — "+N" tag already present in the base email itself
  // next = one past the highest known number:
  // - Nothing seen before:  max(1, 1, 1) + 1 = 2  → starts at +2
  // - Any prior +N:         N + 1  → +2 → +3 → +4 → +5 … (never repeats)
  const next = Math.max(fileN ?? 1, prevN ?? 1, parsedN ?? 1) + 1;

  const uniqueEmail = `${username}+${next}@${domain}`;

  if (!emailPattern.test(uniqueEmail)) {
    throw new Error(`[GenerateUniqueEmail] Generated address "${uniqueEmail}" is not a valid email address.`);
  }

  // Persist the counter so the NEXT call/run continues from here
  counters[baseKey] = next;
  writeCounters(counters);

  ctx.setVariable(outputVar, uniqueEmail);
  ctx.log(
    `[GenerateUniqueEmail] "${baseEmail}" → "${uniqueEmail}" stored in $[${outputVar}] ` +
    `(counter for ${baseKey} is now ${next}; stored in ${COUNTER_FILE})`
  );
}
