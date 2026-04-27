import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Clear Text
 * description: Clear text from input field
 * actionType: custom_clear_text
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function clearText(ctx: WalnutContext) {
  await ctx.clear(ctx.locator);
  ctx.log(`Cleared text from element: "${ctx.locator}"`);
}
