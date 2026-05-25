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
  const expectedText: string | undefined = c.args?.[0];
  const locator = c.locator;

  if (!locator) {
    throw new Error('No object linked to this step — attach an object in the test case editor');
  }

  if (expectedText == null || expectedText === '') {
    throw new Error('Expected text argument is missing or empty');
  }

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  async function resolveText(): Promise<string> {
    if (typeof locator === 'string') {
      const candidates = [
        () => c.getText(locator),
        () => c.getInputValue(locator),
      ];
      for (const fn of candidates) {
        try {
          const val = await fn();
          if (val) return normalize(val);
        } catch (_) {}
      }
    } else {
      const candidates = [
        () => locator.innerText(),
        () => locator.textContent(),
        () => locator.inputValue(),
      ];
      for (const fn of candidates) {
        try {
          const val = await fn();
          if (val) return normalize(val);
        } catch (_) {}
      }
    }
    return '';
  }

  const actualText = await resolveText();
  const normalizedExpected = normalize(expectedText);

  c.log(`Element text: "${actualText}"`);
  c.log(`Checking for partial text: "${normalizedExpected}"`);

  if (!actualText.includes(normalizedExpected)) {
    throw new Error(`Expected element to contain "${normalizedExpected}" but got "${actualText}"`);
  }

  c.log(`Validation passed: element contains "${normalizedExpected}"`);
}
