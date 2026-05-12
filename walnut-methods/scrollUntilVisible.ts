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

  // args[0] = XPath of the scrollable container
  // args[1] = XPath of the target element to find
  const rawContainer: string = c.args[0];
  const rawTarget: string = c.args[1];

  if (!rawContainer) throw new Error('No container XPath provided — pass the scrollable container XPath as the first argument');
  if (!rawTarget) throw new Error('No target XPath provided — pass the target element XPath as the second argument');

  // Resolve {{variable}} and $[runtimeVar] in both XPaths
  const resolveAll = (text: string): string => {
    const withPlaceholders = c.replacePlaceholders(text);
    return withPlaceholders.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name);
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  };

  const resolvedContainer: string = resolveAll(rawContainer);
  const resolvedTarget: string = resolveAll(rawTarget);

  c.log(`Container XPath: ${resolvedContainer}`);
  c.log(`Target XPath:    ${resolvedTarget}`);

  // Check if target already in DOM
  const isInDOM = (): Promise<boolean> =>
    c.page.evaluate((xp: string) => {
      try {
        return !!document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch (_) { return false; }
    }, resolvedTarget);

  // Scroll target into view
  const scrollIntoView = (): Promise<void> =>
    c.page.evaluate((xp: string) => {
      const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      if (el) el.scrollIntoView({ block: 'center' });
    }, resolvedTarget);

  // Already in DOM — done immediately
  if (await isInDOM()) {
    c.log('Element already in DOM, scrolling into view');
    await scrollIntoView();
    return;
  }

  // Verify container exists
  const containerExists: boolean = await c.page.evaluate((xp: string) => {
    try {
      return !!document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (_) { return false; }
  }, resolvedContainer);

  if (!containerExists) throw new Error(`Container not found in DOM.\nXPath: "${resolvedContainer}"`);

  // Log container scroll state for debugging
  const containerState = await c.page.evaluate((xp: string) => {
    const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
      overflowY: style.overflowY,
    };
  }, resolvedContainer);

  c.log(`Container state — scrollHeight: ${containerState?.scrollHeight}px, clientHeight: ${containerState?.clientHeight}px, overflowY: ${containerState?.overflowY}`);

  let prevScrollTop = -1;

  while (true) {
    // Scroll the container down by one clientHeight and fire scroll event
    const currentScrollTop: number = await c.page.evaluate((xp: string) => {
      const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      if (!el) return -1;
      el.scrollTop += el.clientHeight;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
      return el.scrollTop;
    }, resolvedContainer);

    c.log(`Scrolled — scrollTop now: ${currentScrollTop}px`);

    // Wait up to 3s for target to appear after lazy load renders
    await c.page.waitForFunction(
      (xp: string) => {
        try {
          return !!document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (_) { return false; }
      },
      resolvedTarget,
      { timeout: 3000 }
    ).catch(() => {});

    // Check if target appeared
    if (await isInDOM()) {
      c.log('Element found! Scrolling into view');
      await scrollIntoView();
      return;
    }

    // scrollTop did not change — we hit the bottom of the container
    if (currentScrollTop === prevScrollTop || currentScrollTop === -1) {
      throw new Error(`Reached the bottom of the container but element was not found.\nXPath: "${resolvedTarget}"`);
    }

    prevScrollTop = currentScrollTop;
  }
}
