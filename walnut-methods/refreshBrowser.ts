import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Refresh Browser
 * description: Refresh the browser page
 * actionType: custom_refresh_browser
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function refreshBrowser(ctx: WalnutContext) {
  await ctx.reload();
}
