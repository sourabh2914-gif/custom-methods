import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Clear Text
 * description: Clear text from input field
 * actionType: custom_clear_text
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function clearText(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;

  // ctx.locator is the XPath from the step-linked object
  // Use ctx.click + page.keyboard to reliably clear — same pattern as getTextAndStore/getPropertyAndStore
  await ctx.click(ctx.locator);
  await webCtx.page.keyboard.press('Control+A');
  await webCtx.page.keyboard.press('Backspace');

  ctx.log('Cleared text from element: "' + ctx.locator + '"');
}
