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
  const c = ctx as any;
  const locator = c.locator;

  // ctx.args[0] = "expectedValue" (from $[expectedValue]) — runtime variable holding the stored dropdown text e.g. "Male"
  const expectedValue = String(c.getVariable(c.args[0])).trim();

  if (!expectedValue || expectedValue === 'undefined') {
    throw new Error(`Runtime variable "$[${c.args[0]}]" is empty — capture the dropdown value in a prior step first.`);
  }

  // Read-only dropdowns render as plain text — handle both string selector and Playwright Locator object
  let rawText: string;
  if (typeof locator === 'string') {
    rawText = (await c.getText(locator)).trim();
  } else {
    rawText = (await locator.textContent() ?? '').trim();
  }

  // Strip UI symbols (×, ✕, ✗, close-button chars) from multi-select tag chips
  const actualText = rawText
    .replace(/[^\w\s().,''\-\/]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  c.log(`Expected dropdown value: "${expectedValue}"`);
  c.log(`Actual dropdown value (raw):     "${rawText}"`);
  c.log(`Actual dropdown value (cleaned): "${actualText}")`);

  if (actualText !== expectedValue) {
    throw new Error(`Dropdown mismatch — expected "${expectedValue}" but found "${actualText}"`);
  }

  c.log(`Dropdown validation passed: "${actualText}"`);
}
