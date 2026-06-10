import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Select Date From Calendar Picker
 * description: Select date ${date} (dd/MM/yyyy) in calendar picker
 * actionType: custom_select_date_from_calendar_picker
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function selectDateFromCalendarPicker(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date} — accepts a direct date string (e.g. "16/06/2026")
  //               or a runtime variable name (e.g. "nextDayDate") — resolved via getVariable fallback
  //
  // Calendar container scoped to XPath:
  //   //*[@id="root"]/div[1]/div[3]/main/div[2]/div/div[2]/div/div[2]/div[4]

  const c = ctx as any;

  const CALENDAR_XPATH = '//*[@id="root"]/div[1]/div[3]/main/div[2]/div/div[2]/div/div[2]/div[4]';

  const rawArg = String(c.args[0] ?? '').trim();
  const dateInput = rawArg.includes('/') ? rawArg : String(c.getVariable(rawArg) ?? '').trim();

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
  const monthNamesFull  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const targetMonthShort = monthNamesShort[targetMonth - 1];

  c.log(`[SelectDateFromCalendar] Target: day=${targetDay}, month=${targetMonthShort}, year=${targetYear}`);
  c.log(`[SelectDateFromCalendar] Calendar XPath: ${CALENDAR_XPATH}`);

  // ── Helper: XPath snippet injected into evaluate strings ─────────────────
  // Resolves the calendar root element. Falls back to document if XPath not found.
  const GET_CAL = `
    (function() {
      var node = document.evaluate(
        '${CALENDAR_XPATH}',
        document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;
      return node || document;
    })()
  `;

  // ── Helper: detect whether a text string looks like a month/year header ───
  // Accepts: "JUN 2026", "Jun 2026", "June 2026", "JUNE 2026"
  const HEADER_RE_SRC = String.raw`/^([A-Za-z]+)\s+(\d{4})$/`;

  // ── Step 2: Read the current month/year header from the calendar ──────────
  const getHeaderText = async (): Promise<string> => {
    const text: string = await c.evaluate(`
      (() => {
        var cal = ${GET_CAL};
        var allEls = Array.from(cal.querySelectorAll('button, span, div, p, h1, h2, h3, h4'));
        var re = ${HEADER_RE_SRC};
        for (var i = 0; i < allEls.length; i++) {
          var el = allEls[i];
          var t = (el.innerText || el.textContent || '').trim();
          if (re.test(t)) return t;
        }
        return '';
      })()
    `);
    return (text ?? '').trim();
  };

  // ── Step 3: Parse header into numeric month/year ──────────────────────────
  // Normalise to uppercase, expand full names to short, then match.
  const parseHeader = (header: string): { month: number; year: number } | null => {
    const m = header.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!m) return null;
    const nameUp = m[1].toUpperCase();
    let monthIdx = monthNamesShort.indexOf(nameUp);
    if (monthIdx === -1) monthIdx = monthNamesFull.indexOf(nameUp);
    if (monthIdx === -1) return null;
    return { month: monthIdx + 1, year: parseInt(m[2], 10) };
  };

  // ── Step 4: Click prev/next nav button scoped to the calendar ────────────
  // Strategy: find the header element, then look for sibling/nearby buttons
  // whose text is a single arrow character, chevron, or empty (icon-only).
  const clickNavButton = async (direction: 'prev' | 'next') => {
    await c.evaluate(`
      (() => {
        var cal = ${GET_CAL};
        var re = ${HEADER_RE_SRC};

        // Find the header element (button OR any element matching MMM YYYY)
        var allEls = Array.from(cal.querySelectorAll('button, span, div'));
        var headerEl = null;
        for (var i = 0; i < allEls.length; i++) {
          var t = (allEls[i].innerText || allEls[i].textContent || '').trim();
          if (re.test(t)) { headerEl = allEls[i]; break; }
        }
        if (!headerEl) return;

        // Walk up to find a container that also holds nav buttons
        var container = headerEl.parentElement;
        for (var depth = 0; depth < 4 && container; depth++) {
          var btns = Array.from(container.querySelectorAll('button'));
          // Filter to nav buttons: text is arrow/chevron/empty or aria-label suggests nav
          var navBtns = btns.filter(function(b) {
            var txt = (b.innerText || b.textContent || '').trim();
            var label = (b.getAttribute('aria-label') || '').toLowerCase();
            return txt.length <= 2 || label.indexOf('prev') !== -1 || label.indexOf('next') !== -1
              || label.indexOf('back') !== -1 || label.indexOf('forward') !== -1;
          });
          if (navBtns.length >= 2) {
            // prev = first nav button, next = last nav button
            var target = '${direction}' === 'prev' ? navBtns[0] : navBtns[navBtns.length - 1];
            if (target) { target.click(); return; }
          }
          container = container.parentElement;
        }

        // Fallback: find all buttons in cal, header button siblings
        var calBtns = Array.from(cal.querySelectorAll('button'));
        var headerBtnIdx = -1;
        for (var j = 0; j < calBtns.length; j++) {
          var bt = (calBtns[j].innerText || calBtns[j].textContent || '').trim();
          if (re.test(bt)) { headerBtnIdx = j; break; }
        }
        if (headerBtnIdx === -1) return;
        var fb = '${direction}' === 'prev' ? calBtns[headerBtnIdx - 1] : calBtns[headerBtnIdx + 1];
        if (fb) fb.click();
      })()
    `);
  };

  const getMonthDiff = (current: { month: number; year: number }): number =>
    (targetYear - current.year) * 12 + (targetMonth - current.month);

  // ── Step 5: Navigate to the target month/year ────────────────────────────
  // Wait for calendar to appear — retry up to 5s before throwing
  let calReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const h = await getHeaderText();
    if (h) { calReady = true; break; }
    await c.wait(500);
  }

  if (!calReady) {
    throw new Error(
      `[SelectDateFromCalendar] Calendar not found at XPath "${CALENDAR_XPATH}". ` +
      `No element with a month/year header (e.g. "Jun 2026") was detected. ` +
      `Ensure the calendar is open before this step.`
    );
  }

  let maxAttempts = 60;
  let navigated = false;
  while (maxAttempts-- > 0) {
    const headerText = await getHeaderText();
    if (!headerText) {
      await c.wait(300);
      continue;
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
    await c.wait(300);
  }

  if (!navigated) {
    throw new Error(`[SelectDateFromCalendar] Navigation timeout — could not reach ${targetMonthShort} ${targetYear}.`);
  }

  // ── Step 6: Click the target day button ───────────────────────────────────
  c.log(`[SelectDateFromCalendar] Clicking day: ${targetDay}`);

  const targetDayStr = String(targetDay);
  const dayClicked: boolean = await c.evaluate(`
    (() => {
      var cal = ${GET_CAL};
      var re = ${HEADER_RE_SRC};
      var target = ${JSON.stringify(targetDayStr)};

      // All enabled buttons in the calendar
      var dayButtons = Array.from(cal.querySelectorAll('button:not([disabled])'));
      for (var i = 0; i < dayButtons.length; i++) {
        var btn = dayButtons[i];
        var text = (btn.innerText || btn.textContent || '').trim();
        // Match exact day number — skip nav/header buttons
        if (text === target && !re.test(text)) {
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
