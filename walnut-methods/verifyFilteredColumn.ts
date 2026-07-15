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

  // Wait for at least one matching element to appear
  await webCtx.waitForVisible(columnSelector);

  // Use page.evaluate with selector passed as argument — avoids all string injection issues
  // Supports both XPath (starting with /) and CSS selectors
  const cellTexts: string[] = await webCtx.page.evaluate((selector: string) => {
    const results: string[] = [];
    if (selector.startsWith('/') || selector.startsWith('(')) {
      // XPath selector
      const xpathResult = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        const node = xpathResult.snapshotItem(i) as Element;
        results.push(node?.textContent?.trim() || '');
      }
    } else {
      // CSS selector
      const nodes = document.querySelectorAll(selector);
      nodes.forEach(el => results.push(el.textContent?.trim() || ''));
    }
    return results;
  }, columnSelector);

  if (!cellTexts || cellTexts.length === 0) {
    throw new Error('No records found for selector "' + columnSelector + '". Filter may have returned no results.');
  }

  ctx.log('Found ' + cellTexts.length + ' record(s) to verify against "' + ctx.args[1] + '"');

  const mismatches: string[] = [];
  for (const text of cellTexts) {
    if (text.trim().toLowerCase() !== expectedValue) {
      mismatches.push(text);
    }
  }

  if (mismatches.length > 0) {
    throw new Error('Filter verification FAILED. Expected "' + ctx.args[1] + '" but found mismatches: [' + mismatches.join(', ') + ']');
  }

  ctx.log('All ' + cellTexts.length + ' record(s) match "' + ctx.args[1] + '"');
}
