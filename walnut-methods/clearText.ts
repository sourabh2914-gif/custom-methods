import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Clear Text From Object
 * description: Clear text from the linked object
 * actionType: custom_clear_text_from_object
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function clearTextFromObject(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;
  const selector = (ctx as any).locator;

  // Use ctx.click (built-in) to focus the element via the linked object XPath,
  // then Ctrl+A + Backspace to clear — works regardless of input type
  await ctx.click(selector);
  await webCtx.page.keyboard.press('Control+A');
  await webCtx.page.keyboard.press('Backspace');

  ctx.log('Cleared text from element: "' + selector + '"');
}
