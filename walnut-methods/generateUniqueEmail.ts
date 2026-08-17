import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Generate Unique Email
 * description: Generate a unique email address from ${baseEmail} and store in $[uniqueEmail]
 * actionType: custom_generate_unique_email
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */

// Number is derived from the current time (seconds since 2024-01-01 UTC).
// It strictly increases on every call and every run — no state needs to
// survive between runs (runtime variables reset per run, and local files do
// not persist on remote/ephemeral runners). This guarantees a new, larger,
// never-before-used email every single time.
const TIME_EPOCH_MS = Date.UTC(2024, 0, 1); // 2024-01-01T00:00:00Z
const METHOD_VERSION = 'v4';

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

  // Time-based number — increases by 1 every second, forever
  const timeN = Math.floor((Date.now() - TIME_EPOCH_MS) / 1000);

  // Same-run chaining: if the output variable already holds an email generated
  // from this same base, continue above its number (covers multiple calls
  // landing within the same second)
  let prevN: number | null = null;
  const prevEmail = String(ctx.getVariable(outputVar) ?? '').trim();
  if (prevEmail) {
    const prevMatch = prevEmail.match(/^(.*)\+(\d+)@([^@\s]+)$/);
    if (prevMatch && `${prevMatch[1]}@${prevMatch[3]}`.toLowerCase() === baseKey) {
      prevN = parseInt(prevMatch[2], 10);
    }
  }

  // next = one past the highest known number (time dominates, so every
  // call/run produces a larger number than anything generated before)
  const next = Math.max(timeN, prevN ?? 0, parsedN ?? 0) + 1;

  const uniqueEmail = `${username}+${next}@${domain}`;

  if (!emailPattern.test(uniqueEmail)) {
    throw new Error(`[GenerateUniqueEmail] Generated address "${uniqueEmail}" is not a valid email address.`);
  }

  ctx.setVariable(outputVar, uniqueEmail);
  ctx.log(`[GenerateUniqueEmail ${METHOD_VERSION}] "${baseEmail}" → "${uniqueEmail}" stored in $[${outputVar}]`);
}
