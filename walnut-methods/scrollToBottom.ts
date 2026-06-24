import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll To Bottom
 * description: Scroll ${scrollSelector} container to the bottom
 * actionType: custom_scroll_to_bottom
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function scrollToBottom(ctx: WalnutContext) {
  // args[0] — scrollSelector : XPath or CSS selector of the scrollable container
  //                            Pass "window" to scroll the main page to the bottom
  //
  // Example:
  //   scrollSelector = "window"  → scrolls the full page to bottom
  //   scrollSelector = "//div[contains(@class,'overflow-y-auto')]"  → scrolls a specific panel

  const c = ctx as any;

  const scrollSelector: string = c.args?.[0];

  if (!scrollSelector) throw new Error('scrollSelector (args[0]) is required. Pass "window" to scroll the main page.');

  if (scrollSelector.trim().toLowerCase() === 'window') {
    // Scroll the entire page to the very bottom
    await c.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    c.log('Scrolled main page (window) to bottom');
  } else {
    // Scroll a specific container element to its bottom
    const scrolled: boolean = await c.page.evaluate((xpath: string) => {
      // Support both XPath and CSS selectors
      let el: Element | null = null;
      if (xpath.startsWith('/') || xpath.startsWith('(')) {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        el = result.singleNodeValue as Element | null;
      } else {
        el = document.querySelector(xpath);
      }
      if (!el) return false;
      (el as HTMLElement).scrollTo({ top: (el as HTMLElement).scrollHeight, behavior: 'smooth' });
      return true;
    }, scrollSelector);

    if (!scrolled) {
      throw new Error(`Scrollable container not found for selector: "${scrollSelector}"`);
    }
    c.log(`Scrolled container "${scrollSelector}" to bottom`);
  }

  // Wait for smooth scroll to complete
  await c.wait(800);
}
