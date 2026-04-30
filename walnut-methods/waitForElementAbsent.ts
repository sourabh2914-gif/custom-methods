import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Wait For Element Absent
 * description: Waits for element ${selector} to be absent from screen with timeout ${exist_timeout} ms
 * actionType: custom_wait_for_element_absent
 * context: web
 * needsLocator: false
 * category: Wait
 */
export async function waitForElementAbsent(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const selector = ctx.args[0];
  const timeout = parseInt(ctx.args[1], 10) || 30000;

  ctx.log(`Waiting for element "${selector}" to be absent (timeout: ${timeout}ms)`);

  await ctx.waitForDetached(selector, { timeout });

  ctx.log(`Element "${selector}" is no longer present on screen`);
}
