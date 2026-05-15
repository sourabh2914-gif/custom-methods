import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Visible
 * description: Scroll page until the object is found, with max ${maxScrolls} scroll attempts
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const locator = (ctx as any).locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  const maxScrolls = parseInt(ctx.args[0], 10) || 50;
  const page = ctx.page;

  const isPresent = async (): Promise<boolean> => {
    try { return (await locator.count()) > 0; } catch { return false; }
  };

  const scrollIntoView = async (): Promise<void> => {
    try { await locator.first().scrollIntoViewIfNeeded(); } catch { /* ignore */ }
  };

  // Short-circuit if already in DOM
  if (await isPresent()) {
    await scrollIntoView();
    ctx.log('[ScrollUntilVisible] Element already present — scrolled into view');
    return;
  }

  let prevRowCount = -1;
  let prevWindowY  = -1;

  for (let i = 0; i < maxScrolls; i++) {

    // 1. Scroll last <tr> into view — triggers table infinite-scroll
    const lastRow = page.locator('tbody tr').last();
    if (await lastRow.count() > 0) {
      await lastRow.scrollIntoViewIfNeeded();
    }

    // 2. Push window down — triggers window-level infinite-scroll
    const windowY: number = await page.evaluate(() => {
      window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll', { bubbles: true }));
      return window.scrollY;
    });

    // Wait for new items to render
    await ctx.wait(500);

    const rowCount: number = await page.locator('tbody tr').count();
    ctx.log(`[ScrollUntilVisible] iteration=${i + 1} rows=${rowCount} windowY=${windowY}px`);

    // Check for target
    if (await isPresent()) {
      ctx.log('[ScrollUntilVisible] Element found — scrolling into view');
      await scrollIntoView();
      return;
    }

    // Bottom detection: neither rows increased nor window moved
    if (rowCount === prevRowCount && windowY === prevWindowY) {
      ctx.log(`[ScrollUntilVisible] Stagnation at iteration=${i + 1} — waiting 3s for lazy load...`);
      await ctx.wait(3000);

      // Retry scroll after grace period
      const lastRowRetry = page.locator('tbody tr').last();
      if (await lastRowRetry.count() > 0) {
        await lastRowRetry.scrollIntoViewIfNeeded();
      }
      const windowYRetry: number = await page.evaluate(() => {
        window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        return window.scrollY;
      });
      await ctx.wait(500);

      const rowCountRetry: number = await page.locator('tbody tr').count();
      ctx.log(`[ScrollUntilVisible] Post-grace-period: rows=${rowCountRetry} windowY=${windowYRetry}px`);

      // Check target again before deciding
      if (await isPresent()) {
        ctx.log('[ScrollUntilVisible] Element found after grace period — scrolling into view');
        await scrollIntoView();
        return;
      }

      // Still stagnant after retry → truly at bottom
      if (rowCountRetry === rowCount && windowYRetry === windowY) {
        throw new Error(
          `[ScrollUntilVisible] Reached bottom after ${i + 1} scroll(s) — element not found.`
        );
      }

      // New rows loaded — update state and continue normal loop
      prevRowCount = rowCountRetry;
      prevWindowY  = windowYRetry;
      continue;
    }

    prevRowCount = rowCount;
    prevWindowY  = windowY;
  }

  throw new Error(
    `[ScrollUntilVisible] Exceeded max scroll limit (${maxScrolls}) — element not found.`
  );
}
