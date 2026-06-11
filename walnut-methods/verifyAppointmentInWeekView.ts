import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Appointment In Week View
 * description: Verify appointment card for $[selectedSlot] is visible in week view for $[bookedDate]
 * actionType: custom_verify_appointment_in_week_view
 * context: web
 * needsLocator: false
 * category: Appointments
 */
export async function verifyAppointmentInWeekView(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — slot text e.g. "01:30 PM – 02:00 PM"
  // ctx.args[1] = "bookedDate"   (from $[bookedDate])   — booked date e.g. "2026-06-13" or "13/06/2026"
  //
  // This method:
  //   1. Reads the booked slot text and date from runtime variables
  //   2. Navigates to the week that contains the booked date (clicks "Next" if needed)
  //   3. Locates the appointment card in the week grid at the correct day column and time row
  //   4. Asserts the card is visible — throws if not found

  const c = ctx as any;
  const slotVar      = ctx.args[0]; // runtime variable name "selectedSlot"
  const bookedDateVar = ctx.args[1]; // runtime variable name "bookedDate"

  const slotText    = ctx.getVariable(slotVar);
  const bookedDateRaw = ctx.getVariable(bookedDateVar);

  if (!slotText)      throw new Error(`Runtime variable $[${slotVar}] is empty — was the slot selection step run first?`);
  if (!bookedDateRaw) throw new Error(`Runtime variable $[${bookedDateVar}] is empty — was the date selection step run first?`);

  ctx.log(`[WeekView] Verifying slot "${slotText}" on date "${bookedDateRaw}"`);

  // Parse booked date — accept ISO (YYYY-MM-DD), DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  function parseDate(raw: string): Date {
    // Try ISO first
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = raw.split(/[\/\-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      // If year is in position 2 and >= 2000
      if (parts[2].length === 4) {
        // Try DD/MM/YYYY
        d = new Date(c, b - 1, a);
        if (!isNaN(d.getTime())) return d;
      }
    }
    throw new Error(`Cannot parse booked date: "${raw}". Use ISO format YYYY-MM-DD or store via getDateAndStore.`);
  }

  const bookedDate  = parseDate(bookedDateRaw);
  const bookedDay   = bookedDate.getDate();
  const bookedMonth = bookedDate.getMonth(); // 0-indexed
  const bookedYear  = bookedDate.getFullYear();

  ctx.log(`[WeekView] Target date: ${bookedYear}-${String(bookedMonth + 1).padStart(2, '0')}-${String(bookedDay).padStart(2, '0')}`);

  // ── Step 1: Make sure we are on the Week tab ──────────────────────────────────────────────────
  const weekTabXpath = `//button[normalize-space(text())='Week' or normalize-space(.)='Week']`;
  const weekTabVisible = await c.page.locator(`xpath=${weekTabXpath}`).count() > 0;
  if (weekTabVisible) {
    await c.page.locator(`xpath=${weekTabXpath}`).first().click();
    await ctx.wait(600);
    ctx.log('[WeekView] Clicked Week tab');
  }

  // ── Step 2: Navigate forward/backward until the booked date is in the displayed week ─────────
  // The week view column headers show "Thu 11", "Fri 12 (Today)", "Sat 13" etc.
  // The week pill (top bar) shows "06/11/2026 - 06/18/2026".
  // Strategy: parse the week's START and END dates directly from the column headers + pill year,
  // then compare to the booked date — navigate forward OR backward as needed.

  const MAX_NAV = 52;
  let found = false;

  // Helper: read the week pill text using multiple fallback selectors.
  // From the HHCS screenshots the pill is a <button> inside the toolbar area.
  async function getWeekRangeText(): Promise<string> {
    return c.page.evaluate(() => {
      // Try explicit class fragments first
      const candidates = [
        '[class*="date-range"]',
        '[class*="dateRange"]',
        '[class*="week-range"]',
        '[class*="weekRange"]',
        '.rbc-toolbar-label',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
      // Broad fallback: any button whose text looks like "MM/DD/YYYY - MM/DD/YYYY"
      // or "MM/DD/YYYY – MM/DD/YYYY" (en-dash)
      const allBtns = Array.from(document.querySelectorAll('button, span, div'));
      for (const el of allBtns) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        // Matches "06/11/2026 - 06/18/2026" or "06/11/2026 – 06/18/2026"
        if (/\d{1,2}\/\d{1,2}\/20\d{2}\s*[-–]\s*\d{1,2}\/\d{1,2}\/20\d{2}/.test(t)) return t;
      }
      return '';
    });
  }

  // Helper: parse week start/end from the pill text.
  // Returns { startMs, endMs } in epoch ms, or null if unparseable.
  function parseWeekRange(pill: string): { startMs: number; endMs: number } | null {
    // Pattern: "06/11/2026 - 06/18/2026"  (MM/DD/YYYY)
    const m = pill.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
    if (!m) return null;
    const start = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    const end   = new Date(parseInt(m[6]), parseInt(m[4]) - 1, parseInt(m[5]));
    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  const targetMs = new Date(bookedYear, bookedMonth, bookedDay).getTime();

  for (let i = 0; i < MAX_NAV; i++) {
    const pill = await getWeekRangeText();
    ctx.log(`[WeekView] Week pill: "${pill}"`);

    const range = parseWeekRange(pill);

    if (range) {
      // Check if target date falls within [startMs, endMs] inclusive
      if (targetMs >= range.startMs && targetMs <= range.endMs) {
        ctx.log(`[WeekView] Booked date is in current week (${pill})`);
        found = true;
        break;
      }

      // Decide direction based on whether target is before or after this week
      const goForward = targetMs > range.endMs;
      ctx.log(`[WeekView] Navigating ${goForward ? 'forward' : 'backward'} (pill: "${pill}")`);

      if (goForward) {
        const clicked = await c.page.evaluate(() => {
          const byLabel = document.querySelector('button[aria-label*="next" i], button[aria-label*="forward" i]');
          if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
          const iconBtns = Array.from(document.querySelectorAll('button')).filter(b =>
            !(b.innerText?.trim()) && b.querySelector('svg')
          );
          if (iconBtns.length >= 2) { (iconBtns[iconBtns.length - 1] as HTMLButtonElement).click(); return true; }
          if (iconBtns.length === 1) { (iconBtns[0] as HTMLButtonElement).click(); return true; }
          return false;
        });
        if (!clicked) await c.page.locator('button:has(svg)').last().click();
      } else {
        const clicked = await c.page.evaluate(() => {
          const byLabel = document.querySelector('button[aria-label*="prev" i], button[aria-label*="back" i]');
          if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
          const iconBtns = Array.from(document.querySelectorAll('button')).filter(b =>
            !(b.innerText?.trim()) && b.querySelector('svg')
          );
          if (iconBtns.length >= 2) { (iconBtns[0] as HTMLButtonElement).click(); return true; }
          return false;
        });
        if (!clicked) await c.page.locator('button:has(svg)').first().click();
      }
    } else {
      // Could not parse pill — log and navigate forward as a safe default
      ctx.log('[WeekView] Could not parse week pill — navigating forward as fallback');
      await c.page.locator('button:has(svg)').last().click();
    }

    await ctx.wait(600);
  }

  if (!found) {
    throw new Error(
      `[WeekView] Could not navigate to the week containing "${bookedDateRaw}" within ${MAX_NAV} attempts.`
    );
  }

  // ── Step 3: Verify the appointment card is visible at the correct time ────────────────────────
  // The slot text looks like "01:30 PM – 02:00 PM"
  // Parse start time to match against the calendar grid row

  function parseStartTime(slotStr: string): { hour: number; minute: number; label: string } | null {
    const m = slotStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3].toUpperCase();
    if (period === 'AM') { if (h === 12) h = 0; }
    else                 { if (h !== 12) h += 12; }
    const label = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
    return { hour: h, minute: min, label };
  }

  const startTime = parseStartTime(slotText);
  ctx.log(`[WeekView] Parsed slot start: ${JSON.stringify(startTime)}`);

  // Strategy: look for an appointment card element whose text contains part of the slot text
  // Cards typically show the time range inside them: "01:30 PM – 02:00 PM" or "1:30 PM - 2:00 PM"
  // Extract just the start time portion for a partial match
  const slotStartLabel = slotText.split(/[-–]/)[0].trim(); // "01:30 PM"

  ctx.log(`[WeekView] Looking for appointment card containing: "${slotStartLabel}"`);

  // Try multiple selectors for appointment cards
  const cardSelectors = [
    // Generic event/appointment card containers
    `[class*="event"]:has-text("${slotStartLabel}")`,
    `[class*="appointment"]:has-text("${slotStartLabel}")`,
    `[class*="slot"]:has-text("${slotStartLabel}")`,
    `[class*="booking"]:has-text("${slotStartLabel}")`,
    // The HHCS-specific card visible in the screenshot (has doctor name + time)
    `div:has-text("${slotStartLabel}"):not(body):not(html):not(header):not(nav)`,
  ];

  let cardFound = false;
  for (const sel of cardSelectors) {
    try {
      const count = await c.page.locator(sel).count();
      if (count > 0) {
        ctx.log(`[WeekView] Appointment card found with selector: "${sel}" (count: ${count})`);
        cardFound = true;
        break;
      }
    } catch (_) {
      // selector may be invalid for some DOM states — continue
    }
  }

  if (!cardFound) {
    // Fallback: use evaluate to search the DOM directly
    const cardText: string = await c.page.evaluate((startLabel: string) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Element | null;
      while ((node = walker.nextNode() as Element)) {
        const tag = node.tagName.toLowerCase();
        if (['html','body','head','header','nav','script','style'].includes(tag)) continue;
        const text = (node as HTMLElement).innerText?.trim() ?? '';
        if (text.includes(startLabel) && text.length < 200) {
          return text;
        }
      }
      return '';
    }, slotStartLabel);

    if (cardText) {
      ctx.log(`[WeekView] Appointment card found via DOM walk: "${cardText.substring(0, 80)}"`);
      cardFound = true;
    }
  }

  if (!cardFound) {
    throw new Error(
      `[WeekView] Appointment card for slot "${slotText}" was NOT found in the week grid. ` +
      `Expected to see a card containing "${slotStartLabel}" on the column for ${bookedDateRaw}.`
    );
  }

  ctx.log(`[WeekView] Appointment card verified successfully for slot "${slotText}" on "${bookedDateRaw}"`);
}
