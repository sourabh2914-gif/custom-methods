import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Share and Verify Count
 * description: Capture share count from ${countSelector} and store in $[shareCount]
 * actionType: custom_share_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function shareAndVerifyCount(ctx: WalnutContext) {
  // Use this method TWICE in your test flow:
  //   Step A — on All Blogs page BEFORE sharing → store in $[beforeShareCount]
  //   Step B — click share button (your own step)
  //   Step C — on All Blogs page AFTER sharing  → store in $[afterShareCount]
  // Then compare $[beforeShareCount] vs $[afterShareCount] with a normal assertion step.

  const c = ctx as any;

  const countSelector: string = c.args?.[0]; // ${countSelector}
  const shareCountVar: string = c.args?.[1]; // $[shareCount]

  if (!countSelector) throw new Error('countSelector (args[0]) is required.');
  if (!shareCountVar) throw new Error('output variable $[shareCount] (args[1]) is required.');

  // Use textContent via page.evaluate — reliable for dynamically rendered number spans
  // where Playwright innerText may return empty string
  const raw: string = await c.page.evaluate((xp: string) => {
    const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const node = result.singleNodeValue as Element | null;
    return node ? (node.textContent ?? '').trim() : '';
  }, countSelector);

  const match = raw.match(/\d+/);
  if (!match) throw new Error(`No number found at "${countSelector}". Got: "${raw}"`);

  c.setVariable(shareCountVar, match[0]);
  c.log(`Share count: ${match[0]} → stored in $[${shareCountVar}]`);
}
