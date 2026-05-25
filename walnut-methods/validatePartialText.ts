import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Validate Partial Text
 * description: Validate element ${xpath} contains partial text ${text}
 * actionType: custom_validate_partial_text
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function validatePartialText(ctx: WalnutContext) {
  const c = ctx as any;
  // ctx.args[0] = value of ${xpath} — XPath selector passed as runtime parameter
  // ctx.args[1] = value of ${text} — the partial text to look for inside the element
  const xpath: string | undefined = c.args?.[0];
  const expectedText: string | undefined = c.args?.[1];

  if (!xpath) {
    throw new Error('XPath argument is missing — pass the element XPath as the first parameter');
  }

  if (expectedText == null || expectedText === '') {
    throw new Error('Expected text argument is missing or empty');
  }

  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  async function resolveText(): Promise<string> {
    const candidates = [
      () => c.getText(xpath),
      () => c.getInputValue(xpath),
    ];
    for (const fn of candidates) {
      try {
        const val = await fn();
        if (val) return normalize(val);
      } catch (_) {}
    }
    return '';
  }

  const actualText = await resolveText();
  const normalizedExpected = normalize(expectedText);

  c.log(`XPath: "${xpath}"`);
  c.log(`Element text: "${actualText}"`);
  c.log(`Checking for partial text: "${normalizedExpected}"`);

  if (!actualText.includes(normalizedExpected)) {
    throw new Error(`Expected element to contain "${normalizedExpected}" but got "${actualText}"`);
  }

  c.log(`Validation passed: element contains "${normalizedExpected}"`);
}
