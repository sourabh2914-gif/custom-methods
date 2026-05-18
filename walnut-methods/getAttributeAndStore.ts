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
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  const locator = c.locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  // args[0] = attribute name (from ${attribute})
  // args[1] = runtime variable name (from $[result])
  const attribute: string = c.args[0];
  const outputVar: string = c.args[1];

  if (!attribute) throw new Error('No attribute name provided — pass the attribute name as the first argument');
  if (!outputVar) throw new Error('No output variable provided — add $[variableName] to the step description');

  let value: string | null = null;

  if (typeof locator === 'string') {
    value = await c.getAttribute(locator, attribute);
  } else {
    value = await locator.first().getAttribute(attribute);
  }

  if (value === null || value === undefined) {
    throw new Error(`Attribute "${attribute}" not found on the linked element`);
  }

  c.log(`Got attribute "${attribute}": "${value}"`);
  c.setVariable(outputVar, value);
  c.log(`Stored in $[${outputVar}]: "${value}"`);
}