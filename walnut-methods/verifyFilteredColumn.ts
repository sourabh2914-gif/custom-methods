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

  // ctx.args[0] = columnSelector — CSS selector targeting all cells in the filtered column
  // ctx.args[1] = expectedValue  — the value every cell must match (e.g. "Jimmy Tata", "Public", "Active")
  const columnSelector = ctx.args[0];
  const expectedValue = ctx.args[1]?.trim().toLowerCase();

  // Wait for the table rows to be present
  await webCtx.waitForVisible(columnSelector);

  // Collect text from every visible cell in the column
  const cellTexts: string[] = await webCtx.evaluate(`
    (() => {
      const cells = document.querySelectorAll('${columnSelector}');
      return Array.from(cells).map(el => el.textContent?.trim() || '');
    })()
  `) as string[];

  if (!cellTexts || cellTexts.length === 0) {
    throw new Error(
      \`No records found for column selector "\${columnSelector}". Filter may have returned no results.\`
    );
  }

  ctx.log(\`Found \${cellTexts.length} record(s) to verify against "\${ctx.args[1]}"\`);

  const mismatches: string[] = [];

  for (const text of cellTexts) {
    if (text.trim().toLowerCase() !== expectedValue) {
      mismatches.push(text);
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      \`Filter verification FAILED. Expected all values to be "\${ctx.args[1]}" but found mismatches: [\${mismatches.join(', ')}]\`
    );
  }

  ctx.log(\`✓ All \${cellTexts.length} record(s) match "\${ctx.args[1]}"\`);
}
