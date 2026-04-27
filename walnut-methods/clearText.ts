import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Clear Text
 * description: Clear text from input field
 * actionType: custom_clear_text
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function clearText(ctx: WalnutContext) {
  // Focus the element, select all content and delete it
  // Works for both empty fields and fields pre-filled with any text or runtime variable value
  await ctx.click(ctx.locator);
  await ctx.evaluate(`
    const el = document.activeElement;
    if (el) {
      el.select?.();
      document.execCommand('selectAll');
      document.execCommand('delete');
    }
  `);

  // Fallback: triple-click to select all then clear
  await ctx.clear(ctx.locator);

  ctx.log('Cleared text from element: "' + ctx.locator + '"');
}
