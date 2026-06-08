import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Dropdown Value
 * description: Capture dropdown value from linked object and store in $[dropdownValue]
 * actionType: custom_capture_dropdown_value
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function captureDropdownValue(ctx: WalnutContext) {
  const c = ctx as any;
  const outputVar = c.args[0];
  const locator = c.locator;

  c.log(`Locator type: "${typeof locator}"`);

  let value: string = '';

  if (typeof locator === 'string') {
    // String XPath/CSS selector
    // Try getText first (works for button/div/span), fall back to getInputValue
    try {
      value = (await c.getText(locator)).trim();
      c.log(`String locator getText result: "${value}"`);
    } catch (_) {}

    if (!value) {
      try {
        value = (await c.getInputValue(locator)).trim();
        c.log(`String locator getInputValue result: "${value}"`);
      } catch (_) {}
    }
  } else {
    // Playwright Locator object (button, div, span, input)
    // Strategy 1: textContent() — works for <button>, <div>, <span> containing text e.g. "Male"
    try {
      value = (await locator.textContent() ?? '').trim();
      c.log(`Playwright textContent result: "${value}"`);
    } catch (_) {}

    // Strategy 2: inputValue() — works for <input>, <select> based dropdowns
    if (!value) {
      try {
        value = (await locator.inputValue()).trim();
        c.log(`Playwright inputValue result: "${value}"`);
      } catch (_) {}
    }

    // Strategy 3: innerText() — works for elements where textContent includes hidden whitespace
    if (!value) {
      try {
        value = (await locator.innerText()).trim();
        c.log(`Playwright innerText result: "${value}"`);
      } catch (_) {}
    }
  }

  if (!value) {
    throw new Error('Dropdown value is empty — ensure the dropdown has a selected value before this step.');
  }

  // Strip UI symbols (×, ✕, ✗, ×, close-button chars) that appear in multi-select tag chips.
  // Keep only printable word characters, spaces, parentheses, hyphens, commas, dots, and slashes.
  const cleaned = value
    .replace(/[^\w\s().,'\-\/]/g, '')  // remove symbols like × ✕ ✗ etc.
    .replace(/\s+/g, ' ')              // collapse multiple spaces
    .trim();

  c.log(`Captured dropdown value (raw):     "${value}"`);
  c.log(`Captured dropdown value (cleaned): "${cleaned}"`);
  c.setVariable(outputVar, cleaned);
}
