import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Attribute and Store
 * description: Get attribute ${attribute} from the linked object and store in $[result]
 * actionType: custom_get_attribute_and_store
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function getAttributeAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${attribute} — the HTML attribute name to retrieve (e.g. "href", "class", "data-id")
  // ctx.args[1] = "result" (from $[result]) — runtime variable name to store into
  const attribute = ctx.args[0];
  const outputVar = ctx.args[1];

  if (!attribute) throw new Error('No attribute name provided — pass the attribute name as the first argument');
  if (!outputVar) throw new Error('No output variable provided — add $[variableName] to the step description');

  const value = await ctx.getAttribute(ctx.locator, attribute);

  if (value === null || value === undefined) {
    throw new Error(`Attribute "${attribute}" not found on the linked element`);
  }

  ctx.log(`Got attribute "${attribute}": "${value}"`);
  ctx.setVariable(outputVar, value);
  ctx.log(`Stored in $[${outputVar}]: "${value}"`);
}
