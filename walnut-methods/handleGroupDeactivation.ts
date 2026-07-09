import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Deactivation
 * description: Decrement support group metrics when a ${groupType} group is deactivated using counts from $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount] $[inactiveGroupsCount]
 * actionType: custom_handle_group_deactivation
 * context: web
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
  // What this method does:
  //   1. Reads the LIVE counts from the UI metric cards (e.g. 20 / 12 / 8 / 0)
  //   2. Decrements total + type-specific active count (clamped at 0)
  //   3. Increments inactiveGroupsCount by 1
  //   4. Stores all AFTER values into runtime variables
  //
  // Example:
  //   UI shows: All=20, Public=12, Private=8, Inactive=0
  //   groupType = "private"
  //   → totalGroupsCount   stored as "19"
  //   → publicGroupsCount  stored as "12"  (unchanged)
  //   → privateGroupsCount stored as "7"
  //   → inactiveGroupsCount stored as "1"

  const c = ctx as any;

  // ── 1. Resolve arguments ────────────────────────────────────────────────────
  const groupType: string   = (c.args?.[0] ?? '').trim().toLowerCase();
  const totalVar: string    = c.args?.[1]; // $[totalGroupsCount]
  const publicVar: string   = c.args?.[2]; // $[publicGroupsCount]
  const privateVar: string  = c.args?.[3]; // $[privateGroupsCount]
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

  // ── 4. DOM selectors — matches the metric card structure in the UI ──────────
  // Reads the bold number (<p class="text-3xl font-bold text-gray-800">)
  // that is a preceding sibling of the label paragraph inside each card.
  // Inactive card has a nested structure — reads the main bold count only.
  const SELECTORS = {
    total:    `//p[contains(text(),'Total no of Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    public:   `//p[contains(text(),'Total Public Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    private:  `//p[contains(text(),'Total Private Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    inactive: `//p[contains(text(),'Total Inactive Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
  };

  // ── 5. Helper: scrape a live integer from the DOM ───────────────────────────
  const scrapeCount = async (label: string, xpath: string): Promise<number> => {
    let raw = '';
    try {
      raw = (await c.getText(xpath) ?? '').trim();
    } catch (_) {}

    // Fallback via page.evaluate if getText returns empty
    if (!raw || !/\d/.test(raw)) {
      try {
        raw = await c.page.evaluate((xp: string) => {
          const result = document.evaluate(
            xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          const node = result.singleNodeValue as Element | null;
          return node ? (node.textContent ?? '').trim() : '';
        }, xpath);
      } catch (_) {}
    }

    const match = String(raw).match(/\d+/);
    if (!match) {
      throw new Error(
        `[handleGroupDeactivation] Could not read "${label}" count from UI. ` +
        `XPath: "${xpath}" → got: "${raw}". ` +
        `Ensure the metrics dashboard is visible on the page before this step runs.`
      );
    }
    const val = parseInt(match[0], 10);
    c.log(`[handleGroupDeactivation] UI read — ${label} = ${val}`);
    return val;
  };

  // ── 6. Read LIVE values from the UI ────────────────────────────────────────
  const beforeTotal:    number = await scrapeCount('totalGroupsCount',    SELECTORS.total);
  const beforePublic:   number = await scrapeCount('publicGroupsCount',   SELECTORS.public);
  const beforePrivate:  number = await scrapeCount('privateGroupsCount',  SELECTORS.private);
  const beforeInactive: number = await scrapeCount('inactiveGroupsCount', SELECTORS.inactive);

  c.log(
    `[handleGroupDeactivation] BEFORE — total=${beforeTotal}, public=${beforePublic}, ` +
    `private=${beforePrivate}, inactive=${beforeInactive}, groupType="${groupType}"`
  );

  // ── 7. Guard: warn if decrement would go below zero ────────────────────────
  if (beforeTotal === 0) {
    c.warn('[handleGroupDeactivation] totalGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }
  if (groupType === 'public' && beforePublic === 0) {
    c.warn('[handleGroupDeactivation] publicGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }
  if (groupType === 'private' && beforePrivate === 0) {
    c.warn('[handleGroupDeactivation] privateGroupsCount is already 0 — clamping to 0, no decrement applied.');
  }

  // ── 8. Compute AFTER values (floor at 0 to prevent negative counts) ─────────
  const afterTotal:    number = Math.max(0, beforeTotal - 1);
  const afterPublic:   number = groupType === 'public'  ? Math.max(0, beforePublic  - 1) : beforePublic;
  const afterPrivate:  number = groupType === 'private' ? Math.max(0, beforePrivate - 1) : beforePrivate;
  const afterInactive: number = beforeInactive + 1;

  // ── 9. Persist AFTER values into runtime variables ──────────────────────────
  c.setVariable(totalVar,    String(afterTotal));
  c.setVariable(publicVar,   String(afterPublic));
  c.setVariable(privateVar,  String(afterPrivate));
  c.setVariable(inactiveVar, String(afterInactive));

  c.log(
    `[handleGroupDeactivation] AFTER  — total=${afterTotal}, public=${afterPublic}, ` +
    `private=${afterPrivate}, inactive=${afterInactive}`
  );
  c.log(
    `[handleGroupDeactivation] Stored → ` +
    `$[${totalVar}]=${afterTotal}, $[${publicVar}]=${afterPublic}, ` +
    `$[${privateVar}]=${afterPrivate}, $[${inactiveVar}]=${afterInactive}`
  );
}
