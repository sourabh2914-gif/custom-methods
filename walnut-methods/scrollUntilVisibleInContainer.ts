import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Visible In Container
 * description: Scroll container until the object is found, with max ${maxScrolls} scroll attempts
 * actionType: custom_scroll_until_visible_in_container
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisibleInContainer(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const locator = (ctx as any).locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  const maxScrolls = parseInt(ctx.args[0], 10) || 50;
  const page = ctx.page;

  // Retrieve the XPath/selector string from the locator so we can re-query fresh each time
  // This avoids "Element is not attached to the DOM" on stale references after re-renders
  const selectorStr: string | undefined =
    (locator as any)._selector ??
    (locator as any)._locator?._selector ??
    (locator as any)._impl?._selector;

  const isFreshPresent = async (): Promise<boolean> => {
    try {
      if (selectorStr) {
        return (await page.locator(selectorStr).count()) > 0;
      }
      return (await locator.count()) > 0;
    } catch {
      return false;
    }
  };

  const scrollFreshIntoView = async (): Promise<void> => {
    try {
      if (selectorStr) {
        await page.locator(selectorStr).first().scrollIntoViewIfNeeded();
      } else {
        await locator.first().scrollIntoViewIfNeeded();
      }
    } catch {
      /* ignore — best-effort scroll */
    }
  };

  // Short-circuit: element already present
  if (await isFreshPresent()) {
    await scrollFreshIntoView();
    ctx.log('[ScrollUntilVisibleInContainer] Element already present — scrolled into view');
    return;
  }

  // Find the scrollable overflow container that wraps the table
  // Matches the div.custom-scrollbar.w-full.overflow-auto pattern visible in DevTools
  const containerSelector = 'div.overflow-auto, div[class*="overflow-auto"], div[class*="custom-scrollbar"]';

  let prevScrollTop = -1;
  let prevRowCount  = -1;

  for (let i = 0; i < maxScrolls; i++) {

    // Scroll the overflow container by one viewport-height worth of pixels
    const scrollResult: { scrollTop: number; scrollHeight: number; clientHeight: number } =
      await page.evaluate((sel: string) => {
        const container = document.querySelector(sel) as HTMLElement | null;
        if (container) {
          container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
          return {
            scrollTop:    container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
          };
        }
        // Fallback: scroll window
        window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        return { scrollTop: window.scrollY, scrollHeight: document.body.scrollHeight, clientHeight: window.innerHeight };
      }, containerSelector);

    // Also scroll the last visible row into view to trigger table's own virtual/infinite scroll
    const lastRow = page.locator('tbody tr').last();
    if ((await lastRow.count()) > 0) {
      try { await lastRow.scrollIntoViewIfNeeded(); } catch { /* ignore stale */ }
    }

    await ctx.wait(600);

    const rowCount: number = await page.locator('tbody tr').count();
    const scrollTop = scrollResult.scrollTop;

    ctx.log(
      `[ScrollUntilVisibleInContainer] iteration=${i + 1} rows=${rowCount} ` +
      `scrollTop=${scrollTop}px scrollHeight=${scrollResult.scrollHeight}px`
    );

    // Check for target after scroll
    if (await isFreshPresent()) {
      ctx.log('[ScrollUntilVisibleInContainer] Element found — scrolling into view');
      await scrollFreshIntoView();
      return;
    }

    // Stagnation check — neither container moved nor new rows loaded
    if (scrollTop === prevScrollTop && rowCount === prevRowCount) {
      ctx.log(`[ScrollUntilVisibleInContainer] Stagnation at iteration=${i + 1} — waiting 3s for lazy load...`);
      await ctx.wait(3000);

      // Retry scroll after grace period
      const retryResult: { scrollTop: number; scrollHeight: number; clientHeight: number } =
        await page.evaluate((sel: string) => {
          const container = document.querySelector(sel) as HTMLElement | null;
          if (container) {
            container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
            container.dispatchEvent(new Event('scroll', { bubbles: true }));
            return {
              scrollTop:    container.scrollTop,
              scrollHeight: container.scrollHeight,
              clientHeight: container.clientHeight,
            };
          }
          window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
          window.dispatchEvent(new Event('scroll', { bubbles: true }));
          return { scrollTop: window.scrollY, scrollHeight: document.body.scrollHeight, clientHeight: window.innerHeight };
        }, containerSelector);

      const lastRowRetry = page.locator('tbody tr').last();
      if ((await lastRowRetry.count()) > 0) {
        try { await lastRowRetry.scrollIntoViewIfNeeded(); } catch { /* ignore stale */ }
      }

      await ctx.wait(600);

      const rowCountRetry: number = await page.locator('tbody tr').count();
      ctx.log(
        `[ScrollUntilVisibleInContainer] Post-grace: rows=${rowCountRetry} scrollTop=${retryResult.scrollTop}px`
      );

      if (await isFreshPresent()) {
        ctx.log('[ScrollUntilVisibleInContainer] Element found after grace period — scrolling into view');
        await scrollFreshIntoView();
        return;
      }

      // Still completely stagnant → truly at bottom
      if (rowCountRetry === rowCount && retryResult.scrollTop === scrollTop) {
        throw new Error(
          `[ScrollUntilVisibleInContainer] Reached bottom after ${i + 1} scroll(s) — element not found.`
        );
      }

      prevScrollTop = retryResult.scrollTop;
      prevRowCount  = rowCountRetry;
      continue;
    }

    prevScrollTop = scrollTop;
    prevRowCount  = rowCount;
  }

  throw new Error(
    `[ScrollUntilVisibleInContainer] Exceeded max scroll limit (${maxScrolls}) — element not found.`
  );
}
