import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Time Slot
 * description: Capture time slot text and store in $[timeSlot]
 * actionType: custom_capture_time_slot
 * context: web
 * needsLocator: true
 * category: Query
 */
export async function captureTimeSlots(ctx: WalnutContext) {
  // ctx.args[0] = "timeSlot" (from $[timeSlot]) — runtime variable name to store the captured slot text
  // ctx.locator  — the linked time-slot element (XPath / CSS / Playwright Locator)
  const c = ctx as any;
  const outputVar = c.args[0] as string;
  const locator = c.locator;

  let text = '';

  if (typeof locator === 'string') {
    try { text = (await c.getText(locator) ?? '').trim(); } catch (_) {}
    if (!text) {
      try { text = (await c.getInputValue(locator) ?? '').trim(); } catch (_) {}
    }
  } else {
    // Playwright Locator object
    try { text = (await locator.innerText() ?? '').trim(); } catch (_) {}
    if (!text) {
      try { text = (await locator.textContent() ?? '').trim(); } catch (_) {}
    }
    if (!text) {
      try { text = (await locator.inputValue() ?? '').trim(); } catch (_) {}
    }
  }

  if (!text) {
    throw new Error('Time slot text is empty — ensure the element is visible and contains text.');
  }

  c.log(`Captured time slot: "${text}"`);
  c.setVariable(outputVar, text);
}
