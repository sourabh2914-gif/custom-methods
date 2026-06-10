import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Select Date From Calendar Picker
 * description: Select date ${date} (dd/MM/yyyy) in calendar picker
 * actionType: custom_select_date_from_calendar
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function selectDateFromDropdowns(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date} — date string in dd/MM/yyyy format, e.g. "25/12/2026"

  const c = ctx as any; // cast to any — web-only methods (evaluate/click/wait) not on union type

  const dateInput = String(c.args[0] ?? '').trim();

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

  const monthNamesShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const targetMonthShort = monthNamesShort[targetMonth - 1]; // e.g. "DEC"

  c.log(`[SelectDateFromCalendar] Target: day=${targetDay}, month=${targetMonthShort}, year=${targetYear}`);

  // ── Step 2: Auto-detect the calendar by finding the MMM YYYY header button ─
  // Scans all buttons on the page for one whose text matches "JUN 2026" pattern.
  // Returns an XPath-style unique selector for the calendar's root container.
  const getHeaderText = async (): Promise<string> => {
    const text: string = await c.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const t = btn.innerText.trim().toUpperCase();
          if (/^[A-Z]{3}\\s+\\d{4}$/.test(t)) return t;
        }
        return '';
      })()
    `);
    return (text ?? '').trim().toUpperCase();
  };

  // ── Step 3: Parse header into numeric month/year ──────────────────────────
  const parseHeader = (header: string): { month: number; year: number } | null => {
    const m = header.match(/^([A-Z]{3})\s+(\d{4})$/);
    if (!m) return null;
    const monthIdx = monthNamesShort.indexOf(m[1]);
    if (monthIdx === -1) return null;
    return { month: monthIdx + 1, year: parseInt(m[2], 10) };
  };

  // ── Step 4: Navigate to the target month/year ─────────────────────────────
  // Auto-detect prev/next buttons: find the header button, then its siblings.
  // Header button is the one with "MMM YYYY" text — prev is the button before it,
  // next is the button after it in the same parent container.
  const clickNavButton = async (direction: 'prev' | 'next') => {
    await c.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        let headerBtn = null;
        for (const btn of buttons) {
          const t = btn.innerText.trim().toUpperCase();
          if (/^[A-Z]{3}\\s+\\d{4}$/.test(t)) { headerBtn = btn; break; }
        }
        if (!headerBtn) return;
        const parent = headerBtn.parentElement;
        if (!parent) return;
        const siblings = Array.from(parent.querySelectorAll('button'));
        const headerIdx = siblings.indexOf(headerBtn);
        const target = ${direction === 'prev' ? 'siblings[headerIdx - 1]' : 'siblings[headerIdx + 1]'};
        if (target) target.click();
      })()
    `);
  };

  const getMonthDiff = (current: { month: number; year: number }): number => {
    return (targetYear - current.year) * 12 + (targetMonth - current.month);
  };

  let maxAttempts = 60;
  let navigated = false;
  while (maxAttempts-- > 0) {
    const headerText = await getHeaderText();
    if (!headerText) {
      throw new Error(
        `[SelectDateFromCalendar] Could not find a calendar header button (e.g. "JUN 2026") on the page. ` +
        `Ensure the calendar is open and visible before this step.`
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
      await clickNavButton('next');
    } else {
      c.log(`[SelectDateFromCalendar] Navigating backward (${Math.abs(diff)} month(s) to go)...`);
      await clickNavButton('prev');
    }
    await c.wait(250);
  }

  if (!navigated) {
    throw new Error(`[SelectDateFromCalendar] Navigation timeout — could not reach ${targetMonthShort} ${targetYear}.`);
  }

  // ── Step 5: Click the target day button ───────────────────────────────────
  c.log(`[SelectDateFromCalendar] Clicking day: ${targetDay}`);

  const targetDayStr = String(targetDay);
  const dayClicked: boolean = await c.evaluate(`
    (() => {
      // Find the calendar grid: locate the header button, walk up to its grandparent (calendar root)
      const buttons = Array.from(document.querySelectorAll('button'));
      let headerBtn = null;
      for (const btn of buttons) {
        const t = btn.innerText.trim().toUpperCase();
        if (/^[A-Z]{3}\\s+\\d{4}$/.test(t)) { headerBtn = btn; break; }
      }
      if (!headerBtn) return false;

      // Walk up to the calendar root (grandparent of the header row)
      const calendarRoot = headerBtn.closest('.select-none') || headerBtn.parentElement?.parentElement;
      if (!calendarRoot) return false;

      // Click the matching enabled day button
      const dayButtons = Array.from(calendarRoot.querySelectorAll('button:not([disabled])'));
      for (const btn of dayButtons) {
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
