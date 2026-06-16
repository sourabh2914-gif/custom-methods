import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Element Not Present
 * description: Verify the linked element is not present on the page ${elementName}
 * actionType: custom_verify_element_not_present
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function verifyElementNotPresent(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // args[0] is the element name/text passed via ${elementName}
  const elementName = ctx.args?.[0];

  let count = 0;
  try {
    if (elementName) {
      // Try as a CSS/XPath selector first, then fall back to visible text
      count = await c.count(elementName).catch(async () => {
        const page = c.page;
        return await page.getByText(elementName, { exact: false }).count();
      });
    }
  } catch (_) {
    // Element not in DOM at all — count stays 0
  }

  if (count === 0) {
    c.log(`Element "${elementName}" is not present on the page — step passed`);
    return;
  }

  // Element exists — check if it is visible
  let visible = false;
  try {
    if (elementName) {
      visible = await c.isVisible(elementName).catch(async () => {
        const page = c.page;
        return await page.getByText(elementName, { exact: false }).isVisible();
      });
    }
  } catch (_) {
    visible = false;
  }

  if (!visible) {
    c.log(`Element "${elementName}" exists in DOM but is not visible — step passed`);
    return;
  }

  throw new Error(`Element "${elementName}" is present and visible on the page — expected it to be absent`);
}
