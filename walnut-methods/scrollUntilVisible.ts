import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll the page until element ${targetXpath} is present
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] = XPath of the target element
  // args[1] fallback for old 2-arg step configs
  const rawTarget: string = c.args[0] || c.args[1];
  if (!rawTarget) throw new Error('No target XPath provided');

  // Resolve {{variable}} and $[runtimeVar] in the XPath
  const resolveAll = (text: string): string => {
    const withPlaceholders = c.replacePlaceholders(text);
    return withPlaceholders.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name);
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  };

  const resolvedTarget: string = resolveAll(rawTarget);
  c.log(`Target XPath: ${resolvedTarget}`);

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

  // Already in DOM — done
  if (await isInDOM()) {
    c.log('Element already in DOM, scrolling into view');
    await scrollIntoView();
    return;
  }

  // Log ALL scrollable containers found so we know exactly what the page has
  const allContainers: { tag: string; classes: string; scrollHeight: number; clientHeight: number; scrollTop: number }[] =
    await c.page.evaluate(() => {
      const results: any[] = [];
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all as HTMLElement[]) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          results.push({
            tag: el.tagName,
            classes: el.className || '',
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollTop: el.scrollTop,
          });
        }
      }
      return results;
    });

  c.log(`Found ${allContainers.length} scrollable container(s):`);
  for (const ct of allContainers) {
    c.log(`  [${ct.tag}] classes="${ct.classes.substring(0, 80)}" scrollHeight=${ct.scrollHeight} clientHeight=${ct.clientHeight} scrollTop=${ct.scrollTop}`);
  }

  // Pick the best container — largest clientHeight among scrollable elements (main panel)
  const best = allContainers.sort((a, b) => b.clientHeight - a.clientHeight)[0];
  if (!best) throw new Error('No scrollable container found on this page');

  c.log(`Using container: [${best.tag}] classes="${best.classes.substring(0, 80)}" scrollHeight=${best.scrollHeight}`);

  // Use the classes of the best container to scroll it
  const bestClasses = best.classes.trim().split(/\s+/).slice(0, 3).join('.');

  let prevScrollTop = -1;

  while (true) {
    const currentScrollTop: number = await c.page.evaluate((classes: string) => {
      // Find the container by its first 3 classes
      const selector = classes.split('.').filter(Boolean).map((c: string) => `.${CSS.escape(c)}`).join('');
      const el = selector ? document.querySelector(selector) as HTMLElement : null;
      if (el) {
        const before = el.scrollTop;
        el.scrollTop += el.clientHeight;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
        return el.scrollTop;
      }
      return -1;
    }, bestClasses);

    c.log(`Scrolled container — scrollTop now: ${currentScrollTop}px`);

    // Wait up to 3s for target to appear (lazy load renders new rows)
    await c.page.waitForFunction(
      (xp: string) => {
        try {
          return !!document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (_) { return false; }
      },
      resolvedTarget,
      { timeout: 3000 }
    ).catch(() => {});

    if (await isInDOM()) {
      c.log('Element found! Scrolling into view');
      await scrollIntoView();
      return;
    }

    // scrollTop unchanged = we hit the bottom
    if (currentScrollTop === prevScrollTop || currentScrollTop === -1) {
      throw new Error(`Reached the bottom of the container but element was not found.\nXPath: "${resolvedTarget}"`);
    }

    prevScrollTop = currentScrollTop;
  }
}
