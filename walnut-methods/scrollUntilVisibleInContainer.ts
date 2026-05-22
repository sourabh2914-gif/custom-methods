import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Visible In Container
 * description: Scroll container until the object is found
 * actionType: custom_scroll_until_visible_in_container
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisibleInContainer(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const locator = (ctx as any).locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  const page = ctx.page;

  // locator already has the resolved XPath (Walnut resolves $[varName] placeholders before
  // creating ctx.locator). We call locator.count() fresh on each check — never hold a
  // DOM element reference, so no "not attached to DOM" errors.
  const isPresent = async (): Promise<boolean> => {
    try { return (await locator.count()) > 0; } catch { return false; }
  };

  // Short-circuit: already in DOM before any scrolling needed
  if (await isPresent()) {
    ctx.log('[ScrollUntilVisibleInContainer] Element already in DOM — done');
    return;
  }

  let prevScrollTop = -1;
  let prevRowCount  = -1;
  let iteration     = 0;

  while (true) {
    iteration++;

    // Scroll the overflow-auto container entirely via page.evaluate — no Playwright
    // DOM handles are held, so re-renders never cause stale reference errors.
    const scrollInfo: { scrollTop: number; scrollHeight: number; containerFound: boolean } =
      await page.evaluate(() => {
        // Find the scrollable table wrapper — pick the overflow-auto div with the
        // most scrollable content (scrollHeight > clientHeight and tallest overall)
        const candidates = Array.from(
          document.querySelectorAll('div[class*="overflow-auto"], div[class*="custom-scrollbar"]')
        ) as HTMLElement[];

        candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
        const container = candidates.find(el => el.scrollHeight > el.clientHeight) ?? null;

        if (container) {
          container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
          return {
            scrollTop:      container.scrollTop,
            scrollHeight:   container.scrollHeight,
            containerFound: true,
          };
        }

        // Fallback: window-level scroll
        window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        return {
          scrollTop:      window.scrollY,
          scrollHeight:   document.body.scrollHeight,
          containerFound: false,
        };
      });

    // Wait for lazy-loaded rows to render
    await ctx.wait(600);

    const rowCount: number = await page.locator('tbody tr').count();
    const scrollTop = scrollInfo.scrollTop;

    ctx.log(
      `[ScrollUntilVisibleInContainer] iteration=${iteration} rows=${rowCount} ` +
      `scrollTop=${scrollTop}px scrollHeight=${scrollInfo.scrollHeight}px containerFound=${scrollInfo.containerFound}`
    );

    // Stop as soon as the element appears in the DOM
    if (await isPresent()) {
      ctx.log('[ScrollUntilVisibleInContainer] Element found — stopping scroll');
      return;
    }

    // Stagnation: container position unchanged AND no new rows loaded
    if (scrollTop === prevScrollTop && rowCount === prevRowCount) {
      ctx.log(`[ScrollUntilVisibleInContainer] Stagnation at iteration=${iteration} — waiting 3s for lazy load...`);
      await ctx.wait(3000);

      // One more scroll attempt after the grace period
      const retryInfo: { scrollTop: number; scrollHeight: number; containerFound: boolean } =
        await page.evaluate(() => {
          const candidates = Array.from(
            document.querySelectorAll('div[class*="overflow-auto"], div[class*="custom-scrollbar"]')
          ) as HTMLElement[];
          candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
          const container = candidates.find(el => el.scrollHeight > el.clientHeight) ?? null;

          if (container) {
            container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
            container.dispatchEvent(new Event('scroll', { bubbles: true }));
            return { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight, containerFound: true };
          }
          window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
          window.dispatchEvent(new Event('scroll', { bubbles: true }));
          return { scrollTop: window.scrollY, scrollHeight: document.body.scrollHeight, containerFound: false };
        });

      await ctx.wait(600);

      const rowCountRetry: number = await page.locator('tbody tr').count();
      ctx.log(
        `[ScrollUntilVisibleInContainer] Post-grace: rows=${rowCountRetry} scrollTop=${retryInfo.scrollTop}px`
      );

      if (await isPresent()) {
        ctx.log('[ScrollUntilVisibleInContainer] Element found after grace period — stopping scroll');
        return;
      }

      // Truly at bottom — nothing moved even after grace period
      if (rowCountRetry === rowCount && retryInfo.scrollTop === scrollTop) {
        throw new Error(
          `[ScrollUntilVisibleInContainer] Reached bottom after ${iteration} scroll(s) — element not found.`
        );
      }

      prevScrollTop = retryInfo.scrollTop;
      prevRowCount  = rowCountRetry;
      continue;
    }

    prevScrollTop = scrollTop;
    prevRowCount  = rowCount;
  }
}
