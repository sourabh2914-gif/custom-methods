import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot
 * description: Click the first available time slot and store in $[selectedSlot], store first morning slot in $[firstSlot] and last evening/afternoon slot in $[lastSlot]
 * actionType: custom_click_available_time_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlot(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — clicked slot runtime variable name
  // ctx.args[1] = "firstSlot"    (from $[firstSlot])    — first morning slot (faded or unfaded)
  // ctx.args[2] = "lastSlot"     (from $[lastSlot])     — last evening slot (fallback: last afternoon slot)
  //
  // Supports three DOM variants:
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
  // Variant B — slots in individual relative divs, no grid-cols-3 wrapper:
  //   <div class="relative">
  //     <button class="w-full py-2 px-1 ... bg-gray-100 text-gray-600 ... cursor-pointer">
  //       09:30 AM – 10:00 AM
  //     </button>
  //   </div>
  //   Section tabs: <button class="flex-1 flex items-center ..."><img ...>"Evening"</button>
  //
  // Variant C — grid-cols-2 wrapper, 24-hour time format, bg-white for available slots:
  //   <div class="bg-[#F5F5F5] grid grid-cols-2 gap-2 p-3" style="position: relative; z-index: 1;">
  //     <button class="relative py-1.5 px-1 text-[11px] font-medium rounded-full ... bg-white text-[#555] hover:bg-gray-50">
  //       12:00 – 12:30
  //     </button>
  //   </div>
  //   Section tabs: <button class="flex-1 flex items-center justify-center gap-1.5 py-2.5 ...">
  //     <span class="relative z-10">Afternoon</span>
  //     <span class="relative z-10 text-[9px] bg-[#3279AD] text-white rounded-full px-1.5">10</span>
  //   </button>
  //
  // Available (clickable) slot = button NOT disabled, NOT cursor-not-allowed
  //                              has cursor-pointer (A/B) OR bg-white/hover:bg-gray-50 (C)
  // Faded/disabled slot        = button has @disabled attribute (captured for firstSlot/lastSlot)
  // Time format: 12-hour "09:30 AM – 10:00 AM" (A/B) or 24-hour "12:00 – 12:30" (C)
  //
  // Logic:
  //   1. Try Morning  → click tab if not active → find first non-disabled future slot → click it
  //   2. No slots in Morning → try Afternoon
  //   3. No slots in Afternoon → try Evening
  //   4. Throw if no clickable slot found in any section
  //
  // firstSlot / lastSlot capture (independent of click logic):
  //   - firstSlot = first slot in Morning (faded or unfaded), NO time filter — always the very
  //                 first morning slot regardless of whether the morning has passed
  //   - lastSlot  = last future slot in Evening (faded or unfaded);
  //                 if Evening has no slots, use last future slot in Afternoon

  const c = ctx as any;
  const outputVar  = ctx.args[0]; // from $[selectedSlot]
  const firstSlotVar = ctx.args[1]; // from $[firstSlot]
  const lastSlotVar  = ctx.args[2]; // from $[lastSlot]

  const sections = ['Morning', 'Afternoon', 'Evening'];

  // Tab XPath — supports all DOM variants:
  //   Variant A: <button><span>Morning</span></button>
  //   Variant B: <button><img alt="Morning" ...>"Morning"</button>  (text node, no span)
  //   Variant C: <button ...><span class="relative z-10">Afternoon</span><span ...>10</span></button>
  const findTabXpath = (label: string) =>
    `//button[` +
      `.//span[normalize-space(text())='${label}']` +
      ` or (contains(normalize-space(.),'${label}') and not(.//span))` +
    `]`;

  // XPath for clickable (non-disabled) slots only — used for the click action
  // Variant C slots: bg-white (available), no disabled attr, no cursor-not-allowed
  //   <button class="relative py-1.5 px-1 ... bg-white text-[#555] hover:bg-gray-50">12:00 – 12:30</button>
  const availableSlotXpath =
    `//button[` +
      `not(@disabled)` +
      ` and not(contains(@class,'cursor-not-allowed'))` +
      ` and (contains(@class,'cursor-pointer') or contains(@class,'bg-white') or contains(@class,'hover:bg-gray-50'))` +
      ` and contains(normalize-space(text()),':')` +   // time slots contain ":" e.g. "10:00 AM" or "12:00"
      ` and not(contains(@class,'flex-1'))` +          // exclude section tab buttons
    `]`;

  // XPath for ALL slots (faded/disabled included) — used for firstSlot/lastSlot capture
  const allSlotsXpath =
    `//button[` +
      `contains(normalize-space(text()),':')` +        // time slots contain ":" e.g. "10:00 AM" or "12:00"
      ` and not(contains(@class,'flex-1'))` +          // exclude section tab buttons
      ` and (contains(@class,'cursor-pointer') or contains(@class,'cursor-not-allowed') or @disabled` +
      ` or contains(@class,'bg-white') or contains(@class,'bg-gray-50') or contains(@class,'rounded-full'))` +
    `]`;

  // Current system time in minutes-since-midnight (used to skip past slots)
  const nowMinutes = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();
  ctx.log(`Current system time: ${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')} (${nowMinutes} min since midnight)`);

  /**
   * Parse a slot's start time from its label and return minutes-since-midnight, or null if unparseable.
   * Supports:
   *   - 12-hour format: "09:30 AM – 10:00 AM"  (Variant A / B)
   *   - 24-hour format: "12:00 – 12:30"         (Variant C)
   */
  function parseSlotStartMinutes(slotText: string): number | null {
    // Try 12-hour format first: "09:30 AM" from "09:30 AM – 10:00 AM"
    const match12 = slotText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'AM') {
        if (hours === 12) hours = 0;          // 12:xx AM → 0:xx
      } else {
        if (hours !== 12) hours += 12;        // 1:xx PM → 13:xx, but 12:xx PM stays 12
      }
      return hours * 60 + minutes;
    }
    // Try 24-hour format: "12:00" from "12:00 – 12:30" (Variant C)
    const match24 = slotText.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 60 + minutes;
      }
    }
    return null;
  }

  /**
   * Activate a section tab and collect ALL slots (faded + unfaded) with NO time filter.
   * Used exclusively for Morning firstSlot capture — even if morning has already passed.
   */
  async function collectAllSlotsInSection(section: string): Promise<string[]> {
    const tabXpath = findTabXpath(section);

    const tabState: { exists: boolean; isDisabled: boolean; isActive: boolean } =
      await c.page.evaluate((xp: string) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLElement | null;
        if (!el) return { exists: false, isDisabled: false, isActive: false };
        const isDisabled = el.hasAttribute('disabled');
        const classes = el.className || '';
        const isActive =
          classes.includes('font-bold') ||
          classes.includes('border-b') ||
          (classes.includes('text-gray-900') && !classes.includes('text-gray-400')) ||
          // Variant B/C: flex-1 tab is active only if NOT muted (text-gray-400 or text-[#aaa])
          (classes.includes('flex-1') &&
            !classes.includes('text-gray-400') &&
            !classes.includes('text-[#aaa]') &&
            !classes.includes('[#aaa]'));
        return { exists: true, isDisabled, isActive };
      }, tabXpath);

    if (!tabState.exists || tabState.isDisabled) return [];

    if (!tabState.isActive) {
      await c.page.locator(`xpath=${tabXpath}`).first().click();
      await c.wait(600);
    }

    const rawSlots: string[] = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const texts: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const text = (el.textContent ?? '').trim();
        if (text) texts.push(text);
      }
      return texts;
    }, allSlotsXpath);

    // No time filter — return all slots as-is
    return rawSlots;
  }

  /**
   * Activate a section tab and collect all future slots (faded + unfaded) visible in that section.
   * Returns the list of slot texts (in DOM order), or empty array if tab not found / disabled.
   */
  async function collectAllFutureSlotsInSection(section: string): Promise<string[]> {
    const tabXpath = findTabXpath(section);

    const tabState: { exists: boolean; isDisabled: boolean; isActive: boolean } =
      await c.page.evaluate((xp: string) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLElement | null;
        if (!el) return { exists: false, isDisabled: false, isActive: false };
        const isDisabled = el.hasAttribute('disabled');
        const classes = el.className || '';
        const isActive =
          classes.includes('font-bold') ||
          classes.includes('border-b') ||
          (classes.includes('text-gray-900') && !classes.includes('text-gray-400')) ||
          // Variant B/C: flex-1 tab is active only if NOT muted (text-gray-400 or text-[#aaa])
          (classes.includes('flex-1') &&
            !classes.includes('text-gray-400') &&
            !classes.includes('text-[#aaa]') &&
            !classes.includes('[#aaa]'));
        return { exists: true, isDisabled, isActive };
      }, tabXpath);

    if (!tabState.exists || tabState.isDisabled) return [];

    if (!tabState.isActive) {
      await c.page.locator(`xpath=${tabXpath}`).first().click();
      await c.wait(600);
    }

    const rawSlots: string[] = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const texts: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const text = (el.textContent ?? '').trim();
        if (text) texts.push(text);
      }
      return texts;
    }, allSlotsXpath);

    // Keep only future slots (start time > now)
    return rawSlots.filter(text => {
      const startMin = parseSlotStartMinutes(text);
      if (startMin === null) return false;
      return startMin > nowMinutes;
    });
  }

  // ── Phase 1: Capture firstSlot (Morning) and lastSlot (Evening, fallback Afternoon) ──────────

  ctx.log('Phase 1: Collecting first/last slots across sections...');

  // firstSlot uses NO time filter — switch to Morning tab and grab the very first slot
  // even if the morning section has already passed (e.g. it's now afternoon)
  const morningSlotsRaw = await collectAllSlotsInSection('Morning');
  ctx.log(`Morning slots (no time filter): ${morningSlotsRaw.length}`);

  const afternoonSlotsAll = await collectAllFutureSlotsInSection('Afternoon');
  ctx.log(`Afternoon future slots (all): ${afternoonSlotsAll.length}`);

  const eveningSlotsAll = await collectAllFutureSlotsInSection('Evening');
  ctx.log(`Evening future slots (all): ${eveningSlotsAll.length}`);

  // firstSlot = first slot in Morning (faded or unfaded), no time filter
  const firstSlotText = morningSlotsRaw.length > 0 ? morningSlotsRaw[0] : null;

  // lastSlot = last future slot in Evening; if none, fallback to last in Afternoon
  const lastSlotText =
    eveningSlotsAll.length > 0
      ? eveningSlotsAll[eveningSlotsAll.length - 1]
      : afternoonSlotsAll.length > 0
        ? afternoonSlotsAll[afternoonSlotsAll.length - 1]
        : null;

  if (firstSlotText && firstSlotVar) {
    ctx.setVariable(firstSlotVar, firstSlotText);
    ctx.log(`Stored first morning slot "${firstSlotText}" → $[${firstSlotVar}]`);
  } else if (!firstSlotText) {
    ctx.log('No future morning slots found — $[firstSlot] not set');
  }

  if (lastSlotText && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlotText);
    ctx.log(`Stored last slot "${lastSlotText}" → $[${lastSlotVar}]`);
  } else if (!lastSlotText) {
    ctx.log('No future afternoon/evening slots found — $[lastSlot] not set');
  }

  // ── Phase 2: Click logic — first future non-disabled slot (Morning → Afternoon → Evening) ────

  ctx.log('Phase 2: Clicking first available (non-disabled) future slot...');

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

        // Active tab signals across all variants:
        //   Variant A: font-bold (active) vs font-normal (inactive)
        //   Variant B: border-b, text-gray-900, or absence of text-gray-400 (muted = inactive)
        //   Variant C: flex-1 tabs — active = no muted color (text-[#aaa]), inactive = text-[#aaa]
        const isActive =
          classes.includes('font-bold') ||
          classes.includes('border-b') ||
          (classes.includes('text-gray-900') && !classes.includes('text-gray-400')) ||
          // Variant B/C: flex-1 tab is active only if NOT muted (text-gray-400 or text-[#aaa])
          (classes.includes('flex-1') &&
            !classes.includes('text-gray-400') &&
            !classes.includes('text-[#aaa]') &&
            !classes.includes('[#aaa]'));

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

    // Collect ALL available (non-disabled) slots in this section
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
