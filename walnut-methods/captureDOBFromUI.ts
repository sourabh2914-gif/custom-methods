import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture DOB From UI
 * description: Capture DOB from linked date input and store in $[dob]
 * actionType: custom_capture_dob_from_ui
 * context: web
 * needsLocator: true
 * category: Forms
 */
export async function captureDOBFromUI(ctx: WalnutContext) {
  // ctx.locator — XPath from the step-linked DOB input object
  // ctx.args[0] = "dob" (from $[dob]) — runtime variable name to store the value into

  const outputVar = ctx.args[0];

  // DOB input stores its value as an HTML attribute: value="2026-04-21"
  const dob = await ctx.getAttribute(ctx.locator, 'value');

  if (!dob) {
    throw new Error('DOB value is empty — ensure the date input has a selected value before this step.');
  }

  ctx.log(`Captured DOB: "${dob}"`);
  ctx.setVariable(outputVar, dob);
}
