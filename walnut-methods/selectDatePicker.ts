import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Select Date Picker
 * description: Select date ${date} with format ${format} and store in $[result]
 * actionType: custom_select_date_picker
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function selectDatePicker(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date} — date string e.g. "2026-04-24", "24/04/2026", "04-24-2026"
  // ctx.args[1] = value of ${format} — output format to store e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = "result" (from $[result]) — runtime variable name to store the formatted date into
  const dateInput = ctx.args[0];
  const format = ctx.args[1];
  const outputVar = ctx.args[2];

  // Parse the date input
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input: "${dateInput}"`);
  }

  const targetDay   = date.getDate();
  const targetMonth = date.getMonth(); // 0-indexed
  const targetYear  = date.getFullYear();

  const monthNamesShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Step 1: Open year dropdown and select target year ──
  ctx.log(`Opening year dropdown to select year: ${targetYear}`);
  await ctx.click('button:has-text("' + targetYear + '"), [class*="year"]:has-text("' + targetYear + '"), .rdp-caption_label, [aria-label*="year"], button[class*="year-btn"], span[class*="year"]');
  await ctx.wait(300);

  // Scroll and click the target year in the year grid
  // Try clicking the year text directly — scroll into view if needed
  let yearFound = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const yearEl = await ctx.isVisible(`text="${targetYear}"`);
    if (yearEl) {
      await ctx.click(`text="${targetYear}"`);
      yearFound = true;
      break;
    }
    // Scroll down in the year dropdown to find the year
    await ctx.evaluate(`
      const dropdown = document.querySelector('[class*="year-dropdown"], [class*="yearDropdown"], [class*="year_dropdown"], [class*="YearDropdown"]');
      if (dropdown) dropdown.scrollTop += 100;
    `);
    await ctx.wait(200);
  }
  if (!yearFound) {
    throw new Error(`Could not find year "${targetYear}" in the year dropdown`);
  }
  await ctx.wait(300);

  // ── Step 2: Open month dropdown and select target month ──
  const targetMonthShort = monthNamesShort[targetMonth];
  ctx.log(`Opening month dropdown to select month: ${targetMonthShort}`);
  await ctx.click(`text="${targetMonthShort}", [class*="month"]:not([class*="monthday"]):not([class*="month-grid"]), [aria-label*="month"], button[class*="month-btn"]`);
  await ctx.wait(300);

  // Click the month abbreviation in the month grid
  await ctx.click(`text="${targetMonthShort}"`);
  await ctx.wait(300);

  // ── Step 3: Click the target day in the calendar grid ──
  ctx.log(`Clicking day: ${targetDay}`);
  // Match exact day number cell (avoid matching days from prev/next month which may be disabled)
  await ctx.click(`button:not([disabled]):not([class*="outside"]):not([class*="disabled"]):has-text("${targetDay}"), td:not([class*="outside"]):not([class*="disabled"]) >> text="${targetDay}"`);
  await ctx.wait(200);

  // ── Step 4: Format the date and store in runtime variable ──
  const dd   = String(targetDay).padStart(2, '0');
  const mm   = String(targetMonth + 1).padStart(2, '0');
  const yyyy = String(targetYear);
  const yy   = yyyy.slice(-2);
  const mmm  = monthNamesShort[targetMonth];
  const mmmm = monthNamesFull[targetMonth];

  const formatted = format
    .replace('YYYY', yyyy)
    .replace('YY',   yy)
    .replace('MMMM', mmmm)
    .replace('MMM',  mmm)
    .replace('MM',   mm)
    .replace('DD',   dd);

  ctx.log(`Date selected and formatted: "${formatted}" (format: "${format}")`);
  ctx.setVariable(outputVar, formatted);
}
