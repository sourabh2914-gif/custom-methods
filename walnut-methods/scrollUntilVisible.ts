import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll inside container ${containerXpath} until the linked object is present
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] = XPath/CSS of the scrollable container
  const rawContainer: string = c.args[0];
  if (!rawContainer) throw new Error('No container XPath provided — pass the scrollable container XPath as the first argument');

  // Resolve {{variable}} and $[runtimeVar] in container locator
  const resolveAll = (text: string): string => {
    const withPlaceholders = c.replacePlaceholders(text);
    return withPlaceholders.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name);
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  };

  const resolvedContainer: string = resolveAll(rawContainer);

  // Get the linked object locator — works with ANY locator type (XPath, CSS, text, etc.)
  const locator = c.locator;
  if (!locator) throw new Error('No object linked to this step — attach the target object in the test case editor');

  c.log(`Container: ${resolvedContainer}`);
  c.log(`Target locator type: ${typeof locator === 'string' ? 'string' : 'Playwright Locator'}`);

  // Check if target is already present using the locator directly
  const isPresent = async (): Promise<boolean> => {
    try {
      const count = typeof locator === 'string'
        ? await c.count(locator)
        : await locator.count();
      return count > 0;
    } catch (_) { return false; }
  };

  // Scroll target into view using the locator directly
  const scrollIntoView = async (): Promise<void> => {
    try {
      if (typeof locator === 'string') {
        await c.page.evaluate((sel: string) => {
          const el = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement
            || document.querySelector(sel) as HTMLElement;
          if (el) el.scrollIntoView({ block: 'center' });
        }, locator);
      } else {
        await locator.first().scrollIntoViewIfNeeded();
      }
    } catch (_) {}
  };

  // Already present — done immediately
  if (await isPresent()) {
    c.log('Element already present, scrolling into view');
    await scrollIntoView();
    return;
  }

  // Verify container exists
  const containerExists: boolean = await c.page.evaluate((xp: string) => {
    try {
      return !!(
        document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
        document.querySelector(xp)
      );
    } catch (_) {
      return !!document.querySelector(xp);
    }
  }, resolvedContainer);

  if (!containerExists) throw new Error(`Container not found in DOM.\nLocator: "${resolvedContainer}"`);

  // Log container scroll info
  const containerState = await c.page.evaluate((xp: string) => {
    const el = (
      document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
      document.querySelector(xp)
    ) as HTMLElement;
    if (!el) return null;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      overflowY: window.getComputedStyle(el).overflowY,
    };
  }, resolvedContainer);

  c.log(`Container — scrollHeight: ${containerState?.scrollHeight}px, clientHeight: ${containerState?.clientHeight}px, overflowY: ${containerState?.overflowY}`);

  let prevScrollTop = -1;

  while (true) {
    // Scroll container down by one clientHeight and fire scroll event for lazy load
    const currentScrollTop: number = await c.page.evaluate((xp: string) => {
      const el = (
        document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
        document.querySelector(xp)
      ) as HTMLElement;
      if (!el) return -1;
      el.scrollTop += el.clientHeight;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
      return el.scrollTop;
    }, resolvedContainer);

    c.log(`Scrolled — scrollTop now: ${currentScrollTop}px`);

    // Wait up to 3s for lazy load to render new rows then check presence
    await c.page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {});

    // Check using the actual locator — works for any selector type
    if (await isPresent()) {
      c.log('Element found! Scrolling into view');
      await scrollIntoView();
      return;
    }

    // scrollTop unchanged — hit the bottom of the container
    if (currentScrollTop === prevScrollTop || currentScrollTop === -1) {
      throw new Error(`Reached the bottom of the container but the linked element was not found.`);
    }

    prevScrollTop = currentScrollTop;
  }
}
