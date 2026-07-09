import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Handle Group Addition
 * description: Increment support group metrics when a ${groupType} group is added using counts from $[totalGroupsCount] $[publicGroupsCount] $[privateGroupsCount]
 * actionType: custom_handle_group_addition
 * context: web
 * needsLocator: false
 * category: Support Groups
 */
export async function handleGroupAddition(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — groupType            : resolved value from ${groupType} — must be "public" or "private"
  //   args[1] — "totalGroupsCount"   : runtime variable name (from $[totalGroupsCount])
  //   args[2] — "publicGroupsCount"  : runtime variable name (from $[publicGroupsCount])
  //   args[3] — "privateGroupsCount" : runtime variable name (from $[privateGroupsCount])
  //
  // What this method does:
  //   1. Reads the LIVE counts from the UI metric cards (e.g. 20 / 12 / 8)
  //   2. Stores BEFORE values into the runtime variables
  //   3. Increments the appropriate counters based on groupType
  //   4. Stores AFTER values back into the same runtime variables
  //
  // Example:
  //   UI shows: All=20, Public=12, Private=8
  //   groupType = "public"
  //   → totalGroupsCount  stored as "21"
  //   → publicGroupsCount stored as "13"
  //   → privateGroupsCount stored as "8"

  const c = ctx as any;

  // ── 1. Resolve arguments ────────────────────────────────────────────────────
  const groupType: string  = (c.args?.[0] ?? '').trim().toLowerCase();
  const totalVar: string   = c.args?.[1]; // $[totalGroupsCount]
  const publicVar: string  = c.args?.[2]; // $[publicGroupsCount]
  const privateVar: string = c.args?.[3]; // $[privateGroupsCount]

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

  // ── 4. DOM selectors — matches the metric card structure in the UI ──────────
  // Targets the bold number (<p class="text-3xl font-bold text-gray-800">)
  // that is a preceding sibling of the label paragraph in each card.
  const SELECTORS = {
    total:   `//p[contains(text(),'Total no of Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    public:  `//p[contains(text(),'Total Public Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
    private: `//p[contains(text(),'Total Private Groups')]/preceding-sibling::p[contains(@class,'text-3xl')]`,
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
        `[handleGroupAddition] Could not read "${label}" count from UI. ` +
        `XPath: "${xpath}" → got: "${raw}". ` +
        `Ensure the metrics dashboard is visible on the page before this step runs.`
      );
    }
    const val = parseInt(match[0], 10);
    c.log(`[handleGroupAddition] UI read — ${label} = ${val}`);
    return val;
  };

  // ── 6. Read LIVE values from the UI ────────────────────────────────────────
  const beforeTotal:   number = await scrapeCount('totalGroupsCount',   SELECTORS.total);
  const beforePublic:  number = await scrapeCount('publicGroupsCount',  SELECTORS.public);
  const beforePrivate: number = await scrapeCount('privateGroupsCount', SELECTORS.private);

  c.log(
    `[handleGroupAddition] BEFORE — total=${beforeTotal}, ` +
    `public=${beforePublic}, private=${beforePrivate}, groupType="${groupType}"`
  );

  // ── 7. Compute AFTER values ─────────────────────────────────────────────────
  const afterTotal:   number = beforeTotal + 1;
  const afterPublic:  number = groupType === 'public'  ? beforePublic  + 1 : beforePublic;
  const afterPrivate: number = groupType === 'private' ? beforePrivate + 1 : beforePrivate;

  // ── 8. Persist AFTER values into runtime variables ──────────────────────────
  c.setVariable(totalVar,   String(afterTotal));
  c.setVariable(publicVar,  String(afterPublic));
  c.setVariable(privateVar, String(afterPrivate));

  c.log(
    `[handleGroupAddition] AFTER  — total=${afterTotal}, ` +
    `public=${afterPublic}, private=${afterPrivate}`
  );
  c.log(
    `[handleGroupAddition] Stored → ` +
    `$[${totalVar}]=${afterTotal}, ` +
    `$[${publicVar}]=${afterPublic}, ` +
    `$[${privateVar}]=${afterPrivate}`
  );
}
