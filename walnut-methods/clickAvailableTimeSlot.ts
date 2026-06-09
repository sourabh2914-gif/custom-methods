import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot
 * description: Click the first available (unfaded) time slot from ${slotsSelector} and store in $[selectedSlot]
 * actionType: custom_click_available_time_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlot(ctx: WalnutContext) {
  // ctx.args[0] = value of ${slotsSelector} — CSS/XPath selector that matches ALL time slot elements
  // ctx.args[1] = "selectedSlot" (from $[selectedSlot]) — runtime variable name to store the clicked slot text
  //
  // Faded/booked slots are detected by reduced opacity or a specific CSS class (e.g. opacity-50, disabled, faded).
  // The method iterates all matching slots, skips faded ones, clicks the first available slot,
  // and stores its text in the runtime variable.

  const c = ctx as any;
  const selector = ctx.args[0];
  const outputVar = ctx.args[1];

  ctx.log(`Looking for available time slots using selector: "${selector}"`);

  // Find the first unfaded/available slot via DOM inspection
  const result: { index: number; text: string } | null = await c.page.evaluate((sel: string) => {
    let elements: HTMLElement[] = [];

    // Try XPath
    try {
      const xpathResult = document.evaluate(sel, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        elements.push(xpathResult.snapshotItem(i) as HTMLElement);
      }
    } catch (_) {}

    // Fallback to CSS selector
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll(sel));
    }

    if (elements.length === 0) return null;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const style = window.getComputedStyle(el);
      const opacity = parseFloat(style.opacity ?? '1');
      const classList = Array.from(el.classList);

      // Skip faded/booked slots — detect by:
      //   1. Computed opacity < 0.6
      //   2. Common faded/disabled CSS classes
      //   3. disabled attribute
      const isFaded =
        opacity < 0.6 ||
        el.hasAttribute('disabled') ||
        classList.some(c =>
          c.includes('opacity') ||
          c.includes('faded') ||
          c.includes('disabled') ||
          c.includes('booked') ||
          c.includes('unavailable') ||
          c.includes('cursor-not-allowed')
        );

      if (!isFaded) {
        const text = (el.textContent ?? '').trim();
        if (text) return { index: i, text };
      }
    }

    return null;
  }, selector);

  if (!result) {
    throw new Error(`No available (unfaded) time slots found for selector: "${selector}"`);
  }

  ctx.log(`Found available slot at index ${result.index}: "${result.text}" — clicking...`);

  // Click the slot using nth-match for CSS, or re-evaluate for XPath
  try {
    // Try CSS nth approach first
    await c.page.locator(selector).nth(result.index).click();
  } catch (_) {
    // Fallback: click via XPath index evaluation
    await c.page.evaluate((args: { sel: string; idx: number }) => {
      let elements: HTMLElement[] = [];
      try {
        const xr = document.evaluate(args.sel, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < xr.snapshotLength; i++) elements.push(xr.snapshotItem(i) as HTMLElement);
      } catch (_) {}
      if (elements.length === 0) elements = Array.from(document.querySelectorAll(args.sel));
      if (elements[args.idx]) (elements[args.idx] as HTMLElement).click();
    }, { sel: selector, idx: result.index });
  }

  ctx.log(`Clicked time slot: "${result.text}"`);

  if (outputVar) {
    ctx.setVariable(outputVar, result.text);
    ctx.log(`Stored selected slot as variable "${outputVar}": "${result.text}"`);
  }
}
