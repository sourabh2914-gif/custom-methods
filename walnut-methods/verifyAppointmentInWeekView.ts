import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Appointment In Week View
 * description: Verify appointment card for $[selectedSlot] is visible in week view for $[AppoinmentBookingDate]
 * actionType: custom_verify_appointment_in_week_view
 * context: web
 * needsLocator: false
 * category: Appointments
 */
export async function verifyAppointmentInWeekView(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot"         (from $[selectedSlot])         — e.g. "04:00 PM – 04:30 PM"
  // ctx.args[1] = "AppoinmentBookingDate" (from $[AppoinmentBookingDate]) — e.g. "14" (bare day), "2026-06-14", or "14/06/2026"
  //
  // Strategy:
  //   1. Switch to Week tab if not already active
  //   2. If date is a bare day number — scan column headers on screen to find the matching column
  //      and derive the full date from the week pill (MM/DD/YYYY range shown in toolbar).
  //      If date is a full date string — navigate forward/backward until the week contains it.
  //   3. Find the appointment card containing the slot start time text in the correct day column.
  //   4. Scroll to it, assert visible, and click it.

  const c = ctx as any;
  const slotVar       = ctx.args[0]; // "selectedSlot"
  const bookedDateVar = ctx.args[1]; // "AppoinmentBookingDate"

  const slotText      = ctx.getVariable(slotVar);
  const bookedDateRaw = ctx.getVariable(bookedDateVar);

  if (!slotText)      throw new Error(`Runtime variable $[${slotVar}] is empty — was the slot selection step run first?`);
  if (!bookedDateRaw) throw new Error(`Runtime variable $[${bookedDateVar}] is empty — was the date selection step run first?`);

  ctx.log(`[WeekView] Verifying slot "${slotText}" on date "${bookedDateRaw}"`);

  const isBareDay = /^\d{1,2}$/.test(bookedDateRaw.trim());
  const targetDay = isBareDay ? parseInt(bookedDateRaw.trim(), 10) : -1;

  // ── Helpers ────────────────────────────────────────────────────────────────────────────────────

  // Read the week range pill text — e.g. "06/12/2026 - 06/19/2026"
  async function getWeekRangeText(): Promise<string> {
    return c.page.evaluate(() => {
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
      // Broad fallback: any element whose text matches MM/DD/YYYY - MM/DD/YYYY
      const els = Array.from(document.querySelectorAll('button, span, div, p'));
      for (const el of els) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        if (/\d{1,2}\/\d{1,2}\/20\d{2}\s*[-–]\s*\d{1,2}\/\d{1,2}\/20\d{2}/.test(t)) return t;
      }
      return '';
    });
  }

  // Parse MM/DD/YYYY - MM/DD/YYYY pill → { startMs, endMs, startMonth (0-idx), startYear, endMonth, endYear }
  function parseWeekRange(pill: string) {
    const m = pill.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
    if (!m) return null;
    const start = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    const end   = new Date(parseInt(m[6]), parseInt(m[4]) - 1, parseInt(m[5]));
    return {
      startMs:    start.getTime(),
      endMs:      end.getTime(),
      startDay:   start.getDate(),
      startMonth: start.getMonth(),
      startYear:  start.getFullYear(),
      endDay:     end.getDate(),
      endMonth:   end.getMonth(),
      endYear:    end.getFullYear(),
    };
  }

  // Parse a full date string → Date object
  // Accepts: ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
  function parseFullDate(raw: string): Date | null {
    const trimmed = raw.trim();
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
    const parts = trimmed.split(/[\/\-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  // Read all visible column header day numbers from the week grid.
  // Scans ALL elements in the DOM for text matching "Mon 15", "Fri 12 (Today)", "Sun 14" etc.
  async function getVisibleColumnDays(): Promise<number[]> {
    return c.page.evaluate(() => {
      const days: number[] = [];
      // Match "Mon 15", "Fri 12 (Today)", "Sun 14" — day name followed by a 1-2 digit number
      const headerRe = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})/i;
      // Walk every element — column headers can be div, th, span, button, td, etc.
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        // Only consider leaf-like elements (innerText length <= 30 to avoid large containers)
        const raw = (el as HTMLElement).innerText;
        if (!raw) continue;
        const text = raw.trim();
        if (text.length > 30) continue;
        const m = headerRe.exec(text);
        if (m) days.push(parseInt(m[2], 10));
      }
      return [...new Set(days)];
    });
  }

  // Click the Next/Prev week navigation button
  async function navigateWeek(forward: boolean) {
    const clicked = await c.page.evaluate((fwd: boolean) => {
      const labelSel = fwd
        ? 'button[aria-label*="next" i], button[aria-label*="forward" i]'
        : 'button[aria-label*="prev" i], button[aria-label*="back" i]';
      const byLabel = document.querySelector(labelSel) as HTMLButtonElement | null;
      if (byLabel) { byLabel.click(); return true; }
      // Icon-only buttons (no text, has SVG)
      const iconBtns = Array.from(document.querySelectorAll('button')).filter(
        b => !(b as HTMLElement).innerText?.trim() && b.querySelector('svg')
      ) as HTMLButtonElement[];
      if (iconBtns.length >= 2) {
        (fwd ? iconBtns[iconBtns.length - 1] : iconBtns[0]).click();
        return true;
      }
      return false;
    }, forward);
    if (!clicked) {
      if (forward) await c.page.locator('button:has(svg)').last().click();
      else         await c.page.locator('button:has(svg)').first().click();
    }
    await ctx.wait(700);
  }

  // Week tab is selected by default — no click needed.
  ctx.log('[WeekView] Week view is active by default');

  // ── Step 2: Navigate to the correct week ──────────────────────────────────────────────────────
  const MAX_NAV = 52;
  let weekFound = false;
  let resolvedDate: Date | null = null;

  if (isBareDay) {
    // Bare day number: scan current week's columns for the matching day number.
    // If not found, navigate forward up to MAX_NAV weeks.
    ctx.log(`[WeekView] Bare day "${targetDay}" — scanning column headers`);

    for (let i = 0; i < MAX_NAV; i++) {
      const pill = await getWeekRangeText();
      ctx.log(`[WeekView] Week pill: "${pill}"`);
      const range = parseWeekRange(pill);

      if (range) {
        // Check if targetDay appears within the week's day range
        // The week spans startDay..endDay (potentially across month boundary)
        const colDays = await getVisibleColumnDays();
        ctx.log(`[WeekView] Column days visible: [${colDays.join(', ')}]`);

        if (colDays.includes(targetDay)) {
          // Derive full date: find which month/year this day belongs to in this week
          // The week start is range.startMonth/startYear; end is range.endMonth/endYear
          // If targetDay >= startDay → same month as start (unless end month differs AND targetDay <= endDay)
          let resolvedMonth = range.startMonth;
          let resolvedYear  = range.startYear;

          if (range.startMonth !== range.endMonth) {
            // Week crosses a month boundary
            if (targetDay <= range.endDay) {
              // Day is in the latter part of the week (end month)
              resolvedMonth = range.endMonth;
              resolvedYear  = range.endYear;
            }
          }

          resolvedDate = new Date(resolvedYear, resolvedMonth, targetDay);
          ctx.log(`[WeekView] Resolved bare day ${targetDay} → ${resolvedDate.toISOString().split('T')[0]}`);
          weekFound = true;
          break;
        }
      }

      // Day not in this week — navigate forward
      ctx.log(`[WeekView] Day ${targetDay} not in current week — navigating forward`);
      await navigateWeek(true);
    }
  } else {
    // Full date string — navigate until the week contains this date
    const fullDate = parseFullDate(bookedDateRaw);
    if (!fullDate) throw new Error(`Cannot parse booked date: "${bookedDateRaw}". Use YYYY-MM-DD, DD/MM/YYYY, or a bare day number.`);

    resolvedDate = fullDate;
    const targetMs = fullDate.getTime();
    ctx.log(`[WeekView] Full date: ${fullDate.toISOString().split('T')[0]}`);

    for (let i = 0; i < MAX_NAV; i++) {
      const pill  = await getWeekRangeText();
      ctx.log(`[WeekView] Week pill: "${pill}"`);
      const range = parseWeekRange(pill);

      if (range) {
        if (targetMs >= range.startMs && targetMs <= range.endMs) {
          ctx.log(`[WeekView] Target date is in current week`);
          weekFound = true;
          break;
        }
        await navigateWeek(targetMs > range.endMs);
      } else {
        ctx.log('[WeekView] Cannot parse pill — navigating forward');
        await navigateWeek(true);
      }
    }
  }

  if (!weekFound) {
    throw new Error(`[WeekView] Could not navigate to the week containing "${bookedDateRaw}" within ${MAX_NAV} attempts.`);
  }

  // ── Step 3 & 4: Find the appointment card and click it ────────────────────────────────────────
  // selectedSlot = "08:00 PM – 08:30 PM" (en-dash from slot picker)
  // Card on screen = "08:00 PM – 08:30 PM" (may use en-dash or hyphen)
  // Problem: matching start time "08:00 PM" alone hits previous card's END time "07:30 PM – 08:00 PM"
  // Fix: require card contains BOTH start time AND end time of the slot.

  const slotParts   = slotText.split(/\s*[–—\-]\s*/);
  const slotStart   = slotParts[0].trim();  // "08:00 PM"
  const slotEnd     = slotParts[1]?.trim(); // "08:30 PM"

  ctx.log(`[WeekView] Looking for card with start="${slotStart}" end="${slotEnd}"`);

  await ctx.wait(400);

  // Helper: scan DOM for the appointment card and click it if found
  async function tryClickCard(): Promise<boolean> {
    return c.page.evaluate(({ start, end }: { start: string; end: string }) => {
      const candidates: HTMLElement[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Element | null;
      while ((node = walker.nextNode() as Element)) {
        const tag = node.tagName.toLowerCase();
        if (['html', 'body', 'head', 'script', 'style', 'noscript'].includes(tag)) continue;
        const el = node as HTMLElement;
        const raw = el.innerText?.trim() ?? '';
        if (!raw) continue;
        if (!raw.includes(start)) continue;
        // Require end time too — prevents matching a previous card whose END time = our START time
        if (end && !raw.includes(end)) continue;
        // Must be a real card, not a bare time label or "+" cell
        if (raw.length <= start.length + 5) continue;
        candidates.push(el);
      }
      if (candidates.length === 0) return false;
      // Pick smallest element with card-like content (> 20 chars)
      candidates.sort((a, b) => (a.innerText?.length ?? 0) - (b.innerText?.length ?? 0));
      const card = candidates.find(el => (el.innerText?.trim().length ?? 0) > 20) ?? candidates[0];
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.click();
      return true;
    }, { start: slotStart, end: slotEnd ?? '' });
  }

  let clicked = await tryClickCard();

  if (!clicked) {
    // Card may be hidden under a "+N more" overflow button — find and click it to expand
    ctx.log(`[WeekView] Card not found directly — looking for "+N more" overflow to expand`);
    const expandClicked: boolean = await c.page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        const text = (el as HTMLElement).innerText?.trim() ?? '';
        if (/^\+\d+\s*more$/i.test(text)) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });

    if (expandClicked) {
      ctx.log(`[WeekView] Clicked "+N more" — waiting for card to appear`);
      await ctx.wait(600);
      clicked = await tryClickCard();
    }
  }

  if (!clicked) {
    throw new Error(
      `[WeekView] Appointment card for slot "${slotText}" was NOT found in the week grid. ` +
      `Expected a card with start="${slotStart}" end="${slotEnd}" in column for day ${bookedDateRaw}.`
    );
  }

  await ctx.wait(500);
  ctx.log(`[WeekView] Appointment card verified and clicked — slot "${slotText}" on day "${bookedDateRaw}"`);
}
