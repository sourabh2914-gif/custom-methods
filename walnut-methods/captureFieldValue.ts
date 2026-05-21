import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Field Value
 * description: Capture the value from input field and store in $[fieldValue]
 * actionType: custom_capture_field_value
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function captureFieldValue(ctx: WalnutContext) {
  // ctx.args[0] = "fieldValue" (from $[fieldValue]) — runtime variable name to store the captured value
  // ctx.locator  — the element linked to this step (XPath / CSS / Playwright Locator)
  const outputVar = (ctx as any).args[0];
  const locator = (ctx as any).locator;

  let value = '';

  if (typeof locator === 'string') {
    // String XPath/CSS selector
    // 1. Try reading the input's current value (covers <input>, <textarea>, <select>)
    try { value = (await ctx.getInputValue(locator) ?? '').trim(); } catch (_) {}
    // 2. Fall back to the HTML "value" attribute (static default)
    if (!value) {
      try { value = (await ctx.getAttribute(locator, 'value') ?? '').trim(); } catch (_) {}
    }
    // 3. Fall back to inner text (covers read-only display fields / spans)
    if (!value) {
      try { value = (await ctx.getText(locator) ?? '').trim(); } catch (_) {}
    }
  } else {
    // Playwright Locator object
    // 1. inputValue() — works for <input>, <textarea>, <select>
    try { value = (await locator.inputValue() ?? '').trim(); } catch (_) {}
    // 2. getAttribute('value') — static attribute fallback
    if (!value) {
      try { value = (await locator.getAttribute('value') ?? '').trim(); } catch (_) {}
    }
    // 3. innerText / textContent — for display elements
    if (!value) {
      try { value = (await locator.innerText() ?? '').trim(); } catch (_) {}
    }
    if (!value) {
      try { value = (await locator.textContent() ?? '').trim(); } catch (_) {}
    }
  }

  ctx.log(`Captured field value: "${value}"`);
  ctx.setVariable(outputVar, value);
}
