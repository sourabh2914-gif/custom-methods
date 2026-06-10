import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Select Date From Calendar Picker
 * description: Select date ${date} (dd/MM/yyyy) in calendar picker inside ${containerSelector}
 * actionType: custom_select_date_from_calendar
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function selectDateFromDropdowns(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date}              — date string in dd/MM/yyyy format, e.g. "25/12/2026"
  // ctx.args[1] = value of ${containerSelector} — CSS selector of the calendar container element

  const c = ctx as any; // cast to any — web-only methods (evaluate/click/wait) not on union type

  const dateInput         = String(c.args[0] ?? '').trim();
  const containerSelector = String(c.args[1] ?? '').trim();

  // ── Step 1: Parse dd/MM/yyyy ──────────────────────────────────────────────
  const parts = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) {
    throw new Error(
      `[SelectDateFromCalendar] Invalid date format: "${dateInput}". Expected dd/MM/yyyy (e.g. 25/12/2026).`
    );
  }

  const targetDay   = parseInt(parts[1], 10);
  const targetMonth = parseInt(parts[2], 10); // 1-indexed
  const targetYear  = parseInt(parts[3], 10);

  if (targetMonth < 1 || targetMonth > 12) {
    throw new Error(`[SelectDateFromCalendar] Month out of range: ${targetMonth}. Must be 01–12.`);
  }
  if (targetDay < 1 || targetDay > 31) {
    throw new Error(`[SelectDateFromCalendar] Day out of range: ${targetDay}. Must be 01–31.`);
  }

  // Month names as they appear in the header button (e.g. "JUN 2026")
  const monthNamesShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const targetMonthShort = monthNamesShort[targetMonth - 1]; // e.g. "DEC"
  const targetHeaderText = `${targetMonthShort} ${targetYear}`; // e.g. "DEC 2026"

  c.log(`[SelectDateFromCalendar] Target: day=${targetDay}, month=${targetMonthShort}, year=${targetYear}`);
  c.log(`[SelectDateFromCalendar] Looking for header: "${targetHeaderText}"`);

  // ── Step 2: Read the currently displayed month/year from the header button ─
  // The header button text looks like "JUN 2026"
  const getHeaderText = async (): Promise<string> => {
    const text: string = await c.evaluate(`
      (() => {
        const container = document.querySelector(${JSON.stringify(containerSelector)});
        if (!container) return '';
        const buttons = Array.from(container.querySelectorAll('button'));
        for (const btn of buttons) {
          const t = btn.innerText.trim().toUpperCase();
          if (/^[A-Z]{3}\\s+\\d{4}$/.test(t)) return t;
        }
        return '';
      })()
    `);
    return (text ?? '').trim().toUpperCase();
  };

  // ── Step 3: Parse header into numeric month/year for navigation ───────────
  const parseHeader = (header: string): { month: number; year: number } | null => {
    const m = header.match(/^([A-Z]{3})\s+(\d{4})$/);
    if (!m) return null;
    const monthIdx = monthNamesShort.indexOf(m[1]);
    if (monthIdx === -1) return null;
    return { month: monthIdx + 1, year: parseInt(m[2], 10) };
  };

  // ── Step 4: Navigate to the target month/year ─────────────────────────────
  const getMonthDiff = (current: { month: number; year: number }): number => {
    return (targetYear - current.year) * 12 + (targetMonth - current.month);
  };

  // Header row structure: [prev-btn] [month-year-btn] [next-btn]
  const prevButtonSelector = `${containerSelector} div:first-child button:first-of-type`;
  const nextButtonSelector = `${containerSelector} div:first-child button:last-of-type`;

  let maxAttempts = 60; // safety cap — max 5 years of navigation
  let navigated = false;
  while (maxAttempts-- > 0) {
    const headerText = await getHeaderText();
    if (!headerText) {
      throw new Error(
        `[SelectDateFromCalendar] Could not read calendar header inside "${containerSelector}". ` +
        `Verify the container selector is correct and the calendar is visible.`
      );
    }

    c.log(`[SelectDateFromCalendar] Current header: "${headerText}"`);

    const current = parseHeader(headerText);
    if (!current) {
      throw new Error(`[SelectDateFromCalendar] Could not parse header text: "${headerText}"`);
    }

    const diff = getMonthDiff(current);
    if (diff === 0) {
      c.log(`[SelectDateFromCalendar] Reached target month: ${headerText}`);
      navigated = true;
      break;
    }

    if (diff > 0) {
      c.log(`[SelectDateFromCalendar] Navigating forward (${diff} month(s) to go)...`);
      await c.click(nextButtonSelector);
    } else {
      c.log(`[SelectDateFromCalendar] Navigating backward (${Math.abs(diff)} month(s) to go)...`);
      await c.click(prevButtonSelector);
    }
    await c.wait(250);
  }

  if (!navigated) {
    throw new Error(`[SelectDateFromCalendar] Navigation timeout — could not reach ${targetMonthShort} ${targetYear}.`);
  }

  // ── Step 5: Click the target day button ───────────────────────────────────
  c.log(`[SelectDateFromCalendar] Clicking day: ${targetDay}`);

  const targetDayStr = String(targetDay); // e.g. "25" — interpolated into the evaluate string below
  const dayClicked: boolean = await c.evaluate(`
    (() => {
      const container = document.querySelector(${JSON.stringify(containerSelector)});
      if (!container) return false;
      const buttons = Array.from(container.querySelectorAll('button:not([disabled])'));
      for (const btn of buttons) {
        const text = btn.innerText.trim();
        if (text === ${JSON.stringify(targetDayStr)}) {
          btn.click();
          return true;
        }
      }
      return false;
    })()
  `);

  if (!dayClicked) {
    throw new Error(
      `[SelectDateFromCalendar] Day "${targetDay}" not found or is disabled in the calendar. ` +
      `The date ${dateInput} may be in the past or otherwise unavailable.`
    );
  }

  await c.wait(200);
  c.log(`[SelectDateFromCalendar] Successfully selected date: ${dateInput}`);
}
