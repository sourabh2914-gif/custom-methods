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

  const rawSelector: string   = c.args?.[0]; // ${countSelector}
  const shareCountVar: string = c.args?.[1]; // $[shareCount]

  if (!rawSelector)    throw new Error('countSelector (args[0]) is required.');
  if (!shareCountVar)  throw new Error('output variable $[shareCount] (args[1]) is required.');

  // Resolve {{variableName}} placeholders inside the selector (e.g. {{BlogTitle}})
  const countSelector: string = c.replacePlaceholders(rawSelector);
  c.log(`Resolved countSelector: ${countSelector}`);

  // Read the count — tries the element itself first, then its child <span>
  // (needed when countSelector points to a container div that has SVG + span inside,
  // because the SVG's textContent makes the div's trimmed text return empty)
  const raw: string = await c.page.evaluate((xp: string) => {
    const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const node = result.singleNodeValue as Element | null;
    if (!node) return '';
    // Try the span child first (handles container divs with SVG + span)
    const span = node.querySelector('span');
    if (span) return (span.textContent ?? '').trim();
    return (node.textContent ?? '').trim();
  }, countSelector);

  const match = raw.match(/\d+/);
  if (!match) throw new Error(`No number found at "${countSelector}". Got: "${raw}"`);

  c.setVariable(shareCountVar, match[0]);
  c.log(`Share count: ${match[0]} → stored in $[${shareCountVar}]`);
}
