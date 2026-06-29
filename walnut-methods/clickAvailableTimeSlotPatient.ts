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
  // ctx.args[0] = "selectedSlot" — clicked slot variable name
  // ctx.args[1] = "firstSlot"   — first morning slot (no time filter)
  // ctx.args[2] = "lastSlot"    — last evening/afternoon slot (beyond 48h cutoff)
  //
  // +48 HOURS POLICY:
  //   A slot is only bookable if its full datetime is MORE THAN 48 hours from now.
  //   Cutoff = new Date() + 48h
  //   If we cannot detect the selected calendar date, we allow ALL slots (safe fallback).
  //
  // DOM: HHCS slots have `disabled` attribute set for booking-policy styling even when
  //      visually available. We use { force: true } on all clicks to bypass Playwright's
  //      disabled-element guard.

  const c = ctx as any;
  const outputVar    = ctx.args[0];
  const firstSlotVar = ctx.args[1];
  const lastSlotVar  = ctx.args[2];

  const sections = ['Morning', 'Afternoon', 'Evening'];

  // ── XPaths ────────────────────────────────────────────────────────────────────────────────────

  // Tab button XPath: matches buttons whose visible text contains the section label
  const findTabXpath = (label: string) =>
    `//button[` +
      `.//span[normalize-space(text())='${label}']` +
      ` or (contains(normalize-space(.),'${label}') and not(.//span[normalize-space(text())!='${label}']))` +
    `]`;

  // Slot button XPath: match by time-range text, no class restrictions.
  // Do NOT filter by @disabled — HHCS sets disabled for policy styling.
  // Do NOT filter by cursor-pointer/bg-white — HHCS slots may not have those.
  const slotXpath =
    `//button[` +
      `not(contains(@class,'cursor-not-allowed'))` +
      ` and contains(normalize-space(text()),':')` +
      ` and (` +
        `contains(normalize-space(text()),'–')` +
        ` or contains(normalize-space(text()),' - ')` +
        ` or contains(normalize-space(text()),'AM')` +
        ` or contains(normalize-space(text()),'PM')` +
      `)` +
      ` and not(contains(@class,'flex-1'))` +
    `]`;

  // ── +48h Cutoff Setup ─────────────────────────────────────────────────────────────────────────

  const nowDate    = new Date();
  const cutoffDate = new Date(nowDate.getTime() + 48 * 60 * 60 * 1000);
  const cutoffMinutes = cutoffDate.getHours() * 60 + cutoffDate.getMinutes();

  ctx.log(`System time: ${nowDate.toISOString()}`);
  ctx.log(`48h cutoff: ${cutoffDate.toISOString()}`);

  // ── Calendar Date Detection ────────────────────────────────────────────────────────────────────

  const selectedDateInfo: { day: number; month: number; year: number } | null =
    await c.page.evaluate((): { day: number; month: number; year: number } | null => {
      const monthNames: Record<string, number> = {
        january:1, february:2, march:3, april:4, may:5, june:6,
        july:7, august:8, september:9, october:10, november:11, december:12,
        jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8,
        sep:9, oct:10, nov:11, dec:12,
      };

      function parseMonthYear(text: string): { month: number; year: number } | null {
        const m1 = text.match(/([A-Za-z]+)\s+(\d{4})/);
        if (m1) {
          const mon = monthNames[m1[1].toLowerCase()];
          const yr  = parseInt(m1[2], 10);
          if (mon && yr) return { month: mon, year: yr };
        }
        const m2 = text.match(/(\d{4})[-\/](\d{1,2})/);
        if (m2) return { month: parseInt(m2[2], 10), year: parseInt(m2[1], 10) };
        return null;
      }

      // Find month/year from calendar header
      let calendarMonthYear: { month: number; year: number } | null = null;
      const candidates = Array.from(
        document.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*="month"],[class*="header"],[class*="calendar"]')
      ) as HTMLElement[];
      for (const el of candidates) {
        const p = parseMonthYear((el.textContent ?? '').trim());
        if (p) { calendarMonthYear = p; break; }
      }
      if (!calendarMonthYear) {
        const allEls = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of allEls) {
          if (el.children.length > 0) continue;
          const p = parseMonthYear((el.textContent ?? '').trim());
          if (p) { calendarMonthYear = p; break; }
        }
      }

      // Find active day — Strategy 1: aria attributes
      let activeDay: number | null = null;
      const ariaEl = document.querySelector(
        'button[aria-pressed="true"],button[aria-selected="true"],[role="gridcell"][aria-selected="true"]'
      ) as HTMLElement | null;
      if (ariaEl) {
        const n = parseInt((ariaEl.textContent ?? '').trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= 31) activeDay = n;
      }

      // Strategy 2: dark/highlighted date button
      if (activeDay === null) {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
        for (const btn of btns) {
          const cls = btn.className || '';
          const txt = (btn.textContent ?? '').trim();
          const num = parseInt(txt, 10);
          if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
          if (
            cls.includes('bg-black') || cls.includes('bg-primary') ||
            cls.includes('bg-blue') || cls.includes('bg-gray-900') ||
            (cls.includes('rounded-full') && cls.includes('text-white')) ||
            (cls.includes('rounded-full') && cls.includes('bg-'))
          ) {
            activeDay = num;
            break;
          }
        }
      }

      // Strategy 3: computed style — darkest date button
      if (activeDay === null) {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLElement[];
        for (const btn of btns) {
          const txt = (btn.textContent ?? '').trim();
          const num = parseInt(txt, 10);
          if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
          const bg = window.getComputedStyle(btn).backgroundColor;
          const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (!m) continue;
          const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
          if (r > 210 && g > 210 && b > 210) continue; // skip near-white
          activeDay = num;
          break;
        }
      }

      if (activeDay === null) return null;

      if (calendarMonthYear) {
        return { day: activeDay, month: calendarMonthYear.month, year: calendarMonthYear.year };
      }
      // Fallback — use current JS month/year (may be wrong if calendar is next month)
      const now = new Date();
      return { day: activeDay, month: now.getMonth() + 1, year: now.getFullYear() };
    });

  ctx.log(`Detected calendar date: ${JSON.stringify(selectedDateInfo)}`);

  // Build selectedDateMidnight for 48h comparison
  let selectedDateMidnight: Date | null = null;
  if (selectedDateInfo) {
    selectedDateMidnight = new Date(
      selectedDateInfo.year,
      selectedDateInfo.month - 1,
      selectedDateInfo.day,
      0, 0, 0, 0
    );
  }

  // ── 48h Check Helper ──────────────────────────────────────────────────────────────────────────

  function parseSlotStartMinutes(text: string): number | null {
    const m12 = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const min = parseInt(m12[2], 10);
      const p = m12[3].toUpperCase();
      if (p === 'AM') { if (h === 12) h = 0; }
      else { if (h !== 12) h += 12; }
      return h * 60 + min;
    }
    const m24 = text.match(/^(\d{1,2}):(\d{2})/);
    if (m24) {
      const h = parseInt(m24[1], 10);
      const min = parseInt(m24[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    }
    return null;
  }

  function isSlotBeyond48hCutoff(slotText: string): boolean {
    const startMin = parseSlotStartMinutes(slotText);
    if (startMin === null) return true; // can't parse → allow

    if (selectedDateMidnight === null) {
      // Cannot determine the selected date — allow all slots (safe fallback)
      ctx.log(`No calendar date detected — allowing slot "${slotText}"`);
      return true;
    }

    const slotDatetime = new Date(selectedDateMidnight.getTime());
    slotDatetime.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

    const beyond = slotDatetime.getTime() > cutoffDate.getTime();
    if (!beyond) {
      ctx.log(`Skipping "${slotText}" — ${slotDatetime.toISOString()} within 48h of cutoff ${cutoffDate.toISOString()}`);
    }
    return beyond;
  }

  // ── Tab Click + Slot Collect Helper ───────────────────────────────────────────────────────────

  async function clickTabAndGetSlots(section: string): Promise<string[]> {
    const tabXpath = findTabXpath(section);

    const tabExists: boolean = await c.page.evaluate((xp: string) => {
      const r = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return r.singleNodeValue != null;
    }, tabXpath);

    if (!tabExists) {
      ctx.log(`Tab "${section}" not found — skipping`);
      return [];
    }

    // Always click tab with force — HHCS may set disabled on tabs for styling
    await c.page.locator(`xpath=${tabXpath}`).first().click({ force: true });
    await c.wait(700);

    const texts: string[] = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const t = (el.textContent ?? '').trim();
        if (t) out.push(t);
      }
      return out;
    }, slotXpath);

    return texts;
  }

  // ── Phase 1: Capture firstSlot and lastSlot ───────────────────────────────────────────────────

  ctx.log('Phase 1: Capturing firstSlot and lastSlot...');

  const morningSlots    = await clickTabAndGetSlots('Morning');
  const afternoonSlots  = await clickTabAndGetSlots('Afternoon');
  const eveningSlots    = await clickTabAndGetSlots('Evening');

  ctx.log(`Morning slots: ${morningSlots.length}, Afternoon: ${afternoonSlots.length}, Evening: ${eveningSlots.length}`);

  // firstSlot = first morning slot (no 48h filter — raw capture)
  const firstSlotText = morningSlots.length > 0 ? morningSlots[0] : null;

  // lastSlot = last slot in Evening (48h filtered), fallback Afternoon
  const eveningBookable   = eveningSlots.filter(isSlotBeyond48hCutoff);
  const afternoonBookable = afternoonSlots.filter(isSlotBeyond48hCutoff);
  const lastSlotText =
    eveningBookable.length > 0   ? eveningBookable[eveningBookable.length - 1] :
    afternoonBookable.length > 0 ? afternoonBookable[afternoonBookable.length - 1] :
    null;

  if (firstSlotText && firstSlotVar) {
    ctx.setVariable(firstSlotVar, firstSlotText);
    ctx.log(`firstSlot → "${firstSlotText}"`);
  }
  if (lastSlotText && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlotText);
    ctx.log(`lastSlot → "${lastSlotText}"`);
  }

  // ── Phase 2: Click first bookable slot (Morning → Afternoon → Evening) ────────────────────────

  ctx.log('Phase 2: Clicking first bookable slot beyond 48h cutoff...');

  const allSectionSlots = [
    { section: 'Morning',   slots: morningSlots },
    { section: 'Afternoon', slots: afternoonSlots },
    { section: 'Evening',   slots: eveningSlots },
  ];

  for (const { section, slots } of allSectionSlots) {
    if (slots.length === 0) {
      ctx.log(`No slots in "${section}" — skipping`);
      continue;
    }

    const bookable = slots.filter(isSlotBeyond48hCutoff);
    ctx.log(`"${section}" bookable slots: ${bookable.length}/${slots.length}`);

    if (bookable.length === 0) {
      ctx.log(`All "${section}" slots within 48h — moving to next section`);
      continue;
    }

    const slotText = bookable[0];

    // Re-click the tab to ensure it's active before clicking the slot
    const tabXpath = findTabXpath(section);
    await c.page.locator(`xpath=${tabXpath}`).first().click({ force: true });
    await c.wait(700);

    ctx.log(`Clicking "${slotText}" in "${section}"...`);

    const escapedText = slotText.replace(/'/g, "', \"'\", '");
    const slotClickXpath =
      `//button[` +
        `not(contains(@class,'cursor-not-allowed'))` +
        ` and not(contains(@class,'flex-1'))` +
        ` and normalize-space(text())='${escapedText}'` +
      `]`;

    await c.page.locator(`xpath=${slotClickXpath}`).first().click({ force: true });
    await c.wait(800);

    ctx.log(`Clicked slot: "${slotText}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotText);
      ctx.log(`selectedSlot → "${slotText}"`);
    }

    return;
  }

  const cutoffStr =
    `${cutoffDate.getDate()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}-${cutoffDate.getFullYear()} ` +
    `${Math.floor(cutoffMinutes/60)}:${String(cutoffMinutes%60).padStart(2,'0')}`;

  throw new Error(
    `No bookable time slots found in Morning, Afternoon, or Evening. ` +
    `All available slots are within the 48-hour booking policy window. ` +
    `Earliest bookable datetime: ${cutoffStr}. ` +
    `Please select a date at least 48 hours from now (${new Date().toISOString()}).`
  );
}
