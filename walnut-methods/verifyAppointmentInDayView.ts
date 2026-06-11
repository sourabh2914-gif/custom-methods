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
  //   e.g. "2026-06-13", "13/06/2026", or any date stored by getDateAndStore / selectDatePicker
  // ctx.args[1] = "selectedSlot" (from $[selectedSlot]) — runtime variable holding the slot text
  //   e.g. "01:30 PM – 02:00 PM"
  //
  // This method:
  //   1. Reads bookedDate and selectedSlot from runtime variables
  //   2. Clicks the Day tab
  //   3. Navigates (Next/Prev) until the day header shows the exact booked date
  //      — handles month boundary (e.g. today=May 30, bookedDate=Jun 1 → navigates forward 2 days)
  //   4. Verifies the appointment card for the selected slot time is visible in the day grid
  //   5. Throws if the card is not found

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

  // ── Parse booked date ─────────────────────────────────────────────────────────────────────────
  function parseDate(raw: string): Date {
    let d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    const parts = raw.split(/[\/\-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(d.getTime())) return d;
    }
    throw new Error(`Cannot parse booked date: "${raw}". Use ISO YYYY-MM-DD or DD/MM/YYYY.`);
  }

  const bookedDate  = parseDate(bookedDateRaw);
  const bookedDay   = bookedDate.getDate();
  const bookedMonth = bookedDate.getMonth(); // 0-indexed
  const bookedYear  = bookedDate.getFullYear();

  const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  ctx.log(`[DayView] Target: ${dayNames[bookedDate.getDay()]} ${bookedDay} ${monthNames[bookedMonth]} ${bookedYear}`);

  // ── Step 1: Click the Day tab ─────────────────────────────────────────────────────────────────
  const dayTabXpath = `//button[normalize-space(text())='Day' or normalize-space(.)='Day']`;
  const dayTabCount = await c.page.locator(`xpath=${dayTabXpath}`).count();
  if (dayTabCount > 0) {
    await c.page.locator(`xpath=${dayTabXpath}`).first().click();
    await ctx.wait(700);
    ctx.log('[DayView] Clicked Day tab');
  } else {
    ctx.log('[DayView] Day tab not found — assuming already in Day view');
  }

  // ── Step 2: Read the currently displayed date from the day-view header ─────────────────────
  // Day view header: "06/11/2026" or "Thu 11 (Today)" or "Thu 11"
  async function getDisplayedDate(): Promise<{ day: number; month: number; year: number; text: string }> {
    const text: string = await c.page.evaluate(() => {
      // Try explicit class fragments first
      const selectors = [
        '[class*="day-header"]',
        '[class*="dayHeader"]',
        '[class*="calendar-header"]',
        '[class*="calendarHeader"]',
        '.rbc-toolbar-label',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
      // Broad fallback: find a button/span/div whose text looks like "MM/DD/YYYY"
      const all = Array.from(document.querySelectorAll('button, span, div'));
      for (const el of all) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        if (/^\d{1,2}\/\d{1,2}\/20\d{2}$/.test(t)) return t;
      }
      return '';
    });

    ctx.log(`[DayView] Header text: "${text}"`);

    // Pattern 1: "06/11/2026" → month=6, day=11, year=2026
    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (slashMatch) {
      return {
        month: parseInt(slashMatch[1], 10) - 1,
        day:   parseInt(slashMatch[2], 10),
        year:  parseInt(slashMatch[3], 10),
        text,
      };
    }

    // Pattern 2: "Thu 11 (Today)" — day-of-week + day number, no year shown in header
    // In this case, we also need to read the month from the date pill (e.g. top bar showing "06/11/2026")
    const dayNumMatch = text.match(/\b(\d{1,2})\b/);
    const yearMatch   = text.match(/\b(20\d{2})\b/);

    // Try to get the full date from the pill button at the top (visible in the screenshots)
    // Scan all buttons/spans/divs for exact MM/DD/YYYY pattern — class-independent
    const pillText: string = await c.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, span, div'));
      for (const el of all) {
        const t = (el as HTMLElement).innerText?.trim() ?? '';
        if (/^\d{1,2}\/\d{1,2}\/20\d{2}$/.test(t)) return t;
      }
      return '';
    });

    // pillText might be "06/11/2026"
    const pillMatch = pillText.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
    if (pillMatch) {
      return {
        month: parseInt(pillMatch[1], 10) - 1,
        day:   parseInt(pillMatch[2], 10),
        year:  parseInt(pillMatch[3], 10),
        text: pillText,
      };
    }

    if (dayNumMatch && yearMatch) {
      const day  = parseInt(dayNumMatch[1], 10);
      const year = parseInt(yearMatch[1], 10);
      // month: scan text for month names
      const up = text.toUpperCase();
      const shortUp = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      let month = -1;
      for (let i = 0; i < 12; i++) {
        if (up.includes(shortUp[i])) { month = i; break; }
      }
      return { month, day, year, text };
    }

    return { day: -1, month: -1, year: -1, text };
  }

  // ── Step 3: Navigate until the day header matches the booked date ─────────────────────────────
  const MAX_NAV = 60; // up to 60 days navigation

  for (let i = 0; i < MAX_NAV; i++) {
    const { day: dispDay, month: dispMonth, year: dispYear, text: dispText } = await getDisplayedDate();

    if (dispDay === bookedDay && dispMonth === bookedMonth && dispYear === bookedYear) {
      ctx.log(`[DayView] Correct date displayed: ${bookedDay} ${monthNames[bookedMonth]} ${bookedYear}`);
      break;
    }

    if (dispDay === -1) {
      ctx.log('[DayView] Could not parse displayed date — navigating forward...');
    } else {
      const displayedMs = new Date(dispYear, dispMonth, dispDay).getTime();
      const targetMs    = new Date(bookedYear, bookedMonth, bookedDay).getTime();
      const direction   = targetMs > displayedMs ? 'forward' : 'backward';
      ctx.log(`[DayView] Displayed: ${dispDay}/${dispMonth + 1}/${dispYear} → navigating ${direction} (attempt ${i + 1})`);

      if (direction === 'forward') {
        const nextClicked = await c.page.evaluate(() => {
          const byLabel = document.querySelector(
            'button[aria-label*="next" i], button[aria-label*="Next"], button[aria-label*="forward" i]'
          );
          if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
          const iconBtns = Array.from(document.querySelectorAll('button')).filter(b => {
            const txt = b.innerText?.trim() ?? '';
            return txt === '' && b.querySelector('svg');
          });
          if (iconBtns.length >= 2) { (iconBtns[iconBtns.length - 1] as HTMLButtonElement).click(); return true; }
          if (iconBtns.length === 1) { (iconBtns[0] as HTMLButtonElement).click(); return true; }
          return false;
        });
        if (!nextClicked) await c.page.locator('button:has(svg)').last().click();
      } else {
        const prevClicked = await c.page.evaluate(() => {
          const byLabel = document.querySelector(
            'button[aria-label*="prev" i], button[aria-label*="back" i], button[aria-label*="previous" i]'
          );
          if (byLabel) { (byLabel as HTMLButtonElement).click(); return true; }
          const iconBtns = Array.from(document.querySelectorAll('button')).filter(b => {
            const txt = b.innerText?.trim() ?? '';
            return txt === '' && b.querySelector('svg');
          });
          if (iconBtns.length >= 2) { (iconBtns[0] as HTMLButtonElement).click(); return true; }
          return false;
        });
        if (!prevClicked) await c.page.locator('button:has(svg)').first().click();
      }

      await ctx.wait(600);

      if (i === MAX_NAV - 1) {
        throw new Error(
          `[DayView] Could not navigate to ${bookedDay} ${monthNames[bookedMonth]} ${bookedYear} ` +
          `within ${MAX_NAV} attempts. Last displayed: "${dispText}"`
        );
      }

      continue;
    }

    // If we couldn't parse, just navigate forward
    await c.page.locator('button:has(svg)').last().click();
    await ctx.wait(600);
  }

  // ── Step 4: Verify the appointment card is visible for the selected slot ──────────────────────
  // The slot text e.g. "01:30 PM – 02:00 PM"
  // Extract start time for partial match: "01:30 PM"
  const slotStartLabel = slotText.split(/[-–—]/)[0].trim(); // "01:30 PM"

  ctx.log(`[DayView] Looking for appointment card containing: "${slotStartLabel}"`);

  // Try multiple card selectors
  const cardSelectors = [
    `[class*="event"]:has-text("${slotStartLabel}")`,
    `[class*="appointment"]:has-text("${slotStartLabel}")`,
    `[class*="slot"]:has-text("${slotStartLabel}")`,
    `[class*="booking"]:has-text("${slotStartLabel}")`,
    `div:has-text("${slotStartLabel}"):not(body):not(html):not(header):not(nav)`,
  ];

  let cardFound = false;
  let matchedSelector = '';
  for (const sel of cardSelectors) {
    try {
      const count = await c.page.locator(sel).count();
      if (count > 0) {
        ctx.log(`[DayView] Appointment card found with selector: "${sel}" (count: ${count})`);
        cardFound = true;
        matchedSelector = sel;
        break;
      }
    } catch (_) {
      // Continue to next selector
    }
  }

  if (!cardFound) {
    // DOM walk fallback
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
      ctx.log(`[DayView] Appointment card found via DOM walk: "${cardText.substring(0, 80)}"`);
      cardFound = true;
    }
  }

  if (!cardFound) {
    throw new Error(
      `[DayView] Appointment card for slot "${slotText}" was NOT found in the day view for ` +
      `${bookedDay} ${monthNames[bookedMonth]} ${bookedYear}. ` +
      `Expected a card containing "${slotStartLabel}".`
    );
  }

  // ── Scroll to the appointment card and click it ───────────────────────────────────────────────
  ctx.log(`[DayView] Scrolling to appointment card and clicking...`);

  if (matchedSelector) {
    // Use the matched CSS selector — scroll into view then click
    await c.page.locator(matchedSelector).first().scrollIntoViewIfNeeded();
    await ctx.wait(400);
    await c.page.locator(matchedSelector).first().click();
    ctx.log(`[DayView] Clicked appointment card via selector: "${matchedSelector}"`);
  } else {
    // DOM walk fallback — scroll then click
    await c.page.evaluate((startLabel: string) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Element | null;
      while ((node = walker.nextNode() as Element)) {
        const tag = node.tagName.toLowerCase();
        if (['html','body','head','header','nav','script','style'].includes(tag)) continue;
        const text = (node as HTMLElement).innerText?.trim() ?? '';
        if (text.includes(startLabel) && text.length < 200) {
          (node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }, slotStartLabel);
    await ctx.wait(500);
    await c.page.evaluate((startLabel: string) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Element | null;
      while ((node = walker.nextNode() as Element)) {
        const tag = node.tagName.toLowerCase();
        if (['html','body','head','header','nav','script','style'].includes(tag)) continue;
        const text = (node as HTMLElement).innerText?.trim() ?? '';
        if (text.includes(startLabel) && text.length < 200) {
          (node as HTMLElement).click();
          return;
        }
      }
    }, slotStartLabel);
    ctx.log(`[DayView] Scrolled and clicked appointment card via DOM walk`);
  }

  await ctx.wait(500);
  ctx.log(`[DayView] Appointment card verified and clicked for slot "${slotText}" on ${bookedDay} ${monthNames[bookedMonth]} ${bookedYear}`);
}
