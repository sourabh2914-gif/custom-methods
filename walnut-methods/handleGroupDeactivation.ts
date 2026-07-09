import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Deactivation
 * description: Decrement support group metrics when a ${groupType} group is deactivated using counts from $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount] $[inactiveGroupsCount]
 * actionType: custom_handle_group_deactivation
 * context: shared
 * needsLocator: false
 * category: Support Groups
 */
export async function handleGroupDeactivation(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — groupType              : resolved value from ${groupType} — must be "public" or "private"
  //   args[1] — "totalGroupsCount"     : runtime variable name (from $[totalGroupsCount])
  //   args[2] — "publicGroupsCount"    : runtime variable name (from $[publicGroupsCount])
  //   args[3] — "privateGroupsCount"   : runtime variable name (from $[privateGroupsCount])
  //   args[4] — "inactiveGroupsCount"  : runtime variable name (from $[inactiveGroupsCount])
  //
  // Example step description:
  //   "Decrement support group metrics when a ${groupType} group is deactivated using counts from
  //    $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount] $[inactiveGroupsCount]"
  //   Test data: { groupType: "private" }
  //   Pre-state:  totalGroupsCount="20", publicGroupsCount="12", privateGroupsCount="8",  inactiveGroupsCount="0"
  //   Post-state: totalGroupsCount="19", publicGroupsCount="12", privateGroupsCount="7",  inactiveGroupsCount="1"

  const c = ctx as any;

  // ── 1. Resolve arguments ────────────────────────────────────────────────────
  const groupType: string  = (c.args?.[0] ?? '').trim().toLowerCase();
  const totalVar: string   = c.args?.[1]; // $[totalGroupsCount]
  const publicVar: string  = c.args?.[2]; // $[publicGroupsCount]
  const privateVar: string = c.args?.[3]; // $[privateGroupsCount]
  const inactiveVar: string = c.args?.[4]; // $[inactiveGroupsCount]

  // ── 2. Validate groupType ───────────────────────────────────────────────────
  if (groupType !== 'public' && groupType !== 'private') {
    throw new Error(
      `[handleGroupDeactivation] Invalid groupType "${groupType}". ` +
      `Expected "public" or "private" (args[0]).`
    );
  }

  // ── 3. Validate variable name args ─────────────────────────────────────────
  if (!totalVar)    throw new Error('[handleGroupDeactivation] Runtime variable $[totalGroupsCount] (args[1]) is required.');
  if (!publicVar)   throw new Error('[handleGroupDeactivation] Runtime variable $[publicGroupsCount] (args[2]) is required.');
  if (!privateVar)  throw new Error('[handleGroupDeactivation] Runtime variable $[privateGroupsCount] (args[3]) is required.');
  if (!inactiveVar) throw new Error('[handleGroupDeactivation] Runtime variable $[inactiveGroupsCount] (args[4]) is required.');

  // ── 4. Helper: safely read a stored numeric variable ───────────────────────
  const readCount = (varName: string): number => {
    const raw = c.getVariable(varName);
    if (raw === undefined || raw === null || raw === '') {
      c.warn(`[handleGroupDeactivation] "$[${varName}]" is not set — defaulting to 0.`);
      return 0;
    }
    const match = String(raw).match(/\d+/);
    if (!match) {
      c.warn(`[handleGroupDeactivation] "$[${varName}]" = "${raw}" is not numeric — defaulting to 0.`);
      return 0;
    }
    return parseInt(match[0], 10);
  };

  // ── 5. Read current values ──────────────────────────────────────────────────
  const currentTotal:    number = readCount(totalVar);
  const currentPublic:   number = readCount(publicVar);
  const currentPrivate:  number = readCount(privateVar);
  const currentInactive: number = readCount(inactiveVar);

  c.log(
    `[handleGroupDeactivation] BEFORE — total=${currentTotal}, public=${currentPublic}, ` +
    `private=${currentPrivate}, inactive=${currentInactive}, groupType="${groupType}"`
  );

  // ── 6. Guard: warn if a decrement would push a count below zero ─────────────
  if (currentTotal === 0) {
    c.warn('[handleGroupDeactivation] totalGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }
  if (groupType === 'public' && currentPublic === 0) {
    c.warn('[handleGroupDeactivation] publicGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }
  if (groupType === 'private' && currentPrivate === 0) {
    c.warn('[handleGroupDeactivation] privateGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }

  // ── 7. Compute new values (floor at 0 to prevent negative counts) ───────────
  const newTotal:    number = Math.max(0, currentTotal - 1);
  const newPublic:   number = groupType === 'public'  ? Math.max(0, currentPublic  - 1) : currentPublic;
  const newPrivate:  number = groupType === 'private' ? Math.max(0, currentPrivate - 1) : currentPrivate;
  const newInactive: number = currentInactive + 1;

  // ── 8. Persist updated values ───────────────────────────────────────────────
  c.setVariable(totalVar,    String(newTotal));
  c.setVariable(publicVar,   String(newPublic));
  c.setVariable(privateVar,  String(newPrivate));
  c.setVariable(inactiveVar, String(newInactive));

  c.log(
    `[handleGroupDeactivation] AFTER  — total=${newTotal}, public=${newPublic}, ` +
    `private=${newPrivate}, inactive=${newInactive}`
  );
  c.log(
    `[handleGroupDeactivation] Group deactivation complete. ` +
    `Stored: $[${totalVar}]=${newTotal}, $[${publicVar}]=${newPublic}, ` +
    `$[${privateVar}]=${newPrivate}, $[${inactiveVar}]=${newInactive}`
  );
}
