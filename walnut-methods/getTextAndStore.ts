import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Text and Store
 * description: Get text and store in $[result]
 * actionType: custom_get_text_and_store
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function getTextAndStore(ctx: WalnutContext) {
  const c = ctx as any;
  const outputVar = c.args[0];
  const locator = c.locator;

  let text = '';

  if (typeof locator === 'string') {
    // String XPath/CSS selector — ctx.getText() accepts a string
    try { text = (await c.getText(locator) ?? '').trim(); } catch (_) {}
    if (!text) {
      try { text = (await c.getInputValue(locator) ?? '').trim(); } catch (_) {}
    }
  } else {
    // Playwright Locator object — call methods directly on it
    try { text = (await locator.innerText() ?? '').trim(); } catch (_) {}
    if (!text) {
      try { text = (await locator.textContent() ?? '').trim(); } catch (_) {}
    }
    if (!text) {
      try { text = (await locator.inputValue() ?? '').trim(); } catch (_) {}
    }
  }

  c.log(`Got text: "${text}"`);
  c.setVariable(outputVar, text);
}
