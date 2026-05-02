import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Date From UI
 * description: Capture date from linked date input and store in $[dateValue]
 * actionType: custom_capture_date_from_ui
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function captureDateFromUi(ctx: WalnutContext) {
  const c = ctx as any;
  const outputVar = c.args[0];
  const locator = c.locator;

  c.log(`Locator type: "${typeof locator}"`);

  let dateValue: string = '';

  if (typeof locator === 'string') {
    // Strategy 1: getAttribute("value") — works for <input type="date">
    try {
      dateValue = (await c.getAttribute(locator, 'value') ?? '').trim();
      c.log(`String locator getAttribute result: "${dateValue}"`);
    } catch (_) {}

    // Strategy 2: getInputValue() — works for readonly text inputs showing date
    if (!dateValue) {
      try {
        dateValue = (await c.getInputValue(locator)).trim();
        c.log(`String locator getInputValue result: "${dateValue}"`);
      } catch (_) {}
    }

    // Strategy 3: getText() — works for div/span displaying a date
    if (!dateValue) {
      try {
        dateValue = (await c.getText(locator)).trim();
        c.log(`String locator getText result: "${dateValue}"`);
      } catch (_) {}
    }
  } else {
    // Playwright Locator object
    // Strategy 1: getAttribute("value") — <input type="date"> stores ISO value
    try {
      dateValue = (await locator.getAttribute('value') ?? '').trim();
      c.log(`Playwright getAttribute result: "${dateValue}"`);
    } catch (_) {}

    // Strategy 2: inputValue() — readonly text input
    if (!dateValue) {
      try {
        dateValue = (await locator.inputValue()).trim();
        c.log(`Playwright inputValue result: "${dateValue}"`);
      } catch (_) {}
    }

    // Strategy 3: textContent() / innerText() — div/span showing date text
    if (!dateValue) {
      try {
        dateValue = (await locator.textContent() ?? '').trim();
        c.log(`Playwright textContent result: "${dateValue}"`);
      } catch (_) {}
    }

    if (!dateValue) {
      try {
        dateValue = (await locator.innerText()).trim();
        c.log(`Playwright innerText result: "${dateValue}"`);
      } catch (_) {}
    }
  }

  if (!dateValue) {
    throw new Error('Date value is empty — ensure the date field has a value before this step.');
  }

  c.log(`Captured date: "${dateValue}"`);
  c.setVariable(outputVar, dateValue);
}
