import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Text and Store
 * description: Get text and store in $[result]
 * actionType: custom_get_text_and_store
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function getTextAndStore(ctx: WalnutContext) {
  // ctx.args[0] = "result" (from $[result]) — runtime variable name to store into
  const outputVar = ctx.args[0];

  const text = await ctx.getText(ctx.locator);
  ctx.log(`Got text: "${text}"`);

  ctx.setVariable(outputVar, text);
}
