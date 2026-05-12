import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Element Not Present
 * description: Verify the linked element is not present on the page
 * actionType: custom_verify_element_not_present
 * context: web
 * needsLocator: true
 * category: Verification
 */
export async function verifyElementNotPresent(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;
  const locator = c.locator;

  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  let count = 0;
  try {
    count = typeof locator === 'string'
      ? await c.count(locator)
      : await locator.count();
  } catch (_) {
    // Element not in DOM at all — count stays 0
  }

  if (count === 0) {
    c.log('Element is not present on the page — step passed');
    return;
  }

  // Element exists — check if it is visible
  let visible = false;
  try {
    visible = typeof locator === 'string'
      ? await c.isVisible(locator)
      : await locator.isVisible();
  } catch (_) {
    visible = false;
  }

  if (!visible) {
    c.log('Element exists in DOM but is not visible — step passed');
    return;
  }

  throw new Error('Element is present and visible on the page — expected it to be absent');
}
