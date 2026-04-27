import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Property and Store
 * description: Get property ${property} and store in $[result]
 * actionType: custom_get_property_and_store
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function getPropertyAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${property} — the property name to retrieve (e.g. "value", "innerText", "href", "class")
  // ctx.args[1] = "result" (from $[result]) — runtime variable name to store into
  const property = ctx.args[0];
  const outputVar = ctx.args[1];

  const value = await ctx.getAttribute(ctx.locator, property);
  ctx.log(`Got property "${property}": "${value}"`);

  ctx.setVariable(outputVar, value);
}
