import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot
 * description: Click the first available time slot and store in $[selectedSlot]
 * actionType: custom_click_available_time_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlot(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — runtime variable name to store the clicked slot text
  //
  // DOM structure (from inspection):
  //   <div class="grid grid-cols-3 gap-2">
  //     <div class="relative">
  //       <!-- BOOKED slot — has `disabled` attribute + cursor-not-allowed class -->
  //       <button disabled class="... bg-gray-100 text-gray-300 cursor-not-allowed">12:00 – 12:30</button>
  //     </div>
  //     <div class="relative">
  //       <!-- AVAILABLE slot — no `disabled`, has cursor-pointer class -->
  //       <button class="... bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">12:30 – 13:00</button>
  //     </div>
  //   </div>
  //
  // XPath used: //div[contains(@class,'grid-cols-3')]//button[not(@disabled)]
  // This directly targets only non-disabled (available) buttons — first match is clicked.

  const c = ctx as any;
  const outputVar = ctx.args[0]; // from $[selectedSlot]

  // XPath that selects only available (non-disabled) time slot buttons
  const xpath = `//div[contains(@class,'grid-cols-3')]//button[not(@disabled)]`;

  ctx.log(`Searching for available time slots using XPath: ${xpath}`);

  // Find the first available slot text via DOM
  const result: { text: string } | null = await c.page.evaluate((xp: string) => {
    const xpathResult = document.evaluate(
      xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    const el = xpathResult.singleNodeValue as HTMLElement | null;
    if (!el) return null;
    const text = (el.textContent ?? '').trim();
    return text ? { text } : null;
  }, xpath);

  if (!result) {
    throw new Error('No available time slots found — all slots may be booked or the page structure has changed.');
  }

  ctx.log(`Found available slot: "${result.text}" — clicking...`);

  // Click using Playwright's xpath locator — first() picks the first available slot
  await c.page.locator(`xpath=${xpath}`).first().click();

  ctx.log(`Clicked time slot: "${result.text}"`);

  if (outputVar) {
    ctx.setVariable(outputVar, result.text);
    ctx.log(`Stored as variable "${outputVar}": "${result.text}"`);
  }
}
