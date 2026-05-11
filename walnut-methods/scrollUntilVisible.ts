import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll the page until element ${targetXpath} is visible
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] = XPath of the target element
  // Note: if old step config still passes two args, targetXpath may land in args[0] or args[1]
  // Try args[0] first, fall back to args[1] for backwards compatibility
  const rawTarget: string = c.args[0] || c.args[1];
  if (!rawTarget) throw new Error('No target XPath provided — set the targetXpath argument in the step');

  // Resolve {{variable}} placeholders and $[runtimeVar] variables
  const resolveRuntimeVars = (text: string): string =>
    text.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name);
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  const resolvedTarget: string = resolveRuntimeVars(c.replacePlaceholders(rawTarget));

  c.log(`Target XPath: ${resolvedTarget}`);

  // Helper — check if element exists in DOM via XPath
  const isInDOM = (): Promise<boolean> =>
    c.page.evaluate((xp: string) => {
      try {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return !!el;
      } catch (_) { return false; }
    }, resolvedTarget);

  // Check if already in DOM before scrolling
  if (await isInDOM()) {
    c.log('Element already in DOM, scrolling into view');
    await c.page.evaluate((xp: string) => {
      const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, resolvedTarget);
    return;
  }

  // Element not yet in DOM — scroll page to trigger lazy loading
  let lastHeight: number = await c.page.evaluate(() => document.body.scrollHeight);

  while (true) {
    // Scroll page to current bottom to trigger next batch of lazy load
    await c.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for page height to grow (new rows loaded) — no hardcoded pause
    await c.page.waitForFunction(
      (prev: number) => document.body.scrollHeight > prev,
      lastHeight,
      { timeout: 5000 }
    ).catch(() => {
      // No height change — page bottom reached, no more lazy content
    });

    const newHeight: number = await c.page.evaluate(() => document.body.scrollHeight);
    c.log(`Page height: ${lastHeight}px → ${newHeight}px`);

    // Check if target appeared after this scroll/load
    if (await isInDOM()) {
      c.log('Element found after scrolling, bringing into view');
      await c.page.evaluate((xp: string) => {
        const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, resolvedTarget);
      return;
    }

    if (newHeight === lastHeight) {
      // Page stopped growing and element still not found
      throw new Error(`Reached the end of the page but element was not found.\nXPath: "${resolvedTarget}"`);
    }

    lastHeight = newHeight;
  }
}
