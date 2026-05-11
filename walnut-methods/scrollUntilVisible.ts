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

  // args[0] = XPath of the target element to scroll to
  const targetXpath: string = c.args[0];
  if (!targetXpath) throw new Error('No target XPath provided');

  // Resolve {{variable}} placeholders and $[runtimeVar] variables
  const resolveRuntimeVars = (text: string): string =>
    text.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name);
      return (val !== undefined && val !== null) ? String(val) : '';
    });
  const resolvedTarget: string = resolveRuntimeVars(c.replacePlaceholders(targetXpath));

  c.log(`Looking for element: ${resolvedTarget}`);

  // Check element is in DOM (all 200+ rows are already rendered, just off-screen)
  const found: boolean = await c.page.evaluate((xp: string) => {
    try {
      const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      return !!el;
    } catch (_) { return false; }
  }, resolvedTarget);

  if (!found) throw new Error(`Element not found in DOM — XPath may be incorrect.\nXPath: "${resolvedTarget}"`);

  // Element is in DOM — scroll it into view directly
  c.log('Element found in DOM, scrolling into view');
  await c.page.evaluate((xp: string) => {
    const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, resolvedTarget);

  // Wait until element is actually visible in viewport
  await c.page.waitForFunction((xp: string) => {
    const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }, resolvedTarget, { timeout: 10000 });

  c.log('Element is now visible in viewport');
}
