import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Validate Dropdown From Object
 * description: Validate dropdown field matches $[expectedValue]
 * actionType: custom_validate_dropdown_from_object
 * context: web
 * needsLocator: true
 * category: Verification
 */
export async function validateDropdownFromObject(ctx: WalnutContext) {
  // ctx.locator  — XPath from the step-linked read-only dropdown field
  // ctx.args[0]  = "expectedValue" (from $[expectedValue]) — runtime variable holding the stored dropdown text e.g. "Male"

  const expectedValue = String(ctx.getVariable(ctx.args[0])).trim();

  if (!expectedValue) {
    throw new Error(`Runtime variable "$[${ctx.args[0]}]" is empty — capture the dropdown value in a prior step first.`);
  }

  // Read-only dropdowns render as plain text — use getText()
  const actualText = (await ctx.getText(ctx.locator)).trim();

  ctx.log(`Expected dropdown value: "${expectedValue}"`);
  ctx.log(`Actual dropdown value:   "${actualText}"`);

  if (actualText !== expectedValue) {
    throw new Error(`Dropdown mismatch — expected "${expectedValue}" but found "${actualText}"`);
  }

  ctx.log(`Dropdown validation passed: "${actualText}"`);
}
