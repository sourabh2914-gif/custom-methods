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
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — runtime variable name
  //
  // DOM structure:
  //   Section tabs (Morning / Afternoon / Evening):
  //     <button class="... font-bold text-gray-900">          ← currently active
  //     <button class="... font-normal text-gray-400 cursor-pointer"> ← inactive, clickable
  //     <button disabled class="... text-gray-300 cursor-not-allowed"> ← no slots, disabled
  //
  //   Time slot buttons (inside the active section):
  //     <button disabled class="... text-gray-300 cursor-not-allowed">12:00 – 12:30</button>  ← booked
  //     <button class="... text-gray-600 cursor-pointer">12:30 – 13:00</button>               ← available
  //
  // Logic:
  //   1. Try Morning  → click section tab if not active → find first non-disabled slot → click it
  //   2. If no available slots in Morning → try Afternoon tab (if not disabled)
  //   3. If no available slots in Afternoon → try Evening tab (if not disabled)
  //   4. Throw if no available slot found in any section

  const c = ctx as any;
  const outputVar = ctx.args[0]; // from $[selectedSlot]

  // XPath for section tab buttons (Morning, Afternoon, Evening)
  const sectionTabXpath = (label: string) =>
    `//button[.//span[normalize-space(text())='${label}']]`;

  // XPath for available (non-disabled) time slot buttons inside the currently visible slot grid
  const availableSlotXpath =
    `//div[contains(@class,'grid-cols-3')]//button[not(@disabled) and normalize-space(text())!='']`;

  const sections = ['Morning', 'Afternoon', 'Evening'];

  for (const section of sections) {
    ctx.log(`Checking section: ${section}`);

    const tabXpath = sectionTabXpath(section);

    // Check if this section tab exists and is not disabled
    const tabState: { exists: boolean; isDisabled: boolean; isActive: boolean } =
      await c.page.evaluate((xp: string) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLElement | null;
        if (!el) return { exists: false, isDisabled: false, isActive: false };
        const isDisabled = el.hasAttribute('disabled');
        const classes = el.className || '';
        // Active tab has font-bold; inactive has font-normal
        const isActive = classes.includes('font-bold');
        return { exists: true, isDisabled, isActive };
      }, tabXpath);

    if (!tabState.exists) {
      ctx.log(`Section "${section}" tab not found — skipping`);
      continue;
    }

    if (tabState.isDisabled) {
      ctx.log(`Section "${section}" is disabled (no slots available) — skipping`);
      continue;
    }

    // Click the section tab to activate it (only if it's not already active)
    if (!tabState.isActive) {
      ctx.log(`Clicking "${section}" tab to activate it...`);
      await c.page.locator(`xpath=${tabXpath}`).first().click();
      // Wait briefly for the slot grid to update
      await c.wait(500);
    } else {
      ctx.log(`Section "${section}" is already active`);
    }

    // Check for available (non-disabled) slots in this section
    const slotResult: { text: string } | null = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const el = result.singleNodeValue as HTMLElement | null;
      if (!el) return null;
      const text = (el.textContent ?? '').trim();
      return text ? { text } : null;
    }, availableSlotXpath);

    if (!slotResult) {
      ctx.log(`No available slots in "${section}" — moving to next section`);
      continue;
    }

    // Found an available slot — click it
    ctx.log(`Found available slot in "${section}": "${slotResult.text}" — clicking...`);
    await c.page.locator(`xpath=${availableSlotXpath}`).first().click();

    ctx.log(`Clicked time slot: "${slotResult.text}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotResult.text);
      ctx.log(`Stored as variable "${outputVar}": "${slotResult.text}"`);
    }

    return; // Done — exit after clicking the first available slot
  }

  // All sections exhausted
  throw new Error('No available time slots found in Morning, Afternoon, or Evening — all slots are booked.');
}
