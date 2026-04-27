import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Validate Partial Text
 * description: Validate element contains partial text ${text}
 * actionType: custom_validate_partial_text
 * context: web
 * needsLocator: true
 * category: Verification
 */
export async function validatePartialText(ctx: WalnutContext) {
  // ctx.args[0] = value of ${text} — the partial text to look for inside the element
  const expectedText = ctx.args[0];

  const actualText = await ctx.getText(ctx.locator);
  ctx.log(`Element text: "${actualText}"`);
  ctx.log(`Checking for partial text: "${expectedText}"`);

  if (!actualText.includes(expectedText)) {
    throw new Error(`Expected element to contain "${expectedText}" but got "${actualText}"`);
  }

  ctx.log(`Validation passed: element contains "${expectedText}"`);
}
