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
  // Handles two UI patterns:
  //   1. <input type="time"> — e.g. "09:00 AM"  (value read via getInputValue / getAttribute)
  //   2. <button> time-range slot — e.g. "09:00 – 09:30" (text read via getText / textContent)
  //
  // ctx.args[0] = "timeSlot" (from $[timeSlot]) — runtime variable name
  // ctx.locator  — the linked element (XPath / CSS string or Playwright Locator)
  const c = ctx as any;
  const outputVar = c.args[0] as string;
  const locator = c.locator;

  let text = '';

  if (typeof locator === 'string') {
    // Wait for element to be visible
    try { await c.waitForVisible(locator, { timeout: 5000 }); } catch (_) {}

    // 1. Try input value first (covers <input type="time"> — "09:00 AM")
    try { text = (await c.getInputValue(locator) ?? '').trim(); } catch (_) {}

    // 2. Try visible text (covers <button> time-range slots — "09:00 – 09:30")
    if (!text) {
      try { text = (await c.getText(locator) ?? '').trim(); } catch (_) {}
    }

    // 3. DOM fallback — handles both via textContent / value attribute
    if (!text) {
      try {
        text = (await c.page.evaluate((sel: string) => {
          let el: HTMLElement | null = null;
          // Try XPath first
          try {
            const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            el = result.singleNodeValue as HTMLElement | null;
          } catch (_) {}
          // Fallback to CSS selector
          if (!el) el = document.querySelector(sel);
          if (!el) return '';
          // For input elements, read value attribute
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
            return el.value.trim();
          }
          return (el.textContent ?? '').trim();
        }, locator) ?? '').trim();
      } catch (_) {}
    }

  } else if (locator) {
    // Playwright Locator object
    try { await locator.waitFor({ state: 'visible', timeout: 5000 }); } catch (_) {}

    // 1. Try input value (covers <input type="time">)
    try { text = (await locator.inputValue() ?? '').trim(); } catch (_) {}

    // 2. Try innerText (covers <button> time-range slots)
    if (!text) {
      try { text = (await locator.innerText() ?? '').trim(); } catch (_) {}
    }

    // 3. Try textContent
    if (!text) {
      try { text = (await locator.textContent() ?? '').trim(); } catch (_) {}
    }

    // 4. DOM evaluate fallback
    if (!text) {
      try {
        text = (await locator.evaluate((el: HTMLElement) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
            return el.value.trim();
          }
          return (el.textContent ?? '').trim();
        }) ?? '').trim();
      } catch (_) {}
    }
  }

  if (!text) {
    throw new Error('Time slot text is empty — ensure the element is visible and contains text.');
  }

  c.log(`Captured time slot: "${text}"`);
  c.setVariable(outputVar, text);
}
