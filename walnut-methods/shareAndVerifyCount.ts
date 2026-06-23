import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Share and Verify Count
 * description: Capture share count for blog ${blogTitle} and store in $[shareCount]
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
  //
  // args[0] — blogTitle   : the blog title text (resolved by Walnut from ${blogTitle})
  // args[1] — shareCount  : output variable name (from $[shareCount])

  const c = ctx as any;

  const blogTitle: string     = c.args?.[0]; // ${blogTitle}
  const shareCountVar: string = c.args?.[1]; // $[shareCount]

  if (!blogTitle)      throw new Error('blogTitle (args[0]) is required.');
  if (!shareCountVar)  throw new Error('output variable $[shareCount] (args[1]) is required.');

  // Build the XPath using the resolved blog title value
  // [2] = share container (1=like, 2=comment, 3=share based on DOM order)
  const countSelector = `//p[contains(@class,'line-clamp-3') and normalize-space()='${blogTitle}']/following::div[contains(@class,'rounded-full') and contains(@class,'bg-white')][2]`;
  c.log(`Using countSelector: ${countSelector}`);

  // Read the count — the container div has SVG + span inside
  // querySelector('span') gets the number span directly
  const raw: string = await c.page.evaluate((xp: string) => {
    const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const node = result.singleNodeValue as Element | null;
    if (!node) return '';
    const span = node.querySelector('span');
    if (span) return (span.textContent ?? '').trim();
    return (node.textContent ?? '').trim();
  }, countSelector);

  const match = raw.match(/\d+/);
  if (!match) throw new Error(`No number found for blog "${blogTitle}". Got: "${raw}"`);

  c.setVariable(shareCountVar, match[0]);
  c.log(`Share count for "${blogTitle}": ${match[0]} → stored in $[${shareCountVar}]`);
}
