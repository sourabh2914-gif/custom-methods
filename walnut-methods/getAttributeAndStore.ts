import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Attribute and Store
 * description: Get attribute ${attribute} and store in $[result]
 * actionType: custom_get_attribute_and_store
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function getAttributeAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${attribute} — the HTML attribute to retrieve (e.g. "href", "src", "class", "data-id")
  // ctx.args[1] = "result" (from $[result]) — runtime variable name to store into
  const attribute = ctx.args[0];
  const outputVar = ctx.args[1];

  const value = await ctx.getAttribute(ctx.locator, attribute);
  ctx.log(`Got attribute "${attribute}": "${value}"`);

  ctx.setVariable(outputVar, value ?? '');
}
