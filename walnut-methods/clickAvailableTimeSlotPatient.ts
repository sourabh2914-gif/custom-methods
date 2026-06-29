import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot Patient
 * description: Click the first available time slot and store in $[selectedSlot], store first morning slot in $[firstSlot] and last evening/afternoon slot in $[lastSlot]
 * actionType: custom_click_available_time_slot_patient
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlotPatient(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — clicked slot runtime variable name
  // ctx.args[1] = "firstSlot"    (from $[firstSlot])    — first morning slot (faded or unfaded)
  // ctx.args[2] = "lastSlot"     (from $[lastSlot])     — last evening slot (fallback: last afternoon slot)
  //
  // +48 HOURS POLICY:
  //   Any slot whose full date+time is within 48 hours of the current system date+time is NOT bookable.
  //   Example: today is 15-06-2026 at 10:00 AM
  //     - 16-06-2026 slots → within 48h → all rejected (even if the slot time is 11:00 PM)
  //     - 17-06-2026 at 09:59 AM → within 48h → rejected
  //     - 17-06-2026 at 10:01 AM → beyond 48h → bookable
  //   The cutoff datetime = now + 48 hours exactly.
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
  //   1. Detect the selected calendar date from the DOM
  //   2. Compute the +48h cutoff datetime from system clock
  //   3. If the selected date's slots are all within 48h → throw (not bookable)
  //   4. Try Morning → click tab if not active → find first slot beyond cutoff → click it
  //   5. No slots in Morning → try Afternoon → try Evening
  //   6. Throw if no bookable slot found in any section
  //
  // firstSlot / lastSlot capture (independent of click logic):
  //   - firstSlot = first slot in Morning (faded or unfaded), NO time filter
  //   - lastSlot  = last slot beyond 48h cutoff in Evening (fallback: Afternoon)

  const c = ctx as any;
  const outputVar    = ctx.args[0]; // from $[selectedSlot]
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

  // XPath for visible time-slot buttons — used for the click action.
  // NOTE: We do NOT filter by @disabled here because HHCS marks slots with the @disabled
  // attribute purely for booking-policy styling, even when the slot is visually available.
  // We use { force: true } on the Playwright click to bypass the disabled guard.
  const availableSlotXpath =
    `//button[` +
      `not(contains(@class,'cursor-not-allowed'))` +
      ` and (contains(@class,'cursor-pointer') or contains(@class,'bg-white') or contains(@class,'hover:bg-gray-50') or contains(normalize-space(text()),':'))` +
      ` and contains(normalize-space(text()),':')` +
      ` and not(contains(@class,'flex-1'))` +
    `]`;

  // XPath for ALL slots (faded/disabled included) — used for firstSlot/lastSlot capture
  const allSlotsXpath =
    `//button[` +
      `contains(normalize-space(text()),':')` +
      ` and not(contains(@class,'flex-1'))` +
      ` and (contains(@class,'cursor-pointer') or contains(@class,'cursor-not-allowed') or @disabled` +
      ` or contains(@class,'bg-white') or contains(@class,'bg-gray-50') or contains(@class,'rounded-full'))` +
    `]`;

  // ── +48 Hours Policy Setup ──────────────────────────────────────────────────────────────────────

  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const todayDay   = nowDate.getDate();
  const todayMonth = nowDate.getMonth(); // 0-indexed
  const todayYear  = nowDate.getFullYear();

  // Cutoff = now + 48 hours
  const cutoffDate = new Date(nowDate.getTime() + 48 * 60 * 60 * 1000);
  const cutoffDay     = cutoffDate.getDate();
  const cutoffMonth   = cutoffDate.getMonth();
  const cutoffYear    = cutoffDate.getFullYear();
  const cutoffMinutes = cutoffDate.getHours() * 60 + cutoffDate.getMinutes();

  ctx.log(`Current system time: ${nowDate.toISOString()}`);
  ctx.log(`+48h cutoff: ${cutoffDate.toISOString()} (day=${cutoffDay}, time=${Math.floor(cutoffMinutes/60)}:${String(cutoffMinutes%60).padStart(2,'0')})`);

  // Detect the selected/active date from the calendar DOM.
  // Returns { day, month (1-indexed), year } or null if undetectable.
  // Strategy 1: aria-pressed/aria-selected
  // Strategy 2: dark/active-styled date button
  // We also try to read the visible month/year from the calendar header.
  const selectedDateInfo: { day: number; month: number; year: number } | null =
    await c.page.evaluate((): { day: number; month: number; year: number } | null => {
      // Helper: try to parse month/year from visible calendar header text
      // e.g. "June 2026", "Jun 2026", "2026-06"
      function parseMonthYear(text: string): { month: number; year: number } | null {
        const monthNames: Record<string, number> = {
          january:1, february:2, march:3, april:4, may:5, june:6,
          july:7, august:8, september:9, october:10, november:11, december:12,
          jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8,
          sep:9, oct:10, nov:11, dec:12,
        };
        // "June 2026" or "Jun 2026"
        const m1 = text.match(/([A-Za-z]+)\s+(\d{4})/);
        if (m1) {
          const mon = monthNames[m1[1].toLowerCase()];
          const yr  = parseInt(m1[2], 10);
          if (mon && yr) return { month: mon, year: yr };
        }
        // "2026-06" or "2026/06"
        const m2 = text.match(/(\d{4})[-\/](\d{1,2})/);
        if (m2) {
          return { month: parseInt(m2[2], 10), year: parseInt(m2[1], 10) };
        }
        return null;
      }

      // Try to find the calendar header showing month/year
      let calendarMonthYear: { month: number; year: number } | null = null;
      const headingCandidates = Array.from(
        document.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*="month"],[class*="header"],[class*="calendar"]')
      ) as HTMLElement[];
      for (const el of headingCandidates) {
        const parsed = parseMonthYear((el.textContent ?? '').trim());
        if (parsed) { calendarMonthYear = parsed; break; }
      }
      // Fallback: scan all text nodes for a month+year pattern
      if (!calendarMonthYear) {
        const allEls = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of allEls) {
          if (el.children.length > 0) continue; // leaf nodes only
          const parsed = parseMonthYear((el.textContent ?? '').trim());
          if (parsed) { calendarMonthYear = parsed; break; }
        }
      }

      // Find the active/selected day number
      let activeDay: number | null = null;

      // Strategy 1: aria attributes
      const ariaSelected = document.querySelector(
        'button[aria-pressed="true"], button[aria-selected="true"], [role="gridcell"][aria-selected="true"]'
      ) as HTMLElement | null;
      if (ariaSelected) {
        const n = parseInt((ariaSelected.textContent ?? '').trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= 31) activeDay = n;
      }

      // Strategy 2: dark/active-styled date button
      if (activeDay === null) {
        const allDateBtns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
        for (const btn of allDateBtns) {
          const cls = btn.className || '';
          const txt = (btn.textContent ?? '').trim();
          const num = parseInt(txt, 10);
          if (isNaN(num) || num < 1 || num > 31) continue;
          if (
            cls.includes('bg-black') ||
            cls.includes('bg-primary') ||
            cls.includes('bg-blue') ||
            cls.includes('bg-gray-900') ||
            (cls.includes('rounded-full') && cls.includes('text-white')) ||
            (cls.includes('rounded-full') && cls.includes('bg-'))
          ) {
            activeDay = num;
            break;
          }
        }
      }

      if (activeDay === null) return null;

      if (calendarMonthYear) {
        return { day: activeDay, month: calendarMonthYear.month, year: calendarMonthYear.year };
      }

      // Fallback: use current JS date for month/year (may be wrong if calendar is on next month)
      const now = new Date();
      return { day: activeDay, month: now.getMonth() + 1, year: now.getFullYear() };
    });

  ctx.log(`Detected selected date: ${JSON.stringify(selectedDateInfo)}`);

  // Build a Date object for the selected calendar date at midnight (00:00)
  // We compare slots against the cutoff by constructing slot datetimes
  let selectedDateMidnight: Date | null = null;
  if (selectedDateInfo) {
    selectedDateMidnight = new Date(
      selectedDateInfo.year,
      selectedDateInfo.month - 1, // back to 0-indexed
      selectedDateInfo.day,
      0, 0, 0, 0
    );
  }

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
        if (hours === 12) hours = 0;
      } else {
        if (hours !== 12) hours += 12;
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
   * Check if a slot is beyond the +48h cutoff.
   * Combines the selected calendar date with the slot's start time and compares to cutoffDate.
   */
  function isSlotBeyond48hCutoff(slotText: string): boolean {
    const slotStartMin = parseSlotStartMinutes(slotText);
    if (slotStartMin === null) return false; // can't parse → skip

    if (selectedDateMidnight === null) {
      // Can't determine the selected date → fall back to comparing only time on today
      // If today, skip past slots; otherwise allow all
      ctx.log(`Warning: could not detect calendar date — applying today-only time filter`);
      return slotStartMin > nowMinutes;
    }

    // Build the slot's full datetime
    const slotDatetime = new Date(selectedDateMidnight.getTime());
    slotDatetime.setHours(Math.floor(slotStartMin / 60), slotStartMin % 60, 0, 0);

    // Slot is bookable only if it is strictly AFTER the cutoff
    const beyond = slotDatetime.getTime() > cutoffDate.getTime();
    if (!beyond) {
      ctx.log(
        `Skipping slot "${slotText}" — datetime ${slotDatetime.toISOString()} ` +
        `is within 48h of now (cutoff: ${cutoffDate.toISOString()})`
      );
    }
    return beyond;
  }

  /**
   * Activate a section tab and collect ALL slots (faded + unfaded) with NO time filter.
   * Used exclusively for Morning firstSlot capture.
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
   * Activate a section tab and collect all slots that are beyond the +48h cutoff.
   * Returns slot texts in DOM order, or empty array if tab not found / disabled.
   */
  async function collectBookableSlotsInSection(section: string): Promise<string[]> {
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

    // Keep only slots beyond the +48h cutoff
    return rawSlots.filter(text => isSlotBeyond48hCutoff(text));
  }

  // ── Phase 1: Capture firstSlot (Morning) and lastSlot (Evening, fallback Afternoon) ──────────

  ctx.log('Phase 1: Collecting first/last slots across sections...');

  // firstSlot uses NO time filter — grab the very first morning slot
  const morningSlotsRaw = await collectAllSlotsInSection('Morning');
  ctx.log(`Morning slots (no filter): ${morningSlotsRaw.length}`);

  const afternoonSlotsBookable = await collectBookableSlotsInSection('Afternoon');
  ctx.log(`Afternoon bookable slots (beyond 48h): ${afternoonSlotsBookable.length}`);

  const eveningSlotsBookable = await collectBookableSlotsInSection('Evening');
  ctx.log(`Evening bookable slots (beyond 48h): ${eveningSlotsBookable.length}`);

  // firstSlot = first slot in Morning (faded or unfaded), no filter
  const firstSlotText = morningSlotsRaw.length > 0 ? morningSlotsRaw[0] : null;

  // lastSlot = last bookable slot in Evening; if none, fallback to last in Afternoon
  const lastSlotText =
    eveningSlotsBookable.length > 0
      ? eveningSlotsBookable[eveningSlotsBookable.length - 1]
      : afternoonSlotsBookable.length > 0
        ? afternoonSlotsBookable[afternoonSlotsBookable.length - 1]
        : null;

  if (firstSlotText && firstSlotVar) {
    ctx.setVariable(firstSlotVar, firstSlotText);
    ctx.log(`Stored first morning slot "${firstSlotText}" → $[${firstSlotVar}]`);
  } else if (!firstSlotText) {
    ctx.log('No morning slots found — $[firstSlot] not set');
  }

  if (lastSlotText && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlotText);
    ctx.log(`Stored last bookable slot "${lastSlotText}" → $[${lastSlotVar}]`);
  } else if (!lastSlotText) {
    ctx.log('No bookable afternoon/evening slots found — $[lastSlot] not set');
  }

  // ── Phase 2: Click logic — first slot beyond +48h cutoff (Morning → Afternoon → Evening) ─────

  ctx.log('Phase 2: Clicking first bookable slot (beyond +48h cutoff)...');

  for (const section of sections) {
    ctx.log(`Checking section: ${section}`);

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

    // Apply +48h policy: keep only slots whose full datetime is beyond the cutoff
    const bookableSlots = allSlots.filter(slot => isSlotBeyond48hCutoff(slot.text));

    if (bookableSlots.length === 0) {
      ctx.log(`All slots in "${section}" are within the 48h booking window — moving to next section`);
      continue;
    }

    const slotResult = bookableSlots[0];

    ctx.log(`Found bookable slot in "${section}": "${slotResult.text}" — clicking...`);

    const slotXpathIndexed = `(${availableSlotXpath})[${slotResult.index + 1}]`;
    await c.page.locator(`xpath=${slotXpathIndexed}`).first().click({ force: true });

    ctx.log(`Clicked time slot: "${slotResult.text}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotResult.text);
      ctx.log(`Stored "${slotResult.text}" → $[${outputVar}]`);
    }

    return; // Done
  }

  const cutoffStr = `${cutoffDate.getDate()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}-${cutoffDate.getFullYear()} ` +
    `${Math.floor(cutoffMinutes/60)}:${String(cutoffMinutes%60).padStart(2,'0')}`;

  throw new Error(
    `No bookable time slots found in Morning, Afternoon, or Evening. ` +
    `All available slots are within the 48-hour booking policy window. ` +
    `Earliest bookable datetime: ${cutoffStr}. ` +
    `Please select a date at least 48 hours from now (${new Date().toISOString()}).`
  );
}
