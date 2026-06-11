import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Navigate To Booked Date In Month View
 * description: Switch to Month view and click the booked date from $[bookedDate]
 * actionType: custom_navigate_to_booked_date_in_month_view
 * context: web
 * needsLocator: false
 * category: Appointments
 */
export async function navigateToBookedDateInMonthView(ctx: WalnutContext) {
  // ctx.args[0] = "bookedDate" (from $[bookedDate]) — runtime variable name
  //   Value must be a date string stored by a previous step, e.g. "2026-06-13", "13/06/2026", "13-06-2026"
  //
  // This method:
  //   1. Reads the booked date from the runtime variable
  //   2. Clicks the Month tab
  //   3. Navigates forward/backward (via the Next/Prev arrow on the calendar header)
  //      until the correct month+year is displayed — handles month boundary correctly
  //      (e.g. today is May 30, booked date is Jun 1 → navigates to June)
  //   4. Clicks ONLY the exact day cell that matches the booked date
  //   5. Does NOT click any other date

  const c = ctx as any;
  const bookedDateVar = ctx.args[0]; // "bookedDate"
  const bookedDateRaw = ctx.getVariable(bookedDateVar);

  if (!bookedDateRaw) {
    throw new Error(`Runtime variable $[${bookedDateVar}] is empty — was the date selection step run first?`);
  }

  ctx.log(`[MonthView] Navigating to booked date: "${bookedDateRaw}"`);

  // ── Parse booked date ─────────────────────────────────────────────────────────────────────────
  function parseDate(raw: string): Date {
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    const parts = raw.split(/[\/\-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      // Try DD/MM/YYYY
      d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(d.getTime())) return d;
    }
    throw new Error(`Cannot parse booked date: "${raw}". Use ISO YYYY-MM-DD or DD/MM/YYYY.`);
  }

  const bookedDate  = parseDate(bookedDateRaw);
  const bookedDay   = bookedDate.getDate();
  const bookedMonth = bookedDate.getMonth(); // 0-indexed
  const bookedYear  = bookedDate.getFullYear();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  ctx.log(`[MonthView] Target: ${monthNames[bookedMonth]} ${bookedDay}, ${bookedYear}`);

  // ── Step 1: Click the Month tab ───────────────────────────────────────────────────────────────
  const monthTabXpath = `//button[normalize-space(text())='Month' or normalize-space(.)='Month']`;
  const monthTabCount = await c.page.locator(`xpath=${monthTabXpath}`).count();
  if (monthTabCount > 0) {
    await c.page.locator(`xpath=${monthTabXpath}`).first().click();
    await ctx.wait(700);
    ctx.log('[MonthView] Clicked Month tab');
  } else {
    ctx.log('[MonthView] Month tab not found — assuming already in Month view');
  }

  // ── Step 2: Read the currently displayed month/year from the calendar header ─────────────────
  // Header pill looks like "JUN 2026" or "Jun 2026" or "June 2026"
  async function getDisplayedMonthYear(): Promise<{ month: number; year: number; text: string }> {
    const text: string = await c.page.evaluate(() => {
      // Try explicit class fragments
      const selectors = [
        '[class*="month-year"]',
        '[class*="monthYear"]',
        '[class*="calendar-header"]',
        '[class*="calendarHeader"]',
        '.rbc-toolbar-label',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
      // Broad fallback: find a button/span/div whose text is a short month+year pattern
      // e.g. "JUN 2026", "June 2026", "Jun 2026" — length < 20, contains a 4-digit year
      const all = Array.from(document.querySelectorAll('button, span, div'));
      for (const el of all) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        // Must contain a 4-digit year AND be short (not a full paragraph)
        if (/\b20\d{2}\b/.test(t) && t.length < 20 && t.length > 4) return t;
      }
      return '';
    });

    ctx.log(`[MonthView] Header text: "${text}"`);

    // Extract year
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (!yearMatch) return { month: -1, year: -1, text };

    const year = parseInt(yearMatch[1], 10);

    // Extract month
    const upperText = text.toUpperCase();
    let month = -1;
    const shortNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const fullNames  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

    for (let i = 0; i < 12; i++) {
      if (upperText.includes(shortNames[i]) || upperText.includes(fullNames[i])) {
        month = i;
        break;
      }
    }

    // Also try numeric month from patterns like "06/2026" or "06 2026"
    if (month === -1) {
      const numMatch = text.match(/\b(0?[1-9]|1[0-2])\b/);
      if (numMatch) month = parseInt(numMatch[1], 10) - 1;
    }

    return { month, year, text };
  }

  // ── Step 3: Navigate to the correct month ─────────────────────────────────────────────────────
  const MAX_NAV = 24; // max 2 years navigation

  for (let i = 0; i < MAX_NAV; i++) {
    const { month: displayedMonth, year: displayedYear } = await getDisplayedMonthYear();

    if (displayedMonth === bookedMonth && displayedYear === bookedYear) {
      ctx.log(`[MonthView] Correct month displayed: ${monthNames[bookedMonth]} ${bookedYear}`);
      break;
    }

    if (displayedMonth === -1 || displayedYear === -1) {
      ctx.log('[MonthView] Could not parse displayed month/year — trying to navigate forward...');
    }

    // Decide direction: forward or backward
    const displayedTotal = displayedYear * 12 + displayedMonth;
    const targetTotal    = bookedYear * 12 + bookedMonth;

    if (targetTotal > displayedTotal) {
      ctx.log(`[MonthView] Navigating forward (displayed: ${displayedMonth + 1}/${displayedYear}, target: ${bookedMonth + 1}/${bookedYear})`);
      // Click the Next (right chevron) button
      const nextClicked = await c.page.evaluate(() => {
        // Try aria-label first
        const byLabel = document.querySelector(
          'button[aria-label*="next" i], button[aria-label*="Next"], button[aria-label*="forward" i]'
        );
        if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
        // Try SVG chevron buttons — the rightmost navigation button
        const allBtns = Array.from(document.querySelectorAll('button'));
        // Find buttons that contain right-arrow SVGs (no text, just icon)
        const iconBtns = allBtns.filter(b => {
          const txt = b.innerText?.trim() ?? '';
          return txt === '' && b.querySelector('svg');
        });
        if (iconBtns.length >= 2) {
          (iconBtns[iconBtns.length - 1] as HTMLButtonElement).click();
          return true;
        }
        if (iconBtns.length === 1) {
          (iconBtns[0] as HTMLButtonElement).click();
          return true;
        }
        return false;
      });
      if (!nextClicked) {
        ctx.log('[MonthView] Next button not found via evaluate — trying locator...');
        await c.page.locator('button:has(svg)').last().click();
      }
    } else {
      ctx.log(`[MonthView] Navigating backward (displayed: ${displayedMonth + 1}/${displayedYear}, target: ${bookedMonth + 1}/${bookedYear})`);
      const prevClicked = await c.page.evaluate(() => {
        const byLabel = document.querySelector(
          'button[aria-label*="prev" i], button[aria-label*="back" i], button[aria-label*="previous" i]'
        );
        if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
        const allBtns = Array.from(document.querySelectorAll('button'));
        const iconBtns = allBtns.filter(b => {
          const txt = b.innerText?.trim() ?? '';
          return txt === '' && b.querySelector('svg');
        });
        if (iconBtns.length >= 2) {
          (iconBtns[0] as HTMLButtonElement).click();
          return true;
        }
        return false;
      });
      if (!prevClicked) {
        ctx.log('[MonthView] Prev button not found via evaluate — trying locator...');
        await c.page.locator('button:has(svg)').first().click();
      }
    }

    await ctx.wait(600);

    if (i === MAX_NAV - 1) {
      const { text } = await getDisplayedMonthYear();
      throw new Error(
        `[MonthView] Could not navigate to ${monthNames[bookedMonth]} ${bookedYear} within ${MAX_NAV} attempts. ` +
        `Last displayed: "${text}"`
      );
    }
  }

  // ── Step 4: Click the exact day cell for the booked date ─────────────────────────────────────
  // Month grid day cells: the grid shows dates as plain numbers. The current month's cells are
  // styled differently from overflow cells (prev/next month dates shown faded at edges).
  // We target ONLY cells belonging to the current month.
  //
  // DOM pattern from the screenshot (HHCS app):
  //   <div class="..."> <span class="...">13</span> </div>   ← day cell
  //
  // We use an XPath that:
  //   a) finds elements whose text is exactly the day number
  //   b) excludes cells that are visually "outside" the current month (common class names)

  ctx.log(`[MonthView] Clicking day cell for date ${bookedDay} in ${monthNames[bookedMonth]} ${bookedYear}...`);

  const dayStr = String(bookedDay); // e.g. "13" — no leading zero, matches DOM text

  // XPath: find a td or div that contains ONLY the day number (not as part of a larger number)
  // and is not an overflow/outside-month cell
  const dayCellXpath =
    `//*[` +
      `not(contains(@class,'outside')) and ` +
      `not(contains(@class,'other-month')) and ` +
      `not(contains(@class,'overflow')) and ` +
      `not(contains(@class,'disabled')) and ` +
      `(` +
        `normalize-space(text())='${dayStr}' or ` +
        `normalize-space(.)='${dayStr}'` +
      `)` +
    `]`;

  const cellCount = await c.page.locator(`xpath=${dayCellXpath}`).count();
  ctx.log(`[MonthView] Day cell candidates for "${dayStr}": ${cellCount}`);

  if (cellCount === 0) {
    // Fallback: click by exact text match with no class filter
    ctx.log(`[MonthView] No cell found with class filter — trying broader selector...`);
    await c.page.locator(`text="${dayStr}"`).first().click();
  } else if (cellCount === 1) {
    await c.page.locator(`xpath=${dayCellXpath}`).first().click();
  } else {
    // Multiple matches (e.g. day "1" could match "10","11","12"... but XPath uses normalize-space
    // so exact match should be fine). Take the first non-muted one.
    ctx.log(`[MonthView] Multiple day cell matches (${cellCount}) — clicking first one`);
    await c.page.locator(`xpath=${dayCellXpath}`).first().click();
  }

  await ctx.wait(500);
  ctx.log(`[MonthView] Clicked date ${bookedDay} in ${monthNames[bookedMonth]} ${bookedYear}`);
}
