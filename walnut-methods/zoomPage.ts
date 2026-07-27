import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Zoom Page
 * description: Zoom the page ${direction} by ${percentage} percent
 * actionType: custom_zoom_page
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function zoomPage(ctx: WalnutContext) {
  const webCtx = ctx as WalnutWebContext;
  // ctx.args[0] = direction ("in" or "out")
  // ctx.args[1] = percentage (e.g. "150" for 150%, "75" for 75%)
  const direction = ctx.args[0]?.toLowerCase();
  const percentage = parseFloat(ctx.args[1]);

  let zoomLevel: number;

  if (!isNaN(percentage)) {
    zoomLevel = percentage / 100;
  } else if (direction === 'in') {
    zoomLevel = 1.5;
  } else {
    zoomLevel = 0.75;
  }

  // Get current viewport size, then scale it inversely so content fills the screen
  const currentSize = webCtx.page.viewportSize() ?? { width: 1280, height: 720 };
  const newWidth = Math.round(currentSize.width / zoomLevel);
  const newHeight = Math.round(currentSize.height / zoomLevel);
  await webCtx.page.setViewportSize({ width: newWidth, height: newHeight });
  ctx.log(`Zoomed ${direction} to ${zoomLevel * 100}% (viewport: ${newWidth}x${newHeight})`);
}
