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

  // The raw XPath/selector string from the linked object — available even before the element exists in DOM
  const xpath: string = c.params?.locator || c.params?.selector || c.params?.xpath;
  if (!xpath) throw new Error('Could not read XPath from linked object — ensure an object is attached to this step');

  c.log(`Scrolling until element is present: ${xpath}`);

  let lastHeight: number = await c.page.evaluate(() => document.body.scrollHeight);

  while (true) {
    // Check presence in DOM via XPath (does not require element to be visible)
    const count: number = await c.page.evaluate((xp: string) => {
      try {
        return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
      } catch (_) { return 0; }
    }, xpath);

    if (count > 0) {
      c.log(`Element found (${count} match(es)), scrolling into view`);
      await c.page.evaluate((xp: string) => {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, xpath);
      return;
    }

    // Scroll to current bottom to trigger lazy load
    await c.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new content — browser drives timing, no hardcoded pause
    await c.page.waitForFunction(
      (prevHeight: number) => document.body.scrollHeight > prevHeight,
      lastHeight,
      { timeout: 5000 }
    ).catch(() => {
      // No height change within 5s — assume page bottom reached
    });

    const newHeight: number = await c.page.evaluate(() => document.body.scrollHeight);
    c.log(`Scrolled — height before: ${lastHeight}px, height after: ${newHeight}px`);

    if (newHeight === lastHeight) {
      // Final check after reaching true bottom
      const finalCount: number = await c.page.evaluate((xp: string) => {
        try {
          return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
        } catch (_) { return 0; }
      }, xpath);

      if (finalCount > 0) {
        c.log('Element found after reaching page bottom, scrolling into view');
        await c.page.evaluate((xp: string) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, xpath);
        return;
      }

      throw new Error(`Reached the end of the page but element was not found.\nXPath: "${xpath}"`);
    }

    lastHeight = newHeight;
  }
}
