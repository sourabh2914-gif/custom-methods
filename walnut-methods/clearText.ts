import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Clear Text
 * description: Clear text from input field ${selector}
 * actionType: custom_clear_text
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clearText(ctx: WalnutContext) {
  const selector = ctx.args[0];

  // Wait for element to be visible and attached before interacting
  await ctx.waitForVisible(selector);

  // Click to focus, select all text, then delete — more reliable than ctx.clear()
  await ctx.click(selector);
  await ctx.page.locator(selector).selectText();
  await ctx.pressKey('Delete');

  ctx.log('Cleared text from element: "' + selector + '"');
}
