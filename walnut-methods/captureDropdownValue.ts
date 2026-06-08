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
  const c: any = ctx;
  const outputVar: string = c.args[0];
  const locator: any = c.locator;

  let value = '';

  if (typeof locator === 'string') {
    try { value = (await c.getText(locator) ?? '').trim(); } catch (_) {}
    if (!value) {
      try { value = (await c.getInputValue(locator) ?? '').trim(); } catch (_) {}
    }
  } else {
    try { value = (await locator.textContent() ?? '').trim(); } catch (_) {}
    if (!value) {
      try { value = (await locator.inputValue() ?? '').trim(); } catch (_) {}
    }
    if (!value) {
      try { value = (await locator.innerText() ?? '').trim(); } catch (_) {}
    }
  }

  if (!value) {
    throw new Error('Dropdown value is empty. Ensure the dropdown has a selected value before this step.');
  }

  c.log('Captured dropdown value: ' + value);
  c.setVariable(outputVar, value);
}
