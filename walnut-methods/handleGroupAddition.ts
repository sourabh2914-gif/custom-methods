import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Addition
 * description: Capture support group counts after adding a ${groupType} group and store in $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount] $[inactiveGroupsCount] $[public] $[private]
 * actionType: custom_handle_group_addition
 * context: web
 * needsLocator: false
 * category: Support Groups
 */
export async function handleGroupAddition(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — groupType                    : resolved value from ${groupType} — "public" or "private"
  //   args[1] — "totalGroupsCount"           : runtime variable name (from $[totalGroupsCount])
  //   args[2] — "publicGroupsCount"          : runtime variable name (from $[publicGroupsCount])
  //   args[3] — "privateGroupsCount"         : runtime variable name (from $[privateGroupsCount])
  //   args[4] — "inactiveGroupsCount"        : runtime variable name (from $[inactiveGroupsCount])
  //   args[5] — "public"  : runtime variable name (from $[public])
  //   args[6] — "private"  : runtime variable name (from $[private])
  //
  // What this method does:
  //   Reads the LIVE counts directly from the UI metric cards and stores
  //   them into the runtime variables. No arithmetic — DOM values only.
  //
  // Example:
  //   UI shows: All=252, Public=127, Private=60, Inactive=65 (Public=50, Private=15)
  //   → $[totalGroupsCount]           = "252"
  //   → $[publicGroupsCount]          = "127"
  //   → $[privateGroupsCount]         = "60"
  //   → $[inactiveGroupsCount]        = "65"
  //   → $[public]  = "50"
  //   → $[private] = "15"

  const c = ctx as any;

  // ── 1. Resolve arguments ────────────────────────────────────────────────────
  const groupType: string          = (c.args?.[0] ?? '').trim().toLowerCase();
  const totalVar: string           = c.args?.[1]; // $[totalGroupsCount]
  const publicVar: string          = c.args?.[2]; // $[publicGroupsCount]
  const privateVar: string         = c.args?.[3]; // $[privateGroupsCount]
  const inactiveVar: string        = c.args?.[4]; // $[inactiveGroupsCount]
  const inactivePublicVar: string  = c.args?.[5]; // $[public]
  const inactivePrivateVar: string = c.args?.[6]; // $[private]

  // ── 2. Validate groupType ───────────────────────────────────────────────────
  if (groupType !== 'public' && groupType !== 'private') {
    throw new Error(
      `[handleGroupAddition] Invalid groupType "${groupType}". ` +
      `Expected "public" or "private" (args[0]).`
    );
  }

  // ── 3. Validate variable name args ─────────────────────────────────────────
  if (!totalVar)           throw new Error('[handleGroupAddition] Runtime variable $[totalGroupsCount] (args[1]) is required.');
  if (!publicVar)          throw new Error('[handleGroupAddition] Runtime variable $[publicGroupsCount] (args[2]) is required.');
  if (!privateVar)         throw new Error('[handleGroupAddition] Runtime variable $[privateGroupsCount] (args[3]) is required.');
  if (!inactiveVar)        throw new Error('[handleGroupAddition] Runtime variable $[inactiveGroupsCount] (args[4]) is required.');
  if (!inactivePublicVar)  throw new Error('[handleGroupAddition] Runtime variable $[public] (args[5]) is required.');
  if (!inactivePrivateVar) throw new Error('[handleGroupAddition] Runtime variable $[private] (args[6]) is required.');

  // ── 4. DOM selectors — bold count inside each metric card ──────────────────
  const SELECTORS = {
    total:           `//p[contains(text(),'Total no of Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    public:          `//p[contains(text(),'Total Public Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    private:         `//p[contains(text(),'Total Private Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    inactive:        `//p[contains(text(),'Total Inactive Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    inactivePublic:  `//p[contains(text(),'Total Inactive Groups')]/ancestor::div[contains(@class,'flex')]//p[contains(text(),' Public')]/span[contains(@class,'font-semibold')]`,
    inactivePrivate: `//p[contains(text(),'Total Inactive Groups')]/ancestor::div[contains(@class,'flex')]//p[contains(text(),' Private')]/span[contains(@class,'font-semibold')]`,
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
        `[handleGroupAddition] Could not read "${label}" from UI. ` +
        `XPath: "${xpath}" → got: "${raw}". ` +
        `Ensure the metrics dashboard is visible before this step runs.`
      );
    }
    const val = parseInt(match[0], 10);
    c.log(`[handleGroupAddition] DOM read — ${label} = ${val}`);
    return val;
  };

  // ── 6. Read LIVE values from the DOM and store directly ─────────────────────
  const totalCount:           number = await scrapeCount('totalGroupsCount',           SELECTORS.total);
  const publicCount:          number = await scrapeCount('publicGroupsCount',          SELECTORS.public);
  const privateCount:         number = await scrapeCount('privateGroupsCount',         SELECTORS.private);
  const inactiveCount:        number = await scrapeCount('inactiveGroupsCount',        SELECTORS.inactive);
  const inactivePublicCount:  number = await scrapeCount('inactivePublic',  SELECTORS.inactivePublic);
  const inactivePrivateCount: number = await scrapeCount('inactivePrivate', SELECTORS.inactivePrivate);

  c.setVariable(totalVar,           String(totalCount));
  c.setVariable(publicVar,          String(publicCount));
  c.setVariable(privateVar,         String(privateCount));
  c.setVariable(inactiveVar,        String(inactiveCount));
  c.setVariable(inactivePublicVar,  String(inactivePublicCount));
  c.setVariable(inactivePrivateVar, String(inactivePrivateCount));

  c.log(
    `[handleGroupAddition] Stored → ` +
    `$[${totalVar}]=${totalCount}, ` +
    `$[${publicVar}]=${publicCount}, ` +
    `$[${privateVar}]=${privateCount}, ` +
    `$[${inactiveVar}]=${inactiveCount}, ` +
    `$[${inactivePublicVar}]=${inactivePublicCount}, ` +
    `$[${inactivePrivateVar}]=${inactivePrivateCount}`
  );
}
