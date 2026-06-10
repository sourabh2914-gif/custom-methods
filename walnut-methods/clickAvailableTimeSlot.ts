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
  // Supports two DOM variants:
  //
  // Variant A — slots inside a grid-cols-3 wrapper (old DOM):
  //   <div class="grid grid-cols-3 gap-2 pt-3">
  //     <div class="relative">
  //       <button class="... cursor-not-allowed" disabled>10:30 AM – 11:00 AM</button>   ← booked
  //     </div>
  //     <div class="relative">
  //       <button class="... cursor-pointer">10:00 AM – 10:30 AM</button>                ← available
  //     </div>
  //   </div>
  //   Section tabs: <button class="... font-bold ..."><span>Morning</span></button>
  //
  // Variant B — slots in individual relative divs, no grid-cols-3 wrapper (new DOM):
  //   <div class="relative">
  //     <button class="w-full py-2 px-1 ... bg-gray-100 text-gray-600 ... cursor-pointer">
  //       09:30 AM – 10:00 AM
  //     </button>
  //   </div>
  //   Section tabs: <button class="flex-1 flex items-center ..."><img ...>"Evening"</button>
  //
  // Available slot = button NOT disabled + has cursor-pointer class (both variants)
  // Disabled slot  = button has @disabled attribute
  //
  // Logic:
  //   1. Try Morning  → click tab if not active → find first non-disabled slot → click it
  //   2. No slots in Morning → try Afternoon
  //   3. No slots in Afternoon → try Evening
  //   4. Throw if no slot found in any section

  const c = ctx as any;
  const outputVar = ctx.args[0]; // from $[selectedSlot]

  const sections = ['Morning', 'Afternoon', 'Evening'];

  // Tab XPath — supports both DOM variants:
  //   Variant A: <button><span>Morning</span></button>
  //   Variant B: <button><img alt="Morning" ...>"Morning"</button>  (text node, no span)
  const findTabXpath = (label: string) =>
    `//button[` +
      `.//span[normalize-space(text())='${label}']` +
      ` or (contains(normalize-space(.),'${label}') and not(.//span))` +
    `]`;

  // Available slot XPath — two variants tried in order:
  //   Variant A: slots inside grid-cols-3
  //   Variant B: slots in div.relative that do NOT have grid-cols-3 ancestor
  // Unified: any button that is not disabled, has cursor-pointer, and has time-like text
  // Anchored under the nearest common slot container after tab activation
  const availableSlotXpath =
    `//button[` +
      `not(@disabled)` +
      ` and contains(@class,'cursor-pointer')` +
      ` and contains(normalize-space(text()),':')` +   // time slots contain ":" e.g. "10:00 AM"
    `]`;

  // Current system time in minutes-since-midnight (used to skip past slots)
  const nowMinutes = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();
  ctx.log(`Current system time: ${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')} (${nowMinutes} min since midnight)`);

  /**
   * Parse a slot's start time from its label (e.g. "09:30 AM – 10:00 AM") and
   * return minutes-since-midnight, or null if unparseable.
   */
  function parseSlotStartMinutes(slotText: string): number | null {
    // Match the FIRST time in the label, e.g. "09:30 AM" from "09:30 AM – 10:00 AM"
    const match = slotText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'AM') {
      if (hours === 12) hours = 0;          // 12:xx AM → 0:xx
    } else {
      if (hours !== 12) hours += 12;        // 1:xx PM → 13:xx, but 12:xx PM stays 12
    }
    return hours * 60 + minutes;
  }

  for (const section of sections) {
    ctx.log(`Checking section: ${section}`);

    const tabXpath = findTabXpath(section);

    // Inspect the tab: exists? disabled? active?
    const tabState: { exists: boolean; isDisabled: boolean; isActive: boolean } =
      await c.page.evaluate((xp: string) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLElement | null;
        if (!el) return { exists: false, isDisabled: false, isActive: false };

        const isDisabled = el.hasAttribute('disabled');
        const classes = el.className || '';

        // Active tab signals across both variants:
        //   Variant A: font-bold (active) vs font-normal (inactive)
        //   Variant B: border-b, text-gray-900, or absence of text-gray-400 (muted = inactive)
        const isActive =
          classes.includes('font-bold') ||
          classes.includes('border-b') ||
          (classes.includes('text-gray-900') && !classes.includes('text-gray-400')) ||
          // Variant B fallback: not muted and not a section-tab-level button with text-gray-400
          (!classes.includes('text-gray-400') && classes.includes('flex-1'));

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

    // Activate the tab if not already active
    if (!tabState.isActive) {
      ctx.log(`Clicking "${section}" tab to activate it...`);
      await c.page.locator(`xpath=${tabXpath}`).first().click();
      await c.wait(600);
    } else {
      ctx.log(`Section "${section}" is already active`);
    }

    // Collect ALL available (unfaded) slots in this section
    const allSlots: { text: string; index: number }[] = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const slots: { text: string; index: number }[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const text = (el.textContent ?? '').trim();
        if (text) slots.push({ text, index: i });
      }
      return slots;
    }, availableSlotXpath);

    if (allSlots.length === 0) {
      ctx.log(`No available slots in "${section}" — moving to next section`);
      continue;
    }

    // Filter out slots whose start time has already passed (start time <= current system time)
    const futureSlots = allSlots.filter(slot => {
      const startMin = parseSlotStartMinutes(slot.text);
      if (startMin === null) {
        ctx.log(`Could not parse time from slot text "${slot.text}" — skipping`);
        return false;
      }
      if (startMin <= nowMinutes) {
        ctx.log(`Skipping past/current slot "${slot.text}" (start=${startMin} min, now=${nowMinutes} min)`);
        return false;
      }
      return true;
    });

    if (futureSlots.length === 0) {
      ctx.log(`All available slots in "${section}" are in the past — moving to next section`);
      continue;
    }

    const slotResult = futureSlots[0];

    // Click the slot by its snapshot index (avoids re-querying the DOM)
    ctx.log(`Found future available slot in "${section}": "${slotResult.text}" — clicking...`);

    // Use the XPath with positional index to click the exact slot
    const slotXpathIndexed = `(${availableSlotXpath})[${slotResult.index + 1}]`;
    await c.page.locator(`xpath=${slotXpathIndexed}`).first().click();

    ctx.log(`Clicked time slot: "${slotResult.text}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotResult.text);
      ctx.log(`Stored "${slotResult.text}" → $[${outputVar}]`);
    }

    return; // Done
  }

  throw new Error(
    `No bookable time slots found in Morning, Afternoon, or Evening. ` +
    `Either all slots are booked/disabled or all available slots are in the past ` +
    `(current system time: ${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')}).`
  );
}
