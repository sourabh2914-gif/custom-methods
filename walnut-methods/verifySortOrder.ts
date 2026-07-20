import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Column Sort Order
 * description: Verify column ${headerSelector} is sorted ${sortDirection}
 * actionType: custom_verify_sort_order
 * context: web
 * needsLocator: false
 * category: Validation
 */
export async function verifySortOrder(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;

  // ctx.args[0] = headerSelector — XPath/CSS of the column header (th) to derive column index
  // ctx.args[1] = sortDirection  — "asc" (ascending) or "desc" (descending)
  const headerSelector = ctx.args[0];
  const sortDirection = ctx.args[1]?.trim().toLowerCase();

  if (sortDirection !== 'asc' && sortDirection !== 'desc') {
    throw new Error('sortDirection must be "asc" or "desc", got: "' + ctx.args[1] + '"');
  }

  // Step 1 — Find the column index from the header
  const headerLocator = webCtx.page.locator(headerSelector);
  await headerLocator.first().waitFor({ state: 'visible', timeout: 10000 });

  // Get 1-based column index by evaluating position among sibling th elements
  const colIndex: number = await webCtx.page.evaluate((sel: string) => {
    let header: Element | null = null;

    // Support both XPath and CSS selectors
    if (sel.startsWith('/') || sel.startsWith('(')) {
      const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      header = result.singleNodeValue as Element | null;
    } else {
      header = document.querySelector(sel);
    }

    if (!header) throw new Error('Header element not found for selector: ' + sel);

    const siblings = Array.from(header.parentElement?.children || []);
    return siblings.indexOf(header) + 1; // 1-based index
  }, headerSelector);

  ctx.log('Detected column index: ' + colIndex);

  // Step 2 — Locate all data cells (td) in that column using nth-child
  const cellLocator = webCtx.page.locator('tbody tr td:nth-child(' + colIndex + ')');
  await cellLocator.first().waitFor({ state: 'visible', timeout: 10000 });

  const count = await cellLocator.count();
  if (count === 0) {
    throw new Error('No data rows found for column index ' + colIndex);
  }

  ctx.log('Collected ' + count + ' cell(s) from column ' + colIndex);

  // Step 3 — Collect all cell text values
  const actualValues: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await cellLocator.nth(i).textContent() || '').trim();
    actualValues.push(text);
  }

  // Step 4 — Build the expected sorted order
  const sortedValues = [...actualValues].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower < bLower) return sortDirection === 'asc' ? -1 : 1;
    if (aLower > bLower) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Step 5 — Compare actual vs expected order
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
