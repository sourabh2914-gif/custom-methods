import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Clear Text
 * description: Clear text from input field
 * actionType: custom_clear_text
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function clearText(ctx: WalnutContext & { clear: (s: string) => Promise<void> }) {
  await ctx.clear(ctx.args[0]);
  ctx.log('Cleared text from element: "' + ctx.args[0] + '"');
}
