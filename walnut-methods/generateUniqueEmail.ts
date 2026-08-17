import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Generate Unique Email
 * description: Generate a unique email address from ${baseEmail} and store in $[uniqueEmail]
 * actionType: custom_generate_unique_email
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
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

  // ── Determine the next number ─────────────────────────────────────────────
  // Cross-step state lives in the DECLARED output runtime variable itself:
  // each call reads back the previously generated email from $[uniqueEmail]
  // (same proven mechanism as "Capture and Increment Event Count").
  // Hidden/internal variable keys are NOT used — they are not reliably
  // persisted between steps.
  const baseKey = `${username}@${domain}`.toLowerCase();

  let prevN: number | null = null;
  const prevEmail = String(ctx.getVariable(outputVar) ?? '').trim();
  if (prevEmail) {
    const prevMatch = prevEmail.match(/^(.*)\+(\d+)@([^@\s]+)$/);
    if (prevMatch && `${prevMatch[1]}@${prevMatch[3]}`.toLowerCase() === baseKey) {
      prevN = parseInt(prevMatch[2], 10); // previous email was generated from this same base
    }
  }

  // next = one past the highest of (number in previous output, number in input).
  // - No tag anywhere, first call:  max(1, 1) + 1 = 2  → starts at +2
  // - Previous output has +N:       N + 1  → +2 → +3 → +4 …
  // - Input itself has +N:          N + 1
  const next = Math.max(prevN ?? 1, parsedN ?? 1) + 1;

  const uniqueEmail = `${username}+${next}@${domain}`;

  if (!emailPattern.test(uniqueEmail)) {
    throw new Error(`[GenerateUniqueEmail] Generated address "${uniqueEmail}" is not a valid email address.`);
  }

  ctx.setVariable(outputVar, uniqueEmail);
  ctx.log(
    `[GenerateUniqueEmail] "${baseEmail}" → "${uniqueEmail}" stored in $[${outputVar}]` +
    (prevEmail ? ` (previous: "${prevEmail}")` : ' (first generation)')
  );
}
