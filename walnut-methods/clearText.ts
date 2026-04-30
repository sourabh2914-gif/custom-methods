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
  const locator = webCtx.page.locator(ctx.locator);

  // Wait until the element is visible in the DOM
  await locator.waitFor({ state: 'visible' });

  // Triple-click selects all existing text, then fill('') clears it
  await locator.click({ clickCount: 3 });
  await locator.fill('');

  ctx.log('Cleared text from element: "' + ctx.locator + '"');
}
