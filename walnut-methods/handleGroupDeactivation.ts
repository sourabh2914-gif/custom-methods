import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Deactivation
 * description: Capture support group counts after deactivating a ${groupType} group and store in $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount] $[inactiveGroupsCount]
 * actionType: custom_handle_group_deactivation
 * context: web
 * needsLocator: false
 * category: Support Groups
 */
export async function handleGroupDeactivation(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — groupType              : resolved value from ${groupType} — "public" or "private"
  //   args[1] — "totalGroupsCount"     : runtime variable name (from $[totalGroupsCount])
  //   args[2] — "publicGroupsCount"    : runtime variable name (from $[publicGroupsCount])
  //   args[3] — "privateGroupsCount"   : runtime variable name (from $[privateGroupsCount])
  //   args[4] — "inactiveGroupsCount"  : runtime variable name (from $[inactiveGroupsCount])
  //
  // What this method does:
  //   Reads the LIVE counts directly from the UI metric cards and stores
  //   them into the runtime variables. No arithmetic — DOM values only.
  //
  // Example:
  //   UI shows: All=19, Public=12, Private=7, Inactive=1  (after a private group was deactivated)
  //   → $[totalGroupsCount]    = "19"
  //   → $[publicGroupsCount]   = "12"
  //   → $[privateGroupsCount]  = "7"
  //   → $[inactiveGroupsCount] = "1"

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

  // ── 4. DOM selectors — bold count inside each metric card ──────────────────
  const SELECTORS = {
    total:    `//p[contains(text(),'Total no of Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    public:   `//p[contains(text(),'Total Public Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    private:  `//p[contains(text(),'Total Private Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    inactive: `//p[contains(text(),'Total Inactive Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
  };

  // ── 5. Helper: read a live integer from the DOM ─────────────────────────────
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
        `[handleGroupDeactivation] Could not read "${label}" from UI. ` +
        `XPath: "${xpath}" → got: "${raw}". ` +
        `Ensure the metrics dashboard is visible before this step runs.`
      );
    }
    const val = parseInt(match[0], 10);
    c.log(`[handleGroupDeactivation] DOM read — ${label} = ${val}`);
    return val;
  };

  // ── 6. Read LIVE values from the DOM and store directly ─────────────────────
  const totalCount:    number = await scrapeCount('totalGroupsCount',    SELECTORS.total);
  const publicCount:   number = await scrapeCount('publicGroupsCount',   SELECTORS.public);
  const privateCount:  number = await scrapeCount('privateGroupsCount',  SELECTORS.private);
  const inactiveCount: number = await scrapeCount('inactiveGroupsCount', SELECTORS.inactive);

  c.setVariable(totalVar,    String(totalCount));
  c.setVariable(publicVar,   String(publicCount));
  c.setVariable(privateVar,  String(privateCount));
  c.setVariable(inactiveVar, String(inactiveCount));

  c.log(
    `[handleGroupDeactivation] Stored → ` +
    `$[${totalVar}]=${totalCount}, ` +
    `$[${publicVar}]=${publicCount}, ` +
    `$[${privateVar}]=${privateCount}, ` +
    `$[${inactiveVar}]=${inactiveCount}`
  );
}
