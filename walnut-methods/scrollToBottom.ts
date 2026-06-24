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
  // args[0] — scrollSelector : XPath/CSS selector of a specific container, OR "window" to
  //                            auto-find and scroll ALL scrollable containers on the page.
  //
  // NOTE: Many apps use a fixed layout where the visible scrollbar belongs to an inner div,
  // not the browser window. Passing "window" here handles both cases — it scrolls window
  // AND every element on the page that has overflow content (scrollHeight > clientHeight).

  const c = ctx as any;

  const scrollSelector: string = c.args?.[0];

  if (!scrollSelector) throw new Error('scrollSelector (args[0]) is required. Pass "window" to auto-scroll all scrollable containers.');

  if (scrollSelector.trim().toLowerCase() === 'window') {
    // Scroll both window and ALL inner scrollable containers to bottom
    const count: number = await c.page.evaluate(() => {
      // 1. Scroll the browser window itself
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      document.documentElement.scrollTop = document.documentElement.scrollHeight;

      // 2. Find and scroll every element that has vertical overflow
      const all = Array.from(document.querySelectorAll('*'));
      let scrolled = 0;
      for (const el of all) {
        const style = window.getComputedStyle(el);
        const overflow = style.overflow + style.overflowY;
        const hasOverflow = overflow.includes('auto') || overflow.includes('scroll');
        const isScrollable = (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight;
        if (hasOverflow && isScrollable) {
          (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
          scrolled++;
        }
      }
      return scrolled;
    });
    c.log(`Scrolled window + ${count} inner scrollable container(s) to bottom`);
  } else {
    // Scroll a specific container by XPath or CSS selector
    const scrolled: boolean = await c.page.evaluate((sel: string) => {
      let el: Element | null = null;
      if (sel.startsWith('/') || sel.startsWith('(')) {
        const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        el = result.singleNodeValue as Element | null;
      } else {
        el = document.querySelector(sel);
      }
      if (!el) return false;
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      return true;
    }, scrollSelector);

    if (!scrolled) {
      throw new Error(`Scrollable container not found for selector: "${scrollSelector}"`);
    }
    c.log(`Scrolled container "${scrollSelector}" to bottom`);
  }

  await c.wait(800);
}
