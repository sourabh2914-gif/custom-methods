import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll inside container ${containerXpath} until element ${targetXpath} is present
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] = XPath of the scrollable container (e.g. the Surveys list div)
  // args[1] = XPath of the target element to find
  const containerXpath: string = c.args[0];
  const targetXpath: string = c.args[1];

  if (!containerXpath) throw new Error('No container XPath provided — pass the scrollable container XPath as the first argument');
  if (!targetXpath) throw new Error('No target XPath provided — pass the target element XPath as the second argument');

  // Resolve any {{variable}} placeholders in both XPaths
  const resolvedContainer: string = c.replacePlaceholders(containerXpath);
  const resolvedTarget: string = c.replacePlaceholders(targetXpath);

  c.log(`Container XPath: ${resolvedContainer}`);
  c.log(`Target XPath: ${resolvedTarget}`);

  // Verify the container exists first
  const containerExists: boolean = await c.page.evaluate((xp: string) => {
    try {
      const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      return !!el;
    } catch (_) { return false; }
  }, resolvedContainer);

  if (!containerExists) throw new Error(`Scrollable container not found in DOM.\nXPath: "${resolvedContainer}"`);

  while (true) {
    // Check if target element is present in DOM
    const found: boolean = await c.page.evaluate((xp: string) => {
      try {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return !!el;
      } catch (_) { return false; }
    }, resolvedTarget);

    if (found) {
      c.log('Target element found, scrolling into view');
      await c.page.evaluate((xp: string) => {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, resolvedTarget);
      return;
    }

    // Get current scroll state of the container
    const scrollState = await c.page.evaluate((xp: string) => {
      const container = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      if (!container) return null;
      return {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
      };
    }, resolvedContainer);

    if (!scrollState) throw new Error('Container disappeared during scrolling');

    const atBottom = scrollState.scrollTop + scrollState.clientHeight >= scrollState.scrollHeight - 2;

    if (atBottom) {
      // Final check — last lazy-load batch may have just rendered
      const finalFound: boolean = await c.page.evaluate((xp: string) => {
        try {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          return !!el;
        } catch (_) { return false; }
      }, resolvedTarget);

      if (finalFound) {
        c.log('Target element found after reaching container bottom');
        await c.page.evaluate((xp: string) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, resolvedTarget);
        return;
      }

      throw new Error(`Reached the bottom of the container but target element was not found.\nXPath: "${resolvedTarget}"`);
    }

    // Scroll down inside the container — browser drives lazy load
    const prevScrollTop: number = scrollState.scrollTop;

    await c.page.evaluate((xp: string) => {
      const container = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      if (container) container.scrollTop += container.clientHeight;
    }, resolvedContainer);

    // Wait for container scrollHeight to grow (lazy load) or scrollTop to change
    await c.page.waitForFunction(
      ({ xp, prevTop }: { xp: string; prevTop: number }) => {
        const container = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (!container) return true;
        return container.scrollTop !== prevTop || container.scrollHeight > container.clientHeight + prevTop;
      },
      { xp: resolvedContainer, prevTop: prevScrollTop },
      { timeout: 5000 }
    ).catch(() => {});

    const newScrollTop: number = await c.page.evaluate((xp: string) => {
      const container = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      return container ? container.scrollTop : 0;
    }, resolvedContainer);

    c.log(`Container scrolled — scrollTop before: ${prevScrollTop}px, after: ${newScrollTop}px`);
  }
}
