import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get system date in format ${dateFormat} and store padded in $[paddedDate] and unpadded in $[unpaddedDate]
 * actionType: custom_get_date_and_store
 * context: web
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${dateFormat}
  //   — format only:           "DD-MM-YYYY"        → current date
  //   — format with offset:    "DD-MM-YYYY +1"     → tomorrow
  //                            "DD-MM-YYYY +2"     → day after tomorrow
  //                            "DD-MM-YYYY -1"     → yesterday
  // ctx.args[1] = name from $[paddedDate]    — stores zero-padded date  e.g. "09-06-2026"
  // ctx.args[2] = name from $[unpaddedDate]  — stores non-padded date   e.g. "9-6-2026"
  //
  // Calendar DOM (optional — clicked if a calendar grid is visible on the page):
  //
  //   <div class="grid grid-cols-7 gap-y-1">
  //     <div></div>  ← empty offset cells for first-week alignment
  //     <button type="button" disabled
  //       class="h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors
  //              flex items-center justify-center text-gray-300 cursor-not-allowed">1</button>
  //     ...
  //     <button type="button"
  //       class="h-8 w-8 mx-auto rounded-full text-xs font-medium transition-colors
  //              flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-100">14</button>
  //   </div>
  //
  //   Month/year header: any element whose text matches "MMM YYYY" e.g. "JUN 2026"
  //   Prev/Next nav:     <button> containing "<" / ">" (arrow buttons beside the header)
  //
  //   Available day  = <button> NOT disabled, text = day number (1–31)
  //   Past/disabled  = <button disabled class="... cursor-not-allowed text-gray-300">
  //   Today marker   = ring/border styling (detected visually, not used for click logic)
  //   Selected       = filled dark background (e.g. bg-[#3279AD])
  //
  // If no calendar grid is detected on the page, only the variable-store logic runs (old behaviour).

  const rawInput        = String(ctx.args[0] ?? 'DD-MM-YYYY').trim();
  const paddedVarName   = String(ctx.args[1]);
  const unpaddedVarName = String(ctx.args[2]);

  // ── Parse format and offset (unchanged) ──────────────────────────────────────────────────────
  // Split "DD-MM-YYYY +1" into format="DD-MM-YYYY" and offset=1
  const tokens = rawInput.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? '';
  let format: string;
  let offset: number;

  if (/^[+-]\d+$/.test(lastToken)) {
    format = tokens.slice(0, -1).join(' ').trim();
    offset = parseInt(lastToken, 10);
  } else {
    format = rawInput;
    offset = 0;
  }

  // ── Compute target date (unchanged) ──────────────────────────────────────────────────────────
  const date = new Date();
  date.setDate(date.getDate() + offset);

  // Zero-padded components
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy   = yyyy.slice(-2);

  // Non-padded components (no leading zeros)
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1);

  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mmm  = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesFull[date.getMonth()];

  // Apply format — single-pass regex replacement to avoid cascade/overlap issues.
  // Alternation order ensures longer tokens (YYYY, MMMM, MMM) are always tried
  // before their shorter overlapping counterparts (YY, MM).
  function applyFormat(padded: boolean): string {
    const tokenMap: Record<string, string> = {
      'YYYY': yyyy,
      'YY':   yy,
      'MMMM': mmmm,
      'MMM':  mmm,
      'MM':   padded ? mm : m,
      'DD':   padded ? dd : d,
    };
    return format.toUpperCase().replace(
      /YYYY|YY|MMMM|MMM|MM|DD/g,
      (token) => tokenMap[token] ?? token
    );
  }

  const paddedFormatted   = applyFormat(true);   // e.g. "09-06-2026"
  const unpaddedFormatted = applyFormat(false);  // e.g. "9-6-2026"

  const label = offset === 0 ? 'today' : `today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[GetDateAndStore] input: "${rawInput}" → format: "${format}", offset: ${offset} (${label})`);
  ctx.log(`[GetDateAndStore] padded: "${paddedFormatted}" → $[${paddedVarName}]`);
  ctx.log(`[GetDateAndStore] unpadded: "${unpaddedFormatted}" → $[${unpaddedVarName}]`);

  // ── Store variables (unchanged) ───────────────────────────────────────────────────────────────
  ctx.setVariable(paddedVarName, paddedFormatted);
  ctx.setVariable(unpaddedVarName, unpaddedFormatted);

  // ── Calendar DOM interaction (new — only runs if a calendar grid is present) ─────────────────
  //
  // Target date components for calendar navigation
  const targetDay   = date.getDate();       // e.g. 13
  const targetMonth = date.getMonth();      // 0-based, e.g. 5 = June
  const targetYear  = date.getFullYear();   // e.g. 2026
  const targetMonthShort = monthNamesShort[targetMonth].toUpperCase(); // e.g. "JUN"

  const c = ctx as any;

  // Detect whether a calendar grid (grid-cols-7) is present on the page
  const calendarPresent: boolean = await c.page.evaluate(() => {
    // Look for a grid with 7 columns containing day-number buttons (1–31)
    const grids = Array.from(document.querySelectorAll('div[class*="grid-cols-7"]'));
    return grids.some((grid: any) => {
      const buttons = Array.from(grid.querySelectorAll('button'));
      return buttons.some((btn: any) => /^\d{1,2}$/.test((btn.textContent ?? '').trim()));
    });
  });

  if (!calendarPresent) {
    ctx.log('[GetDateAndStore] No calendar grid detected — skipping calendar click');
    return;
  }

  ctx.log(`[GetDateAndStore] Calendar detected — navigating to ${targetMonthShort} ${targetYear}, day ${targetDay}`);

  // Navigate the calendar to the correct month/year (max 24 steps to avoid infinite loop)
  for (let i = 0; i < 24; i++) {
    // Read the current month/year header text
    // Header format: "JUN 2026" — any element whose trimmed text matches "MMM YYYY"
    const headerInfo: { text: string; month: string; year: number } | null =
      await c.page.evaluate(() => {
        // Common header selectors: button with chevron/caret, or a heading element
        const allElements = Array.from(document.querySelectorAll(
          'button, h1, h2, h3, h4, h5, h6, span, div, p'
        )) as HTMLElement[];
        for (const el of allElements) {
          const text = (el.textContent ?? '').trim();
          // Match "JUN 2026" or "June 2026" style
          const match = text.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
          if (match) {
            return { text, month: match[1].toUpperCase().slice(0, 3), year: parseInt(match[2], 10) };
          }
        }
        return null;
      });

    if (!headerInfo) {
      ctx.log('[GetDateAndStore] Could not read calendar header — aborting calendar navigation');
      break;
    }

    const headerMonthIdx = monthNamesShort.findIndex(
      s => s.toUpperCase() === headerInfo.month
    );

    ctx.log(`[GetDateAndStore] Calendar header: "${headerInfo.text}" (month idx ${headerMonthIdx}, year ${headerInfo.year})`);

    const diff = (targetYear - headerInfo.year) * 12 + (targetMonth - headerMonthIdx);

    if (diff === 0) {
      // Correct month — stop navigating
      break;
    }

    // Click the appropriate nav arrow
    // Prev arrow: button containing "<" or "‹" or an SVG pointing left, near the header
    // Next arrow: button containing ">" or "›" or an SVG pointing right, near the header
    const direction = diff > 0 ? 'next' : 'prev';
    ctx.log(`[GetDateAndStore] Navigating ${direction} (diff=${diff})`);

    const navClicked: boolean = await c.page.evaluate((dir: string) => {
      // Find nav buttons by their text content or aria-label
      const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
      const candidates = buttons.filter(btn => {
        const text = (btn.textContent ?? '').trim();
        const label = (btn.getAttribute('aria-label') ?? '').toLowerCase();
        if (dir === 'next') {
          return text === '>' || text === '›' || text === '»' ||
                 label.includes('next') || label.includes('forward') ||
                 // SVG-only buttons: check if it's a small button near position > 50% width
                 (text === '' && btn.querySelector('svg') !== null &&
                  btn.getBoundingClientRect().left > window.innerWidth * 0.5);
        } else {
          return text === '<' || text === '‹' || text === '«' ||
                 label.includes('prev') || label.includes('back') ||
                 (text === '' && btn.querySelector('svg') !== null &&
                  btn.getBoundingClientRect().left < window.innerWidth * 0.5);
        }
      });
      if (candidates.length === 0) return false;
      candidates[0].click();
      return true;
    }, direction);

    if (!navClicked) {
      ctx.log(`[GetDateAndStore] Could not find ${direction} nav button — aborting`);
      break;
    }

    await c.wait(300);
  }

  // Click the target day button in the calendar grid
  // Day button: <button> inside grid-cols-7, text = exact day number (e.g. "13"), NOT disabled
  const dayClicked: boolean = await c.page.evaluate((day: number) => {
    const grids = Array.from(document.querySelectorAll('div[class*="grid-cols-7"]'));
    for (const grid of grids) {
      const buttons = Array.from(grid.querySelectorAll('button')) as HTMLButtonElement[];
      for (const btn of buttons) {
        const text = (btn.textContent ?? '').trim();
        if (text === String(day) && !btn.disabled) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  }, targetDay);

  if (dayClicked) {
    ctx.log(`[GetDateAndStore] Clicked day ${targetDay} on calendar`);
  } else {
    ctx.log(`[GetDateAndStore] Could not click day ${targetDay} — button not found or disabled`);
  }
}
