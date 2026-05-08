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
  const c = ctx as any;
  // ctx.args[0] = value of ${text} — the partial text to look for inside the element
  const expectedText = c.args[0];
  const locator = c.locator;

  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');

  let actualText = '';

  if (typeof locator === 'string') {
    try { actualText = (await c.getText(locator) ?? '').trim(); } catch (_) {}
    if (!actualText) {
      try { actualText = (await c.getInputValue(locator) ?? '').trim(); } catch (_) {}
    }
  } else {
    try { actualText = (await locator.innerText() ?? '').trim(); } catch (_) {}
    if (!actualText) {
      try { actualText = (await locator.textContent() ?? '').trim(); } catch (_) {}
    }
    if (!actualText) {
      try { actualText = (await locator.inputValue() ?? '').trim(); } catch (_) {}
    }
  }

  c.log(`Element text: "${actualText}"`);
  c.log(`Checking for partial text: "${expectedText}"`);

  if (!actualText.includes(expectedText)) {
    throw new Error(`Expected element to contain "${expectedText}" but got "${actualText}"`);
  }

  c.log(`Validation passed: element contains "${expectedText}"`);
}
