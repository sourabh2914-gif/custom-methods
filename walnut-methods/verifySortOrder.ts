import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Column Sort Order
 * description: Click sort arrow ${arrowSelector} and verify column ${columnSelector} is sorted ${sortDirection}
 * actionType: custom_verify_sort_order
 * context: web
 * needsLocator: false
 * category: Validation
 */
export async function verifySortOrder(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;

  // ctx.args[0] = arrowSelector  — XPath/CSS of the sort arrow icon to click (up or down)
  // ctx.args[1] = columnSelector — XPath/CSS of all data cells in the column being sorted
  // ctx.args[2] = sortDirection  — "asc" (ascending) or "desc" (descending)
  const arrowSelector = ctx.args[0];
  const columnSelector = ctx.args[1];
  const sortDirection = ctx.args[2]?.trim().toLowerCase();

  if (sortDirection !== 'asc' && sortDirection !== 'desc') {
    throw new Error('sortDirection must be "asc" or "desc", got: "' + ctx.args[2] + '"');
  }

  // Step 1 — Click the sort arrow
  ctx.log('Clicking sort arrow: ' + arrowSelector);
  await webCtx.page.locator(arrowSelector).first().click();

  // Step 2 — Wait for table to re-render after sort
  await webCtx.page.waitForTimeout(1000);

  // Step 3 — Collect all visible cell values in the sorted column
  const cellLocator = webCtx.page.locator(columnSelector);
  await cellLocator.first().waitFor({ state: 'visible', timeout: 10000 });

  const count = await cellLocator.count();
  if (count === 0) {
    throw new Error('No records found for column selector "' + columnSelector + '"');
  }

  ctx.log('Collected ' + count + ' cell(s) after sort click');

  const actualValues: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await cellLocator.nth(i).textContent() || '').trim();
    actualValues.push(text);
  }

  // Step 4 — Build the expected sorted order from the actual values
  const sortedValues = [...actualValues].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower < bLower) return sortDirection === 'asc' ? -1 : 1;
    if (aLower > bLower) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Step 5 — Compare actual order vs expected sorted order
  ctx.log('Actual order:   [' + actualValues.join(', ') + ']');
  ctx.log('Expected order: [' + sortedValues.join(', ') + ']');

  const mismatches: string[] = [];
  for (let i = 0; i < actualValues.length; i++) {
    if (actualValues[i].toLowerCase() !== sortedValues[i].toLowerCase()) {
      mismatches.push('Row ' + (i + 1) + ': got "' + actualValues[i] + '", expected "' + sortedValues[i] + '"');
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      'Sort verification FAILED (' + sortDirection.toUpperCase() + '). Mismatches:\n' + mismatches.join('\n')
    );
  }

  ctx.log('Sort verified: all ' + count + ' records are in ' + sortDirection.toUpperCase() + ' order');
}
