import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Appointment In Day View
 * description: Switch to Day view, navigate to $[bookedDate] and verify appointment card for $[selectedSlot]
 * actionType: custom_verify_appointment_in_day_view
 * context: web
 * needsLocator: false
 * category: Appointments
 */
export async function verifyAppointmentInDayView(ctx: WalnutContext) {
  // ctx.args[0] = "bookedDate"   (from $[bookedDate])   — runtime variable holding the booked date
  //   e.g. "2026-06-13", "13/06/2026", or a bare day number "13"
  // ctx.args[1] = "selectedSlot" (from $[selectedSlot]) — runtime variable holding the slot text
  //   e.g. "01:30 PM – 02:00 PM"
  //
  // This method:
  //   1. Reads bookedDate and selectedSlot from runtime variables
  //   2. Clicks the Day tab (switching from default Week view)
  //   3. Reads the date pill shown in the Day toolbar (e.g. "06/15/2026")
  //   4. Navigates Next/Prev until the pill matches the booked date
  //   5. Marks the appointment card via data attribute, scrolls to it, and Playwright-clicks it
  //   6. Handles "+N more" overflow expansion if card is hidden

  const c = ctx as any;
  const bookedDateVar = ctx.args[0]; // "bookedDate"
  const slotVar       = ctx.args[1]; // "selectedSlot"

  const bookedDateRaw = ctx.getVariable(bookedDateVar);
  const slotText      = ctx.getVariable(slotVar);

  if (!bookedDateRaw) {
    throw new Error(`Runtime variable $[${bookedDateVar}] is empty — was the date selection step run first?`);
  }
  if (!slotText) {
    throw new Error(`Runtime variable $[${slotVar}] is empty — was the slot selection step run first?`);
  }

  ctx.log(`[DayView] Navigating to "${bookedDateRaw}" and verifying slot "${slotText}"`);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Parse booked date ─────────────────────────────────────────────────────────────────────────
  // Accepts: ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or bare day number
  const isBareDay = /^\d{1,2}$/.test(bookedDateRaw.trim());

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

  let bookedDay   = -1;
  let bookedMonth = -1; // 0-indexed; -1 = unknown (bare day)
  let bookedYear  = -1;

  if (isBareDay) {
    bookedDay = parseInt(bookedDateRaw.trim(), 10);
    ctx.log(`[DayView] Bare day number: ${bookedDay} — will match by day only`);
  } else {
    const fullDate = parseFullDate(bookedDateRaw);
    if (!fullDate) throw new Error(`Cannot parse booked date: "${bookedDateRaw}". Use YYYY-MM-DD, DD/MM/YYYY, or a bare day number.`);
    bookedDay   = fullDate.getDate();
    bookedMonth = fullDate.getMonth();
    bookedYear  = fullDate.getFullYear();
    ctx.log(`[DayView] Full date: ${bookedDay}/${bookedMonth + 1}/${bookedYear}`);
  }

  // ── Step 1: Click the Day tab (switching from default Week view) ──────────────────────────────
  // Week view is active by default. We must click "Day" to switch.
  const dayTabXpath = `//button[normalize-space(text())='Day' or normalize-space(.)='Day']`;
  const dayTabCount = await c.page.locator(`xpath=${dayTabXpath}`).count();
  if (dayTabCount > 0) {
    await c.page.locator(`xpath=${dayTabXpath}`).first().click();
    await ctx.wait(800);
    ctx.log('[DayView] Clicked Day tab — now in Day view');
  } else {
    ctx.log('[DayView] Day tab not found — assuming already in Day view');
  }

  // ── Step 2: Read the date currently shown in the Day view pill ───────────────────────────────
  // After switching to Day view the pill shows today's date, e.g. "06/15/2026".
  // We navigate from there to the booked date.
  async function getDisplayedDate(): Promise<{ day: number; month: number; year: number; text: string }> {
    // Primary: read the date pill (e.g. "06/15/2026") shown in the toolbar
    const pillText: string = await c.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, span, div'));
      for (const el of all) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        // Match exact "MM/DD/YYYY" pattern used by the HHCS day pill
        if (/^\d{1,2}\/\d{1,2}\/20\d{2}$/.test(t)) return t;
      }
      return '';
    });

    if (pillText) {
      const m = pillText.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
      if (m) {
        return {
          month: parseInt(m[1], 10) - 1,
          day:   parseInt(m[2], 10),
          year:  parseInt(m[3], 10),
          text:  pillText,
        };
      }
    }

    // Fallback: read the dark day header bar, e.g. "Mon  15  (Today)" or "Tue  16"
    const headerText: string = await c.page.evaluate(() => {
      const candidates = [
        '[class*="day-header"]',
        '[class*="dayHeader"]',
        '[class*="calendar-header"]',
        '[class*="calendarHeader"]',
        '.rbc-toolbar-label',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
      return '';
    });

    ctx.log(`[DayView] Fallback header text: "${headerText}"`);

    // Extract day number and year if present
    const dayNumMatch = headerText.match(/\b(\d{1,2})\b/);
    const yearMatch   = headerText.match(/\b(20\d{2})\b/);
    const up = headerText.toUpperCase();
    const shortUp = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    let month = -1;
    for (let i = 0; i < 12; i++) {
      if (up.includes(shortUp[i])) { month = i; break; }
    }
    if (dayNumMatch && yearMatch) {
      return {
        day:   parseInt(dayNumMatch[1], 10),
        month,
        year:  parseInt(yearMatch[1], 10),
        text:  headerText,
      };
    }

    return { day: -1, month: -1, year: -1, text: headerText };
  }

  // ── Step 3: Navigate Next/Prev until the displayed date matches the booked date ───────────────
  async function navigateDay(forward: boolean) {
    const clicked = await c.page.evaluate((fwd: boolean) => {
      const labelSel = fwd
        ? 'button[aria-label*="next" i], button[aria-label*="forward" i]'
        : 'button[aria-label*="prev" i], button[aria-label*="back" i], button[aria-label*="previous" i]';
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
      if (iconBtns.length === 1) { iconBtns[0].click(); return true; }
      return false;
    }, forward);
    if (!clicked) {
      if (forward) await c.page.locator('button:has(svg)').last().click();
      else         await c.page.locator('button:has(svg)').first().click();
    }
    await ctx.wait(600);
  }

  const MAX_NAV = 60;

  for (let i = 0; i < MAX_NAV; i++) {
    const { day: dispDay, month: dispMonth, year: dispYear, text: dispText } = await getDisplayedDate();

    ctx.log(`[DayView] Displayed date: ${dispDay}/${dispMonth + 1}/${dispYear} (attempt ${i + 1})`);

    // Check match
    let matched = false;
    if (isBareDay) {
      matched = dispDay === bookedDay;
    } else {
      matched = dispDay === bookedDay && dispMonth === bookedMonth && dispYear === bookedYear;
    }

    if (matched) {
      ctx.log(`[DayView] Correct date found: ${dispText}`);
      if (isBareDay) {
        // Resolve full date from the displayed pill for logging
        bookedMonth = dispMonth;
        bookedYear  = dispYear;
      }
      break;
    }

    if (dispDay === -1) {
      ctx.log('[DayView] Could not parse displayed date — navigating forward...');
      await navigateDay(true);
    } else {
      const displayedMs = new Date(dispYear, dispMonth, dispDay).getTime();
      const targetMs    = isBareDay
        ? new Date(dispYear, dispMonth, bookedDay).getTime() // same month target
        : new Date(bookedYear, bookedMonth, bookedDay).getTime();
      const forward = targetMs >= displayedMs;
      ctx.log(`[DayView] Navigating ${forward ? 'forward' : 'backward'}`);
      await navigateDay(forward);
    }

    if (i === MAX_NAV - 1) {
      throw new Error(
        `[DayView] Could not navigate to date "${bookedDateRaw}" within ${MAX_NAV} attempts. ` +
        `Last displayed: "${dispText}"`
      );
    }
  }

  // ── Step 4: Find and click the appointment card ───────────────────────────────────────────────
  // Match BOTH start and end time to avoid false positives (e.g. "08:00 PM" matching end of prior card).
  const slotParts = slotText.split(/\s*[–—\-]\s*/);
  const slotStart = slotParts[0].trim();  // e.g. "01:30 PM"
  const slotEnd   = slotParts[1]?.trim(); // e.g. "02:00 PM"

  ctx.log(`[DayView] Looking for card with start="${slotStart}" end="${slotEnd}"`);

  await ctx.wait(400);

  // Mark the card in DOM with a temp attribute, then Playwright-click it (fires proper pointer events for React).
  async function tryClickCard(): Promise<boolean> {
    const marked: boolean = await c.page.evaluate(({ start, end }: { start: string; end: string }) => {
      document.querySelectorAll('[data-walnut-card]').forEach(el => el.removeAttribute('data-walnut-card'));

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
        if (end && !raw.includes(end)) continue;
        if (raw.length <= start.length + 5) continue;
        candidates.push(el);
      }
      if (candidates.length === 0) return false;

      // Pick the smallest element that still has card-like content (> 20 chars)
      candidates.sort((a, b) => (a.innerText?.length ?? 0) - (b.innerText?.length ?? 0));
      const card = candidates.find(el => (el.innerText?.trim().length ?? 0) > 20) ?? candidates[0];
      card.setAttribute('data-walnut-card', 'true');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }, { start: slotStart, end: slotEnd ?? '' });

    if (!marked) return false;

    await ctx.wait(300);
    await c.page.locator('[data-walnut-card="true"]').first().click();

    // Clean up temp attribute
    await c.page.evaluate(() => {
      document.querySelectorAll('[data-walnut-card]').forEach(el => el.removeAttribute('data-walnut-card'));
    });

    return true;
  }

  let clicked = await tryClickCard();

  if (!clicked) {
    // Card may be hidden behind a "+N more" overflow — expand it first
    ctx.log(`[DayView] Card not found directly — looking for "+N more" overflow to expand`);
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
      ctx.log(`[DayView] Clicked "+N more" — waiting for card to appear`);
      await ctx.wait(600);
      clicked = await tryClickCard();
    }
  }

  if (!clicked) {
    throw new Error(
      `[DayView] Appointment card for slot "${slotText}" was NOT found in the day view for ` +
      `${bookedDay}${bookedMonth >= 0 ? ' ' + monthNames[bookedMonth] : ''}${bookedYear >= 0 ? ' ' + bookedYear : ''}. ` +
      `Expected a card with start="${slotStart}"${slotEnd ? ` end="${slotEnd}"` : ''}.`
    );
  }

  await ctx.wait(500);
  ctx.log(`[DayView] Appointment card verified and clicked — slot "${slotText}" on day "${bookedDateRaw}"`);
}
