import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture DOB From UI
 * description: Capture DOB from linked date input and store in $[dob]
 * actionType: custom_capture_dob_from_ui
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function captureDobFromUi(ctx: WalnutContext) {
  const c = ctx as any;
  const outputVar = c.args[0];
  const locator = c.locator;

  c.log(`Locator type: "${typeof locator}"`);

  let dob: string | null = null;

  if (typeof locator === 'string') {
    // locator is a string XPath/CSS selector — use built-in getAttribute
    dob = await c.getAttribute(locator, 'value');
    c.log(`String locator getAttribute result: "${dob}"`);
  } else {
    // locator is a Playwright Locator object — call getAttribute directly on it
    dob = await locator.getAttribute('value');
    c.log(`Playwright locator getAttribute result: "${dob}"`);
  }

  if (!dob) {
    throw new Error('DOB value is empty — ensure the date input has a value before this step.');
  }

  c.log(`Captured DOB (ISO): "${dob}"`);
  c.setVariable(outputVar, dob);
}
