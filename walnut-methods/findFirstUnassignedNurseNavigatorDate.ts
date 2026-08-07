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
      // Helper: get text from an element — innerText first (requires layout), then textContent
      // (layout-independent). This handles cases where the grid has rendered in the DOM but
      // the browser hasn't yet performed layout (innerText returns "" in that state).
      function getText(el: Element): string {
        return ((el as HTMLElement).innerText?.trim() ||
                (el as HTMLElement).textContent?.trim() || '').toLowerCase();
      }

      // Find all <button> elements that look like calendar date cards.
      // Active date cards are <button> elements (disabled/past dates are <div> with opacity-60).
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
        // Must have child spans (day-of-week headers have no spans; date cards always do)
        if (btn.querySelectorAll('span').length === 0) return false;
        return true;
      });

      // Among active date card buttons, find the first Unassigned one.
      // Detection uses TWO independent signals — either one is sufficient:
      //   1. Text content contains "unassigned" (innerText OR textContent fallback)
      //   2. CSS class contains "bg-red-50" (the Unassigned card colour from the DOM)
      for (const btn of dateCardButtons) {
        const cls = btn.getAttribute('class') ?? '';
        const fullText = getText(btn);
        const isUnassigned =
          fullText.includes('unassigned') ||
          cls.includes('bg-red-50') ||
          cls.includes('border-red-200');

        if (!isUnassigned) continue;

        // Extract the date number — it's in the first <span> whose text is purely numeric
        const spans = Array.from(btn.querySelectorAll('span'));
        let dateNumber = '';
        for (const span of spans) {
          const t = (getText(span)).trim();
          if (/^\d{1,2}$/.test(t)) {
            dateNumber = t;
            break;
          }
        }
        if (dateNumber) {
          return { dateNumber };
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

  let previousHeader = '';

  for (let monthsSearched = 0; monthsSearched < MAX_MONTHS; monthsSearched++) {

    // ── Step A: wait for the calendar header to stabilize ──────────────────
    // After navigation the header updates first; the date card grid re-renders
    // slightly later. We poll until the header is non-empty AND different from
    // the previous month (confirms the DOM has fully transitioned).
    let currentHeader = '';
    for (let poll = 0; poll < 20; poll++) {
      currentHeader = await getCalendarHeaderText();
      if (currentHeader && currentHeader !== previousHeader) break;
      await c.wait(300);
    }

    if (!currentHeader) {
      throw new Error(
        '[NurseNavCalendar] Calendar header not found. ' +
        'Ensure the Nurse Navigator Allocation tab is open and the calendar is visible.'
      );
    }

    // ── Step B: wait for the NEW month's grid to fully replace the old one ──
    // Root cause: after clicking Next, the old month's buttons remain in the DOM
    // while React re-renders. Any "do buttons exist?" check passes immediately on
    // stale data. The only reliable signal the new grid has loaded is finding a
    // button whose first numeric span is "1" (day 1 exists in every month).
    // We use page.waitForFunction — a native Playwright poll — for reliability.
    if (monthsSearched > 0) {
      try {
        await c.page.waitForFunction(
          (expectedHeader: string) => {
            // Confirm header already matches the new month
            const spans = Array.from(document.querySelectorAll('span'));
            const header = spans.find(s => /^[A-Za-z]+ \d{4}$/.test((s as HTMLElement).innerText?.trim() ?? ''));
            if (!header) return false;
            if ((header as HTMLElement).innerText?.trim() !== expectedHeader) return false;

            // Confirm day "1" button is present in the new grid
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(btn => {
              const cls = btn.getAttribute('class') ?? '';
              if (!cls.includes('min-h-')) return false;
              const btnSpans = Array.from(btn.querySelectorAll('span'));
              return btnSpans.some(sp => (sp as HTMLElement).textContent?.trim() === '1');
            });
          },
          currentHeader,
          { timeout: 10000 }
        );
      } catch (_) {
        // waitForFunction timed out — calendar may not have day "1" visible (e.g. starts on week 2)
        // Fall back to a plain 1500ms wait and proceed anyway
        ctx.warn(`[NurseNavCalendar] waitForFunction timed out for "${currentHeader}" — falling back to 1500ms wait`);
        await c.wait(1500);
      }
    }

    ctx.log(`[NurseNavCalendar] Scanning month: "${currentHeader}" (attempt ${monthsSearched + 1}/${MAX_MONTHS})`);

    // ── Step C: scan for first active Unassigned date ─────────────────────
    const found = await scanForFirstUnassignedDate();

    if (found) {
      // ── Found an Unassigned date ─────────────────────────────────────────
      const headerParts = currentHeader.trim().split(' ');
      const monthName = headerParts[0] ?? '';
      const monthShort = toThreeLetterMonth(monthName); // e.g. "SEP"
      const dateNumber = found.dateNumber;               // e.g. "21"

      ctx.log(`[NurseNavCalendar] Found first active Unassigned date: ${monthShort} ${dateNumber}`);

      ctx.setVariable(monthVarName, monthShort);
      ctx.setVariable(dateVarName, dateNumber);

      ctx.log(`[NurseNavCalendar] Stored "${monthShort}" in $[${monthVarName}]`);
      ctx.log(`[NurseNavCalendar] Stored "${dateNumber}" in $[${dateVarName}]`);
      return;
    }

    // ── Step D: no Unassigned date — navigate to next month ───────────────
    ctx.log(`[NurseNavCalendar] No active Unassigned date found in "${currentHeader}" — navigating to next month...`);
    previousHeader = currentHeader;

    await clickNextMonth();

    // Brief initial pause; the header-poll in Step A will wait for the rest.
    await c.wait(400);
  }

  // ── Exhausted MAX_MONTHS without finding an Unassigned date ───────────────────────────────────
  throw new Error(
    `[NurseNavCalendar] No active Unassigned date found after scanning ${MAX_MONTHS} months. ` +
    `All dates in the next ${MAX_MONTHS} months are either Assigned, Override, past, or disabled.`
  );
}
