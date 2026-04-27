import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Element By XPath
 * description: Click element with xpath ${xpath}
 * actionType: custom_click_element_by_xpath
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function clickElementByXpath(ctx: WalnutContext) {
  // ctx.args[0] = value of ${xpath} — the XPath expression to locate the element
  const xpath = ctx.args[0];

  ctx.log(`Clicking element with XPath: "${xpath}"`);
  await ctx.click(xpath);
  ctx.log(`Clicked successfully`);
}
