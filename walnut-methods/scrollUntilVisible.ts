import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll the page until element with xpath ${xpath} is present
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] = xpath from ${xpath} in description
  const xpath = c.args[0];
  if (!xpath) throw new Error('No XPath provided — pass the element XPath as the first argument');

  let lastHeight: number = await c.page.evaluate(() => document.body.scrollHeight);

  while (true) {
    // Check if element is present in DOM using XPath
    const count: number = await c.page.evaluate((xp: string) => {
      return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
    }, xpath).catch(() => 0);

    if (count > 0) {
      c.log(`Element found (${count} match(es)), scrolling into view`);
      // Scroll the element into view via JS
      await c.page.evaluate((xp: string) => {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, xpath);
      return;
    }

    // Scroll to current bottom to trigger lazy load
    await c.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new content to load (height increase) — browser drives the timing
    await c.page.waitForFunction(
      (prevHeight: number) => document.body.scrollHeight > prevHeight,
      lastHeight,
      { timeout: 5000 }
    ).catch(() => {
      // No height change within 5s — page bottom reached
    });

    const newHeight: number = await c.page.evaluate(() => document.body.scrollHeight);
    c.log(`Scrolled — height before: ${lastHeight}px, height after: ${newHeight}px`);

    if (newHeight === lastHeight) {
      // Truly at the bottom — final presence check
      const finalCount: number = await c.page.evaluate((xp: string) => {
        return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
      }, xpath).catch(() => 0);

      if (finalCount > 0) {
        c.log('Element found after reaching page bottom, scrolling into view');
        await c.page.evaluate((xp: string) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, xpath);
        return;
      }

      throw new Error(`Reached the end of the page but element with XPath "${xpath}" was not found.`);
    }

    lastHeight = newHeight;
  }
}
