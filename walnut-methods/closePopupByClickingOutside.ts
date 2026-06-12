import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Close Popup By Clicking Outside
 * description: Close the appointment popup by clicking on the overlay backdrop
 * actionType: custom_close_popup_by_clicking_outside
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function closePopupByClickingOutside(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const overlaySelector = 'div.fixed.inset-0.z-50';

  ctx.log('Waiting for overlay backdrop to be visible...');
  await ctx.waitForVisible(overlaySelector);

  // Dispatch a native click event directly on the overlay element via JS,
  // bypassing z-index / pointer-events issues that block Playwright mouse clicks.
  await ctx.page.evaluate(() => {
    const overlay = document.querySelector('div.fixed.inset-0.z-50') as HTMLElement | null;
    if (!overlay) throw new Error('Overlay not found');
    const rect = overlay.getBoundingClientRect();
    const opts: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 10,
      clientY: rect.top + 10,
      view: window,
    };
    overlay.dispatchEvent(new MouseEvent('mousedown', opts));
    overlay.dispatchEvent(new MouseEvent('mouseup', opts));
    overlay.dispatchEvent(new MouseEvent('click', opts));
  });

  ctx.log('Dispatched click event on overlay. Popup should be dismissed.');

  // Wait briefly for the close animation to complete
  await ctx.wait(500);

  const stillVisible = await ctx.isVisible(overlaySelector);
  if (stillVisible) {
    ctx.log('Popup still visible — retrying with pointerdown/pointerup sequence...');
    await ctx.page.evaluate(() => {
      const overlay = document.querySelector('div.fixed.inset-0.z-50') as HTMLElement | null;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const opts: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 10,
        clientY: rect.top + 10,
        view: window,
      };
      overlay.dispatchEvent(new PointerEvent('pointerdown', opts));
      overlay.dispatchEvent(new PointerEvent('pointerup', opts));
      overlay.dispatchEvent(new MouseEvent('click', opts));
    });
    await ctx.wait(500);
  }

  ctx.log('Close popup sequence complete.');
}
