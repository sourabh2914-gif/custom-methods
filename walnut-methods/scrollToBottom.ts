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
  // args[0] — scrollSelector : pass "window" to scroll the page to bottom

  const c = ctx as any;
  const scrollSelector: string = c.args?.[0];

  if (!scrollSelector) throw new Error('scrollSelector (args[0]) is required. Pass "window".');

  // Click the body to ensure the page has focus, then press End to scroll to bottom
  await c.page.click('body');
  await c.page.keyboard.press('End');
  await c.wait(500);
  // Press End again to make sure we're at the very last position
  await c.page.keyboard.press('End');
  await c.wait(800);
  c.log('Scrolled to bottom using End key');
}
