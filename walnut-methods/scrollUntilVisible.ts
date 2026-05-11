import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll the page until the linked object becomes visible
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;
  const locator = c.locator;

  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  // Fix #2: initialize lastHeight from the actual page height, not -1
  let lastHeight: number = await c.page.evaluate(() => document.body.scrollHeight);

  while (true) {
    // Check if element is attached to DOM first (presence), then visibility
    try {
      const count: number = typeof locator === 'string'
        ? await c.count(locator)
        : await locator.count();

      if (count > 0) {
        // Element is present in DOM — now ensure it's in view
        c.log('Element is present in DOM, scrolling into view');
        if (typeof locator !== 'string') {
          await locator.scrollIntoViewIfNeeded();
        }
        return;
      }
    } catch (_) {
      // Element not yet in DOM — keep scrolling
    }

    // Scroll to the current bottom to trigger lazy load
    await c.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Fix #1: wait only for height to grow, not readyState (which is always 'complete')
    await c.page.waitForFunction(
      (prevHeight: number) => document.body.scrollHeight > prevHeight,
      lastHeight,
      { timeout: 5000 }
    ).catch(() => {
      // No new content loaded within 5s — page bottom reached
    });

    const newHeight: number = await c.page.evaluate(() => document.body.scrollHeight);
    c.log(`Scrolled — height before: ${lastHeight}px, height after: ${newHeight}px`);

    if (newHeight === lastHeight) {
      // Page height hasn't grown — truly at the bottom, do a final presence check
      const finalCount: number = typeof locator === 'string'
        ? await c.count(locator).catch(() => 0)
        : await locator.count().catch(() => 0);

      if (finalCount > 0) {
        c.log('Element found after reaching page bottom');
        if (typeof locator !== 'string') {
          await locator.scrollIntoViewIfNeeded();
        }
        return;
      }

      throw new Error('Reached the end of the page but the element was not found.');
    }

    lastHeight = newHeight;
  }
}
