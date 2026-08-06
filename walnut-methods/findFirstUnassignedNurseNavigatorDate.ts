import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Find First Unassigned Nurse Navigator Date
 * description: Scan the Nurse Navigator Allocation calendar and store the first active Unassigned date month in $[firstUnassignedMonth] and date number in $[firstUnassignedDate]
 * actionType: custom_find_first_unassigned_nurse_navigator_date
 * context: web
 * needsLocator: false
 * category: Nurse Navigator
 */
export async function findFirstUnassignedNurseNavigatorDate(ctx: WalnutContext) {
  // ctx.args[0] = "firstUnassignedMonth" (from $[firstUnassignedMonth]) — runtime variable name
  //   Stores the month as first 3 letters uppercase, e.g. "AUG", "SEP", "OCT"
  // ctx.args[1] = "firstUnassignedDate" (from $[firstUnassignedDate]) — runtime variable name
  //   Stores the date number as a string, e.g. "6", "15", "28"
  //
  // DOM structure (from screenshots):
  //
  //   Calendar header:
  //     <span class="text-base font-semibold text-text-color">September 2026</span>
  //
  //   Next month nav button:
  //     <button aria-label="Next month">...</button>
  //
  //   Active (clickable) date card — a <button> element:
  //     <button class="min-h-[48px] sm:min-h-[64px] rounded-lg border p-1 sm:p-1.5 text-left transition-all
  //                    w-full bg-red-50 border-red-200 text-red-500 hover:opacity-80">
  //       <span class="text-xs font-semibold block mb-0.5">21</span>
  //       <span class="text-[10px] text-red-400">Unassigned</span>
  //     </button>
  //
  //   Disabled / past date — a <div> element (NOT a button) with opacity-60:
  //     <div class="min-h-[64px] rounded-lg border border-gray-100 bg-gray-50 p-1.5 opacity-60"></div>
  //
  // Detection rules:
  //   - Active dates = <button> elements that contain "min-h-[48px]" OR "min-h-[64px]" in their class
  //                    AND are NOT disabled (no @disabled attribute, no opacity-60 class)
  //   - Unassigned   = active button whose inner text contains "Unassigned"
  //                    (also has bg-red-50 / border-red-200 classes, but text match is most reliable)
  //   - Date number  = the text of the first <span> child inside the button (the numeric date)
  //
  // Algorithm:
  //   1. Evaluate the current calendar month DOM for the first active Unassigned button
  //   2. If found → extract month from header, extract date number, store both, done
  //   3. If not found → click "Next month" button, wait for calendar to re-render, repeat
  //   4. Loop runs up to MAX_MONTHS times (safety guard — prevents infinite loop)

  const c = ctx as any;

  const monthVarName = ctx.args[0]; // e.g. "firstUnassignedMonth"
  const dateVarName  = ctx.args[1]; // e.g. "firstUnassignedDate"

  const MAX_MONTHS = 24; // search at most 24 months forward

  // ── Helper: read the currently displayed month/year text from the calendar header ──────────────
  // The header span contains text like "September 2026"
  async function getCalendarHeaderText(): Promise<string> {
    const text: string = await c.page.evaluate(() => {
      // Strategy 1: span with font-semibold that matches "Month YYYY" or "Month YYYY" pattern
      const spans = Array.from(document.querySelectorAll('span'));
      for (const span of spans) {
        const t = (span as HTMLElement).innerText?.trim() ?? '';
        if (/^[A-Za-z]+ \d{4}$/.test(t)) return t;
      }
      // Strategy 2: any element whose visible text matches "Month YYYY"
      const all = Array.from(document.querySelectorAll('button, div, h1, h2, h3, h4, p'));
      for (const el of all) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        if (/^[A-Za-z]+ \d{4}$/.test(t)) return t;
      }
      return '';
    });
    return (text ?? '').trim();
  }

  // ── Helper: convert a full/short month name to its first 3 uppercase letters ────────────────
  // e.g. "September" → "SEP", "Aug" → "AUG"
  function toThreeLetterMonth(monthName: string): string {
    return monthName.trim().toUpperCase().slice(0, 3);
  }

  // ── Helper: scan the current calendar month for the first active Unassigned date ────────────
  // Returns { dateNumber: string } if found, null if not found.
  async function scanForFirstUnassignedDate(): Promise<{ dateNumber: string } | null> {
    const result: { dateNumber: string } | null = await c.page.evaluate(() => {
      // Find all <button> elements that look like calendar date cards.
      // Active date cards are <button> elements (disabled/past dates are <div> elements).
      // We identify calendar date buttons by their characteristic Tailwind classes:
      //   - contain "min-h-" in the class (min-h-[48px] or min-h-[64px])
      //   - are <button> elements (not divs)
      //   - do NOT have the @disabled attribute
      //   - do NOT have "opacity-60" in their class (extra guard for any disabled variants)
      const allButtons = Array.from(document.querySelectorAll('button'));

      const dateCardButtons = allButtons.filter(btn => {
        const cls = btn.getAttribute('class') ?? '';
        // Must have the min-h- class that date cards use
        if (!cls.includes('min-h-')) return false;
        // Must NOT be disabled via attribute
        if (btn.hasAttribute('disabled')) return false;
        // Must NOT have opacity-60 (past/disabled styling)
        if (cls.includes('opacity-60')) return false;
        // Must NOT be a day-of-week header (those don't contain date numbers)
        // Day headers only have short text like "Sun", "Mon" — they don't have child spans
        const spans = btn.querySelectorAll('span');
        if (spans.length === 0) return false;
        return true;
      });

      // Among active date card buttons, find the first one whose text includes "Unassigned"
      for (const btn of dateCardButtons) {
        const fullText = (btn as HTMLElement).innerText?.trim() ?? '';
        if (fullText.toLowerCase().includes('unassigned')) {
          // Extract the date number — it's in the first <span> child
          // which contains only the numeric day (e.g. "21")
          const spans = Array.from(btn.querySelectorAll('span'));
          let dateNumber = '';
          for (const span of spans) {
            const t = (span as HTMLElement).innerText?.trim() ?? '';
            // Date number: pure numeric, 1-2 digits
            if (/^\d{1,2}$/.test(t)) {
              dateNumber = t;
              break;
            }
          }
          if (dateNumber) {
            return { dateNumber };
          }
        }
      }

      return null;
    });

    return result;
  }

  // ── Helper: click the "Next month" navigation button ─────────────────────────────────────────
  async function clickNextMonth(): Promise<void> {
    // Strategy 1: aria-label="Next month"
    const nextByLabel = c.page.locator('button[aria-label="Next month"]');
    const labelCount: number = await nextByLabel.count();
    if (labelCount > 0) {
      await nextByLabel.first().click();
      ctx.log('[NurseNavCalendar] Clicked Next month button (aria-label="Next month")');
      return;
    }

    // Strategy 2: aria-label containing "next" (case-insensitive)
    const nextByPartialLabel = c.page.locator('button[aria-label*="next" i], button[aria-label*="Next"]');
    const partialLabelCount: number = await nextByPartialLabel.count();
    if (partialLabelCount > 0) {
      await nextByPartialLabel.first().click();
      ctx.log('[NurseNavCalendar] Clicked Next month button (aria-label partial match)');
      return;
    }

    // Strategy 3: evaluate — find the header span, walk up to its container, find the last
    //              icon-only button (no text) which is the "next" arrow
    const clicked: boolean = await c.page.evaluate(() => {
      // Find the calendar header span (text matches "Month YYYY")
      const spans = Array.from(document.querySelectorAll('span'));
      let headerEl: Element | null = null;
      for (const span of spans) {
        const t = (span as HTMLElement).innerText?.trim() ?? '';
        if (/^[A-Za-z]+ \d{4}$/.test(t)) {
          headerEl = span;
          break;
        }
      }
      if (!headerEl) return false;

      // Walk up to a container that also holds nav buttons
      let container: Element | null = headerEl.parentElement;
      for (let depth = 0; depth < 5 && container; depth++) {
        const navBtns = Array.from(container.querySelectorAll('button')).filter(btn => {
          const txt = (btn as HTMLElement).innerText?.trim() ?? '';
          const label = (btn.getAttribute('aria-label') ?? '').toLowerCase();
          // Icon-only buttons (empty text) or buttons with nav aria-labels
          return txt.length === 0 ||
            label.includes('next') ||
            label.includes('forward') ||
            btn.querySelector('svg') !== null;
        });

        // Filter out buttons that contain the "Today" text
        const pureNavBtns = navBtns.filter(btn => {
          const txt = (btn as HTMLElement).innerText?.trim() ?? '';
          return !txt.toLowerCase().includes('today') && txt.length < 5;
        });

        if (pureNavBtns.length >= 2) {
          // The last one is the "next" arrow
          (pureNavBtns[pureNavBtns.length - 1] as HTMLButtonElement).click();
          return true;
        }
        container = container.parentElement;
      }
      return false;
    });

    if (!clicked) {
      // Final fallback: find all SVG icon buttons near the calendar header area
      // and click the last one (right arrow)
      ctx.warn('[NurseNavCalendar] Could not find Next month button via label — using last SVG icon button near header');
      const svgBtns = c.page.locator('button:has(svg)');
      const svgCount: number = await svgBtns.count();
      if (svgCount >= 2) {
        // Find the two smallest (icon-only) buttons — they are prev/next
        // Use last of the first two icon buttons visible near the calendar header
        await svgBtns.nth(svgCount - 1).click();
      } else {
        throw new Error('[NurseNavCalendar] Could not locate the "Next month" navigation button.');
      }
    }
  }

  // ── Main loop: search current month, navigate forward if not found ────────────────────────────
  ctx.log('[NurseNavCalendar] Starting search for first active Unassigned date...');

  for (let monthsSearched = 0; monthsSearched < MAX_MONTHS; monthsSearched++) {
    // Wait a moment for the calendar to fully render (especially after navigation)
    if (monthsSearched > 0) {
      await c.wait(800);
    }

    // Read the current month header
    const headerText = await getCalendarHeaderText();
    if (!headerText) {
      ctx.warn(`[NurseNavCalendar] Could not read calendar header on attempt ${monthsSearched + 1} — waiting and retrying...`);
      await c.wait(500);
      const retryHeader = await getCalendarHeaderText();
      if (!retryHeader) {
        throw new Error(
          '[NurseNavCalendar] Calendar header not found. ' +
          'Ensure the Nurse Navigator Allocation tab is open and the calendar is visible.'
        );
      }
    }

    const currentHeader = await getCalendarHeaderText();
    ctx.log(`[NurseNavCalendar] Scanning month: "${currentHeader}" (attempt ${monthsSearched + 1}/${MAX_MONTHS})`);

    // Scan for first active Unassigned date in this month
    const found = await scanForFirstUnassignedDate();

    if (found) {
      // ── Found an Unassigned date ─────────────────────────────────────────
      // Extract month name from header (e.g. "September 2026" → "September")
      const headerParts = currentHeader.trim().split(' ');
      const monthName = headerParts[0] ?? '';
      const monthShort = toThreeLetterMonth(monthName); // e.g. "SEP"
      const dateNumber = found.dateNumber;               // e.g. "21"

      ctx.log(`[NurseNavCalendar] Found first active Unassigned date: ${monthShort} ${dateNumber}`);

      // Store in runtime variables
      ctx.setVariable(monthVarName, monthShort);
      ctx.setVariable(dateVarName, dateNumber);

      ctx.log(`[NurseNavCalendar] Stored "${monthShort}" in $[${monthVarName}]`);
      ctx.log(`[NurseNavCalendar] Stored "${dateNumber}" in $[${dateVarName}]`);
      return;
    }

    // ── No Unassigned date found in this month — navigate to next month ────
    ctx.log(`[NurseNavCalendar] No active Unassigned date found in "${currentHeader}" — navigating to next month...`);

    await clickNextMonth();

    // Wait for calendar to re-render after navigation
    await c.wait(600);

    // Verify the header changed (confirms navigation succeeded)
    const newHeader = await getCalendarHeaderText();
    if (newHeader === currentHeader) {
      // Header didn't change — wait a bit more and check again
      await c.wait(800);
      const retryHeader = await getCalendarHeaderText();
      if (retryHeader === currentHeader) {
        ctx.warn(`[NurseNavCalendar] Calendar header did not change after clicking Next month (still "${currentHeader}"). Retrying click...`);
        await clickNextMonth();
        await c.wait(1000);
      }
    }
  }

  // ── Exhausted MAX_MONTHS without finding an Unassigned date ───────────────────────────────────
  throw new Error(
    `[NurseNavCalendar] No active Unassigned date found after scanning ${MAX_MONTHS} months. ` +
    `All dates in the next ${MAX_MONTHS} months are either Assigned, Override, past, or disabled.`
  );
}
