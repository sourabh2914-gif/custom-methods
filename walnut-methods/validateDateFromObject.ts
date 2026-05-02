import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Validate Date From Object
 * description: Validate date field matches $[expectedDate]
 * actionType: custom_validate_date_from_object
 * context: web
 * needsLocator: true
 * category: Verification
 */
export async function validateDateFromObject(ctx: WalnutContext) {
  const c = ctx as any;
  const locator = c.locator;

  // ctx.args[0] = "expectedDate" (from $[expectedDate]) — runtime variable holding the stored ISO date e.g. "1990-05-15"
  const expectedIso = c.getVariable(c.args[0]);

  if (!expectedIso) {
    throw new Error(`Runtime variable "$[${c.args[0]}]" is empty — capture the date in a prior step first.`);
  }

  // Convert ISO "YYYY-MM-DD" → "DD-MM-YYYY" to match the read-only display format
  const [year, month, day] = String(expectedIso).split('-');
  const expectedFormatted = `${day}-${month}-${year}`;

  // Read displayed text — handle both string selector and Playwright Locator object
  let actualText: string;
  if (typeof locator === 'string') {
    actualText = (await c.getText(locator)).trim();
  } else {
    actualText = (await locator.textContent() ?? '').trim();
  }

  c.log(`Expected date (formatted): "${expectedFormatted}"`);
  c.log(`Actual date on screen:     "${actualText}"`);

  if (actualText !== expectedFormatted) {
    throw new Error(`Date mismatch — expected "${expectedFormatted}" but found "${actualText}"`);
  }

  c.log(`Date validation passed: "${actualText}"`);
}
