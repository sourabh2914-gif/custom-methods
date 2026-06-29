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
  // ctx.args[0] = selectedSlot output variable name
  // ctx.args[1] = firstSlot output variable name
  // ctx.args[2] = lastSlot output variable name
  //
  // 48-HOUR POLICY: only click slots whose datetime > now + 48h.
  // If the selected calendar date cannot be detected, allow ALL slots (safe fallback).
  // HHCS sets disabled + cursor-not-allowed on slot/tab buttons for styling — use force:true.

  const c = ctx as any;
  const outputVar    = ctx.args[0];
  const firstSlotVar = ctx.args[1];
  const lastSlotVar  = ctx.args[2];

  // ── 48h Cutoff ──────────────────────────────────────────────────────────────────────────────────

  const nowDate    = new Date();
  const cutoffDate = new Date(nowDate.getTime() + 48 * 60 * 60 * 1000);

  ctx.log(`System time: ${nowDate.toISOString()}`);
  ctx.log(`48h cutoff : ${cutoffDate.toISOString()}`);

  // ── Calendar Date Detection ─────────────────────────────────────────────────────────────────────
  // Reads month/year from the "JUL 2026" header and the highlighted day button.

  const selectedDateInfo: { day: number; month: number; year: number } | null =
    await c.page.evaluate((): { day: number; month: number; year: number } | null => {
      const MONTHS: Record<string, number> = {
        january:1, february:2, march:3, april:4, may:5, june:6,
        july:7, august:8, september:9, october:10, november:11, december:12,
        jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
      };

      function parseMonthYear(txt: string): { month: number; year: number } | null {
        const m = txt.match(/([A-Za-z]+)\s+(\d{4})/);
        if (m) {
          const mon = MONTHS[m[1].toLowerCase()];
          const yr  = parseInt(m[2], 10);
          if (mon && yr) return { month: mon, year: yr };
        }
        return null;
      }

      // Find "JUL 2026" style header
      let calMY: { month: number; year: number } | null = null;
      const allEls = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      for (const el of allEls) {
        const txt = (el.textContent ?? '').trim();
        const p = parseMonthYear(txt);
        // Accept only if this element is a short header (not a long paragraph)
        if (p && txt.length < 30) { calMY = p; break; }
      }

      // Find highlighted day button
      let activeDay: number | null = null;

      // Strategy 1: aria-pressed / aria-selected
      for (const sel of ['button[aria-pressed="true"]', 'button[aria-selected="true"]', '[role="gridcell"][aria-selected="true"]']) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          const n = parseInt((el.textContent ?? '').trim(), 10);
          if (!isNaN(n) && n >= 1 && n <= 31) { activeDay = n; break; }
        }
      }

      // Strategy 2: dark bg Tailwind class
      if (activeDay === null) {
        for (const btn of Array.from(document.querySelectorAll('button')) as HTMLElement[]) {
          const txt = (btn.textContent ?? '').trim();
          const num = parseInt(txt, 10);
          if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
          const cls = btn.className || '';
          if (cls.includes('bg-black') || cls.includes('bg-primary') || cls.includes('bg-blue') ||
              cls.includes('bg-gray-900') ||
              (cls.includes('rounded-full') && cls.includes('text-white'))) {
            activeDay = num; break;
          }
        }
      }

      // Strategy 3: computed dark background
      if (activeDay === null) {
        for (const btn of Array.from(document.querySelectorAll('button')) as HTMLElement[]) {
          const txt = (btn.textContent ?? '').trim();
          const num = parseInt(txt, 10);
          if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
          const bg = window.getComputedStyle(btn).backgroundColor;
          const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (!m) continue;
          const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
          if (r < 210 || g < 210 || b < 210) { activeDay = num; break; }
        }
      }

      if (activeDay === null) return null;
      if (calMY) return { day: activeDay, month: calMY.month, year: calMY.year };

      const now = new Date();
      return { day: activeDay, month: now.getMonth() + 1, year: now.getFullYear() };
    });

  ctx.log(`Detected calendar date: ${JSON.stringify(selectedDateInfo)}`);

  const selectedDateMidnight: Date | null = selectedDateInfo
    ? new Date(selectedDateInfo.year, selectedDateInfo.month - 1, selectedDateInfo.day, 0, 0, 0, 0)
    : null;

  // ── 48h Check Helper ────────────────────────────────────────────────────────────────────────────

  function parseStartMinutes(text: string): number | null {
    // AM/PM format: "05:00 PM"
    const m12 = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const min = parseInt(m12[2], 10);
      if (m12[3].toUpperCase() === 'AM') { if (h === 12) h = 0; }
      else { if (h !== 12) h += 12; }
      return h * 60 + min;
    }
    // 24h format: "17:00"
    const m24 = text.match(/(\d{1,2}):(\d{2})/);
    if (m24) {
      const h = parseInt(m24[1], 10), min = parseInt(m24[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    }
    return null;
  }

  // Current system time in minutes since midnight (for today's date check)
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // Is the selected calendar date today?
  const isToday = selectedDateInfo !== null &&
    selectedDateInfo.day   === nowDate.getDate() &&
    selectedDateInfo.month === nowDate.getMonth() + 1 &&
    selectedDateInfo.year  === nowDate.getFullYear();

  ctx.log(`isToday: ${isToday}, nowMinutes: ${nowMinutes}`);

  function isBeyondCutoff(slotText: string): boolean {
    const startMin = parseStartMinutes(slotText);
    if (startMin === null) return true; // unparseable → allow

    if (selectedDateMidnight === null) {
      // Date could not be detected — apply current time filter as best-effort:
      // skip slots before now, allow everything else.
      if (startMin <= nowMinutes) {
        ctx.log(`Skip "${slotText}" — before current time (no date detected)`);
        return false;
      }
      return true;
    }

    // Today is selected: skip past slots (before current system time)
    // Example: current time 07:28 → skip 07:00, allow 07:30
    if (isToday && startMin <= nowMinutes) {
      ctx.log(`Skip "${slotText}" — ${Math.floor(startMin/60)}:${String(startMin%60).padStart(2,'0')} is in the past (now ${Math.floor(nowMinutes/60)}:${String(nowMinutes%60).padStart(2,'0')})`);
      return false;
    }

    // Future date selected: apply 48h booking policy cutoff only
    // Do NOT apply current time filter — 07:30 on July 3 is valid even if now is 07:28
    const slotDt = new Date(selectedDateMidnight.getTime());
    slotDt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    const ok = slotDt.getTime() > cutoffDate.getTime();
    if (!ok) ctx.log(`Skip "${slotText}" — ${slotDt.toISOString()} within 48h cutoff`);
    return ok;
  }

  // ── Tab + Slot Helpers ──────────────────────────────────────────────────────────────────────────

  // Click a Morning/Afternoon/Evening tab by exact label match.
  // Uses XPath to find a button that contains the label text but is NOT a time-slot button
  // (slot buttons always contain ":" so we exclude those).
  async function clickSectionTab(label: string): Promise<boolean> {
    // Tab buttons contain the label word but do NOT contain ":" (which all slot buttons have)
    const xp = `//button[contains(normalize-space(.),'${label}') and not(contains(normalize-space(.),':'))]`;
    const found: boolean = await c.page.evaluate((x: string) => {
      return document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null;
    }, xp);
    if (found) {
      await c.page.locator(`xpath=${xp}`).first().click({ force: true });
      await c.wait(1000);
      return true;
    }
    ctx.log(`Tab "${label}" not found`);
    return false;
  }

  // Collect all slot button texts currently visible on the page.
  // Uses normalize-space(.) to capture text inside child <span> elements.
  // No class filter — HHCS marks all slots disabled/cursor-not-allowed for styling.
  async function collectVisibleSlots(): Promise<string[]> {
    // Slot buttons: contain ":" and are reasonably long (time ranges like "05:00 PM – 05:30 PM")
    const xp =
      `//button[` +
        `contains(normalize-space(.),':')` +
        ` and string-length(normalize-space(.)) > 4` +
        ` and not(contains(@class,'flex-1'))` +
      `]`;

    return await c.page.evaluate((xpath: string): string[] => {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        // Filter out tab labels that happen to match (Morning 3, Afternoon 10, etc.)
        if (t.length > 4 && !['Morning', 'Afternoon', 'Evening'].some(s => t.startsWith(s))) {
          out.push(t);
        }
      }
      return out;
    }, xp);
  }

  // ── Phase 1: Collect slots per section ─────────────────────────────────────────────────────────

  ctx.log('Phase 1: Collecting slots from Morning, Afternoon, Evening tabs...');

  await clickSectionTab('Morning');
  const morningSlots = await collectVisibleSlots();
  ctx.log(`Morning: ${morningSlots.length} slots — ${morningSlots.slice(0,3).join(', ')}`);

  await clickSectionTab('Afternoon');
  const afternoonSlots = await collectVisibleSlots();
  ctx.log(`Afternoon: ${afternoonSlots.length} slots — ${afternoonSlots.slice(0,3).join(', ')}`);

  await clickSectionTab('Evening');
  const eveningSlots = await collectVisibleSlots();
  ctx.log(`Evening: ${eveningSlots.length} slots — ${eveningSlots.slice(0,3).join(', ')}`);

  // firstSlot = first morning slot (no 48h filter)
  const firstSlotText = morningSlots.length > 0 ? morningSlots[0] : null;

  // lastSlot = last bookable slot in Evening, fallback Afternoon
  const eveningBookable   = eveningSlots.filter(isBeyondCutoff);
  const afternoonBookable = afternoonSlots.filter(isBeyondCutoff);
  const lastSlotText =
    eveningBookable.length   > 0 ? eveningBookable[eveningBookable.length - 1] :
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

  // ── Phase 2: Click first bookable slot (Morning → Afternoon → Evening) ─────────────────────────

  ctx.log('Phase 2: Clicking first bookable slot beyond 48h cutoff...');

  const sectionSlots = [
    { section: 'Morning',   slots: morningSlots },
    { section: 'Afternoon', slots: afternoonSlots },
    { section: 'Evening',   slots: eveningSlots },
  ];

  for (const { section, slots } of sectionSlots) {
    if (slots.length === 0) {
      ctx.log(`"${section}" — no slots, skipping`);
      continue;
    }

    const bookable = slots.filter(isBeyondCutoff);
    ctx.log(`"${section}" — ${bookable.length}/${slots.length} bookable`);

    if (bookable.length === 0) {
      ctx.log(`"${section}" — all within 48h, trying next section`);
      continue;
    }

    const slotText = bookable[0];

    // Switch to this section tab before clicking the slot
    await clickSectionTab(section);

    ctx.log(`Clicking "${slotText}" in "${section}"...`);

    // Extract start time to use as the contains() match key
    // e.g. "05:00 PM – 05:30 PM" → "05:00 PM"
    const startMatch = slotText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    const startKey   = startMatch ? startMatch[1].trim() : slotText.trim();

    // Try Playwright getByText first (most resilient)
    let clicked = false;
    try {
      const loc = c.page.getByText(new RegExp(startKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      const cnt = await loc.count();
      if (cnt > 0) {
        await loc.first().click({ force: true });
        clicked = true;
      }
    } catch (_) { /* fall through */ }

    if (!clicked) {
      // XPath fallback
      const xp =
        `//button[` +
          `not(contains(@class,'flex-1'))` +
          ` and contains(normalize-space(.),'${startKey}')` +
        `]`;
      const found: boolean = await c.page.evaluate((x: string) =>
        document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null
      , xp);

      if (found) {
        await c.page.locator(`xpath=${xp}`).first().click({ force: true });
        clicked = true;
      }
    }

    if (!clicked) {
      // Last resort: click the first slot button visible on the page
      ctx.warn(`Could not match "${startKey}" — clicking first visible slot button`);
      const allSlots = c.page.locator(`//button[contains(normalize-space(.),':') and string-length(normalize-space(.)) > 4 and not(contains(@class,'flex-1'))]`);
      if (await allSlots.count() > 0) {
        await allSlots.first().click({ force: true });
        clicked = true;
      }
    }

    if (!clicked) {
      throw new Error(`Could not click slot "${slotText}" in section "${section}"`);
    }

    await c.wait(800);
    ctx.log(`Clicked: "${slotText}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotText);
      ctx.log(`selectedSlot → "${slotText}"`);
    }

    return;
  }

  // All sections exhausted — build a useful error message
  const cutoffStr =
    `${cutoffDate.getDate()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}-${cutoffDate.getFullYear()} ` +
    `${String(cutoffDate.getHours()).padStart(2,'0')}:${String(cutoffDate.getMinutes()).padStart(2,'0')}`;

  throw new Error(
    `No bookable time slots found in Morning, Afternoon, or Evening. ` +
    `All available slots are within the 48-hour booking policy window. ` +
    `Earliest bookable datetime: ${cutoffStr}. ` +
    `Please select a date at least 48 hours from now (${new Date().toISOString()}).`
  );
}
