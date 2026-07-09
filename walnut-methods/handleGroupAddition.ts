import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Addition
 * description: Increment support group metrics when a ${groupType} group is added using counts from $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount]
 * actionType: custom_handle_group_addition
 * context: shared
 * needsLocator: false
 * category: Support Groups
 */
export async function handleGroupAddition(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — groupType            : resolved value from ${groupType} — must be "public" or "private"
  //   args[1] — "totalGroupsCount"   : runtime variable name  (from $[totalGroupsCount])
  //   args[2] — "publicGroupsCount"  : runtime variable name  (from $[publicGroupsCount])
  //   args[3] — "privateGroupsCount" : runtime variable name  (from $[privateGroupsCount])
  //
  // Example step description:
  //   "Increment support group metrics when a ${groupType} group is added using counts from
  //    $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount]"
  //   Test data: { groupType: "public" }
  //   Pre-state:  totalGroupsCount="20", publicGroupsCount="12", privateGroupsCount="8"
  //   Post-state: totalGroupsCount="21", publicGroupsCount="13", privateGroupsCount="8"

  const c = ctx as any;

  // ── 1. Resolve arguments ────────────────────────────────────────────────────
  const groupType: string      = (c.args?.[0] ?? '').trim().toLowerCase();
  const totalVar: string       = c.args?.[1]; // $[totalGroupsCount]
  const publicVar: string      = c.args?.[2]; // $[publicGroupsCount]
  const privateVar: string     = c.args?.[3]; // $[privateGroupsCount]

  // ── 2. Validate groupType ───────────────────────────────────────────────────
  if (groupType !== 'public' && groupType !== 'private') {
    throw new Error(
      `[handleGroupAddition] Invalid groupType "${groupType}". ` +
      `Expected "public" or "private" (args[0]).`
    );
  }

  // ── 3. Validate variable name args ─────────────────────────────────────────
  if (!totalVar)   throw new Error('[handleGroupAddition] Runtime variable $[totalGroupsCount] (args[1]) is required.');
  if (!publicVar)  throw new Error('[handleGroupAddition] Runtime variable $[publicGroupsCount] (args[2]) is required.');
  if (!privateVar) throw new Error('[handleGroupAddition] Runtime variable $[privateGroupsCount] (args[3]) is required.');

  // ── 4. Helper: safely read a stored numeric variable ───────────────────────
  const readCount = (varName: string): number => {
    const raw = c.getVariable(varName);
    if (raw === undefined || raw === null || raw === '') {
      c.warn(`[handleGroupAddition] "$[${varName}]" is not set — defaulting to 0.`);
      return 0;
    }
    const match = String(raw).match(/\d+/);
    if (!match) {
      c.warn(`[handleGroupAddition] "$[${varName}]" = "${raw}" is not numeric — defaulting to 0.`);
      return 0;
    }
    return parseInt(match[0], 10);
  };

  // ── 5. Read current values ──────────────────────────────────────────────────
  const currentTotal:   number = readCount(totalVar);
  const currentPublic:  number = readCount(publicVar);
  const currentPrivate: number = readCount(privateVar);

  c.log(`[handleGroupAddition] BEFORE — total=${currentTotal}, public=${currentPublic}, private=${currentPrivate}, groupType="${groupType}"`);

  // ── 6. Compute new values ───────────────────────────────────────────────────
  const newTotal:   number = currentTotal + 1;
  const newPublic:  number = groupType === 'public'  ? currentPublic  + 1 : currentPublic;
  const newPrivate: number = groupType === 'private' ? currentPrivate + 1 : currentPrivate;

  // ── 7. Persist updated values ───────────────────────────────────────────────
  c.setVariable(totalVar,   String(newTotal));
  c.setVariable(publicVar,  String(newPublic));
  c.setVariable(privateVar, String(newPrivate));

  c.log(`[handleGroupAddition] AFTER  — total=${newTotal}, public=${newPublic}, private=${newPrivate}`);
  c.log(`[handleGroupAddition] Group addition complete. Stored: $[${totalVar}]=${newTotal}, $[${publicVar}]=${newPublic}, $[${privateVar}]=${newPrivate}`);
}
