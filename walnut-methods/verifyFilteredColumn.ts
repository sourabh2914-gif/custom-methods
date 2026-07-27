import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Filtered Column Values
 * description: Verify all values in column ${columnSelector} match ${expectedValue}
 * actionType: custom_verify_filtered_column
 * context: web
 * needsLocator: false
 * category: Validation
 */
export async function verifyFilteredColumn(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;

  // ctx.args[0] = columnSelector — XPath or CSS selector for all cells in the filtered column
  // ctx.args[1] = expectedValue  — value every cell must match (e.g. "Jimmy Tata", "Public", "Active")
  const columnSelector = ctx.args[0];
  const expectedValue = ctx.args[1]?.trim().toLowerCase();

  // Use page.locator — supports both XPath (//...) and CSS selectors natively
  const locator = webCtx.page.locator(columnSelector);

  // Wait for at least one element to be visible
  await locator.first().waitFor({ state: 'visible', timeout: 10000 });

  // Get count and collect all text values
  const count = await locator.count();

  if (count === 0) {
    throw new Error('No records found for selector "' + columnSelector + '". Filter may have returned no results.');
  }

  ctx.log('Found ' + count + ' record(s) to verify against "' + ctx.args[1] + '"');

  const mismatches: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = (await locator.nth(i).textContent() || '').trim();
    if (text.toLowerCase() !== expectedValue) {
      mismatches.push(text);
    }
  }

  if (mismatches.length > 0) {
    throw new Error('Filter verification FAILED. Expected "' + ctx.args[1] + '" but found mismatches: [' + mismatches.join(', ') + ']');
  }

  ctx.log('All ' + count + ' record(s) match "' + ctx.args[1] + '"');
}
