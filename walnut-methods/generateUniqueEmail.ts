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

  // Track the last used number per base address (in the shared variable context)
  // so successive calls never reuse a previously generated email, even if the
  // input variable still holds the original un-tagged address.
  const counterKey = `__uniqueEmail_lastN:${username}@${domain}`;
  const storedRaw = ctx.getVariable(counterKey);
  const storedN = storedRaw !== undefined && storedRaw !== null && storedRaw !== ''
    ? parseInt(String(storedRaw), 10)
    : NaN;

  // next = one past the highest of (last used number, number already in the input).
  // - No tag, never generated before: max(0, 1) + 1 = 2  → starts at +2
  // - Input already has +N:           N + 1
  // - Previously generated +N:        N + 1 (never repeats)
  const next = Math.max(isNaN(storedN) ? 0 : storedN, parsedN !== null ? parsedN : 1) + 1;

  const uniqueEmail = `${username}+${next}@${domain}`;

  if (!emailPattern.test(uniqueEmail)) {
    throw new Error(`[GenerateUniqueEmail] Generated address "${uniqueEmail}" is not a valid email address.`);
  }

  ctx.setVariable(counterKey, String(next));
  ctx.setVariable(outputVar, uniqueEmail);
  ctx.log(`[GenerateUniqueEmail] "${baseEmail}" → "${uniqueEmail}" stored in $[${outputVar}]`);
}
