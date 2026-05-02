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
  // ctx.locator  — XPath from the step-linked read-only date field
  // ctx.args[0]  = "expectedDate" (from $[expectedDate]) — runtime variable holding the stored ISO date e.g. "1990-05-15"

  const expectedIso = ctx.getVariable(ctx.args[0]);

  if (!expectedIso) {
    throw new Error(`Runtime variable "$[${ctx.args[0]}]" is empty — capture the date in a prior step first.`);
  }

  // Convert ISO "YYYY-MM-DD" → "DD-MM-YYYY" to match the read-only display format
  const [year, month, day] = String(expectedIso).split('-');
  const expectedFormatted = `${day}-${month}-${year}`;

  // Read the displayed text from the read-only field
  const actualText = (await ctx.getText(ctx.locator)).trim();

  ctx.log(`Expected date (formatted): "${expectedFormatted}"`);
  ctx.log(`Actual date on screen:     "${actualText}"`);

  if (actualText !== expectedFormatted) {
    throw new Error(`Date mismatch — expected "${expectedFormatted}" but found "${actualText}"`);
  }

  ctx.log(`Date validation passed: "${actualText}"`);
}
