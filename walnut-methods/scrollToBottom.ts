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

  // Get the viewport size to find the center of the page for mouse wheel events
  const viewport = c.page.viewportSize() ?? { width: 1280, height: 720 };
  const x = viewport.width / 2;
  const y = viewport.height / 2;

  // Move mouse to center of page and scroll down with mouse wheel repeatedly
  // This simulates actual user scrolling and works on inner scrollable containers
  await c.page.mouse.move(x, y);
  for (let i = 0; i < 20; i++) {
    await c.page.mouse.wheel(0, 1000);
    await c.wait(100);
  }

  await c.wait(500);
  c.log('Scrolled to bottom using mouse wheel');
}
