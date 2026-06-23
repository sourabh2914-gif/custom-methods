import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Share and Verify Count
 * description: Click share button on ${shareButtonSelector} in My Blogs then navigate to ${allBlogsUrl} and verify share count increased by 1 using ${allBlogsCountSelector} and store before count in $[beforeShareCount] and after count in $[afterShareCount]
 * actionType: custom_share_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function shareAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — shareButtonSelector  : XPath of the share button in My Blogs page (to CLICK)
  //                                    e.g. "//p[normalize-space()='$[BlogTitle_P]']/following::div[contains(@class,'flex') and .//*[contains(@class,'lucide-share2')]][1]"
  //   args[1] — allBlogsUrl          : URL of the All Blogs page to navigate to after sharing
  //                                    e.g. "https://hhcs-qa.hopenhealcare.com/patient/blogs"
  //   args[2] — allBlogsCountSelector: STABLE XPath of the share count span on All Blogs page (NO text condition)
  //                                    e.g. "//p[normalize-space()='$[BlogTitle_P]']/following::span[3]"
  //   args[3] — "beforeShareCount"   : output variable name (from $[beforeShareCount]) — count read from All Blogs BEFORE share
  //   args[4] — "afterShareCount"    : output variable name (from $[afterShareCount])  — count read from All Blogs AFTER share
  //
  // Flow:
  //   1. On My Blogs page — read share count from allBlogsCountSelector if visible, else set 0 as baseline
  //   2. Click the share button (shareButtonSelector) on My Blogs page
  //   3. Navigate to All Blogs page (allBlogsUrl)
  //   4. Read share count from allBlogsCountSelector on All Blogs page → this is the AFTER count
  //   5. Assert count increased by exactly +1

  const c = ctx as any;

  const shareButtonSelector: string  = c.args?.[0];
  const allBlogsUrl: string          = c.args?.[1];
  const allBlogsCountSelector: string = c.args?.[2];
  const beforeVar: string            = c.args?.[3]; // $[beforeShareCount]
  const afterVar: string             = c.args?.[4]; // $[afterShareCount]

  if (!shareButtonSelector)   throw new Error('shareButtonSelector (args[0]) is required.');
  if (!allBlogsUrl)           throw new Error('allBlogsUrl (args[1]) is required.');
  if (!allBlogsCountSelector) throw new Error('allBlogsCountSelector (args[2]) is required.');
  if (!beforeVar)             throw new Error('output variable $[beforeShareCount] (args[3]) is required.');
  if (!afterVar)              throw new Error('output variable $[afterShareCount] (args[4]) is required.');

  // Helper: read integer from a count span using textContent via page.evaluate (XPath)
  // Using textContent instead of innerText because Playwright innerText can return empty
  // for dynamically rendered number spans.
  const readCountByXpath = async (xpath: string): Promise<number> => {
    const raw: string = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(
        xp,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const node = result.singleNodeValue as Element | null;
      return node ? (node.textContent ?? '').trim() : '';
    }, xpath);

    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(
        `Could not find a number in element. XPath: "${xpath}". Got text: "${raw}"`
      );
    }
    return parseInt(match[0], 10);
  };

  // ── Step 1: Read count BEFORE share from All Blogs (navigate there first to get baseline)
  c.log(`Navigating to All Blogs to capture baseline share count: ${allBlogsUrl}`);
  await c.navigate(allBlogsUrl);
  await c.wait(1500); // allow page to settle

  const countBefore = await readCountByXpath(allBlogsCountSelector);
  c.log(`Share count BEFORE (All Blogs): ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));

  // ── Step 2: Navigate back to My Blogs and click the share button
  c.log('Navigating back (My Blogs) to click share button...');
  await c.navigateBack();
  await c.wait(1000);

  await c.click(shareButtonSelector);
  c.log(`Clicked share button: "${shareButtonSelector}"`);
  await c.wait(1000); // allow share action to register

  // ── Step 3: Navigate to All Blogs page to verify count
  c.log(`Navigating to All Blogs to verify share count: ${allBlogsUrl}`);
  await c.navigate(allBlogsUrl);
  await c.wait(1500); // allow page to settle and count to reflect

  // ── Step 4: Poll up to 5 s for the count to increase
  const maxWaitMs = 5000;
  const pollMs    = 500;
  const start     = Date.now();
  let countAfter  = countBefore;

  while (Date.now() - start < maxWaitMs) {
    try {
      countAfter = await readCountByXpath(allBlogsCountSelector);
    } catch (_) {
      await c.wait(pollMs);
      continue;
    }
    if (countAfter !== countBefore) break;
    await c.wait(pollMs);
  }

  // ── Step 5: Assert count increased by exactly +1
  const delta = countAfter - countBefore;

  if (delta === 1) {
    c.log(`Share count INCREASED: ${countBefore} → ${countAfter} ✓`);
  } else if (delta === 0) {
    throw new Error(
      `Share count did NOT increase after sharing. Count stayed at ${countBefore} on All Blogs. ` +
      `Possible causes: share action did not register, page did not refresh, or selector is wrong.`
    );
  } else {
    throw new Error(
      `Unexpected share count change: ${countBefore} → ${countAfter} (delta ${delta}). Expected exactly +1.`
    );
  }

  // ── Step 6: Store after count
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored → $[${beforeVar}] = "${countBefore}", $[${afterVar}] = "${countAfter}"`);
}
