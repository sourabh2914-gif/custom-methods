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

  // ctx.args[0] = value of ${attribute} — the HTML attribute name (e.g. "href", "class", "data-id", "value")
  // ctx.args[1] = "result" (from $[result]) — runtime variable name to store the retrieved value into
  const attribute = ctx.args[0];
  const outputVar  = ctx.args[1];

  if (!attribute) throw new Error('No attribute name provided — pass the attribute name as the first argument, e.g. "data-id"');
  if (!outputVar)  throw new Error('No output variable provided — add $[variableName] to the step description');

  const locator = (ctx as any).locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  // locator is always a Playwright Locator object when needsLocator: true
  // Call evaluate() to retrieve the attribute via the DOM directly
  const value: string | null = await locator.evaluate(
    (el: Element, attr: string) => el.getAttribute(attr),
    attribute
  );

  if (value === null || value === undefined) {
    throw new Error(`Attribute "${attribute}" was not found on the linked element`);
  }

  ctx.log(`Got attribute "${attribute}": "${value}"`);
  ctx.setVariable(outputVar, value);
  ctx.log(`Stored in $[${outputVar}]: "${value}"`);
}
