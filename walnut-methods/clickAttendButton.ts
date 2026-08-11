import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Attend Button (Phase 1)
 * description: Click Attend on ${attendButtonSelector} store before count in $[beforeAttendCount] and after count in $[afterAttendCount]
 * actionType: custom_click_attend_button
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function clickAttendButton(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — attendButtonSelector : XPath for the Attend button
  //                                    e.g. "(//button[text()='Attend'])[1]"
  //   args[1] — "beforeAttendCount"  : output variable name (from $[beforeAttendCount])
  //   args[2] — "afterAttendCount"   : output variable name (from $[afterAttendCount])
  //
  // Root causes fixed:
  //   1. beforeAttendCount was reading date span (text-gray-600 matched date column).
  //      Fix: read the NO OF ATTENDEES <td> by column position (last-1) via evaluate().
  //   2. leaveInRowXpath was anchored on the Attend button which DISAPPEARS after click.
  //      Fix: capture the absolute row XPath (by tr index) BEFORE clicking, then poll
  //      for Leave inside that absolute row xpath — no dependency on vanished button.

  const c = ctx as any;

  const attendButtonSelector: string = c.args?.[0];
  const beforeVar: string            = c.args?.[1];
  const afterVar: string             = c.args?.[2];

  if (!attendButtonSelector) throw new Error('attendButtonSelector (args[0]) is required.');
  if (!beforeVar)            throw new Error('Output variable $[beforeAttendCount] (args[1]) is required.');
  if (!afterVar)             throw new Error('Output variable $[afterAttendCount] (args[2]) is required.');

  // ── Step 1: Find the row index of the Attend button BEFORE clicking ──────────
  // We capture the <tr> index so we can re-anchor on it AFTER the button disappears.
  const rowIndex: number = await c.page.evaluate((xpath: string) => {
    const result = document.evaluate(
      xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    const btn = result.singleNodeValue as Element | null;
    if (!btn) return -1;
    const row = btn.closest('tr');
    if (!row) return -1;
    const allRows = Array.from(document.querySelectorAll('tr'));
    return allRows.indexOf(row);
  }, attendButtonSelector);

  if (rowIndex === -1) {
    throw new Error(`Could not find <tr> containing Attend button. XPath: "${attendButtonSelector}"`);
  }
  c.log(`Attend button is in table row index ${rowIndex}.`);

  // ── Step 2: Read attendee count BEFORE click ─────────────────────────────────
  // The NO OF ATTENDEES column is the second-to-last <td> in the row.
  // We read it directly from the row by index — no class-based span matching.
  const countBefore: number = await c.page.evaluate((rIdx: number) => {
    const allRows = Array.from(document.querySelectorAll('tr'));
    const row = allRows[rIdx] as HTMLElement | undefined;
    if (!row) return -1;
    const cells = Array.from(row.querySelectorAll('td'));
    // NO OF ATTENDEES is the second-to-last <td> (last is ACTION column)
    const countCell = cells[cells.length - 2];
    if (!countCell) return -1;
    const raw = (countCell.textContent ?? '').trim();
    const match = raw.match(/^\d+$/);
    return match ? parseInt(raw, 10) : -1;
  }, rowIndex);

  if (countBefore === -1) {
    throw new Error(`Could not read attendee count BEFORE click. Row index: ${rowIndex}`);
  }
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored $[${beforeVar}] = ${countBefore}`);

  // ── Step 3: Click the Attend button ─────────────────────────────────────────
  await c.click(attendButtonSelector);
  c.log('Clicked Attend button.');

  // ── Step 4: Poll for Leave button in the SAME ROW (by row index) ─────────────
  // The Attend button is now GONE from the DOM — do NOT anchor on it.
  // Instead, look for any button with text "Leave" inside the captured row.
  const maxMs  = 10000;
  const pollMs = 300;
  const start  = Date.now();
  let leaveFound = false;

  while (Date.now() - start < maxMs) {
    await c.wait(pollMs);
    leaveFound = await c.page.evaluate((rIdx: number) => {
      const allRows = Array.from(document.querySelectorAll('tr'));
      const row = allRows[rIdx] as HTMLElement | undefined;
      if (!row) return false;
      const buttons = Array.from(row.querySelectorAll('button'));
      return buttons.some(
        (btn) => (btn.textContent ?? '').trim().toLowerCase() === 'leave'
      );
    }, rowIndex);

    if (leaveFound) {
      c.log('Leave button appeared in the row.');
      break;
    }
  }

  if (!leaveFound) {
    throw new Error(
      `"Leave" button did not appear within ${maxMs / 1000}s in row index ${rowIndex}.`
    );
  }

  // ── Step 5: Poll attendee count AFTER click until it changes ─────────────────
  // The Leave button appears BEFORE the attendees cell re-renders. Reading the
  // count immediately captures the stale value (e.g. 0 → 0). Poll until the
  // cell value differs from countBefore, or time out.
  const readCount = (rIdx: number): number => {
    const allRows = Array.from(document.querySelectorAll('tr'));
    const row = allRows[rIdx] as HTMLElement | undefined;
    if (!row) return -1;
    const cells = Array.from(row.querySelectorAll('td'));
    const countCell = cells[cells.length - 2];
    if (!countCell) return -1;
    const raw = (countCell.textContent ?? '').trim();
    const match = raw.match(/^\d+$/);
    return match ? parseInt(raw, 10) : -1;
  };

  let countAfter: number = countBefore;
  const countStart = Date.now();

  while (Date.now() - countStart < maxMs) {
    await c.wait(pollMs);
    countAfter = await c.page.evaluate(readCount, rowIndex);
    if (countAfter !== -1 && countAfter !== countBefore) {
      c.log(`Attendee count updated: ${countBefore} → ${countAfter}`);
      break;
    }
  }

  if (countAfter === -1) {
    throw new Error(`Could not read attendee count AFTER click. Row index: ${rowIndex}`);
  }
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored $[${afterVar}] = ${countAfter}`);

  // ── Step 6: Assert +1 ────────────────────────────────────────────────────────
  if (countAfter !== countBefore + 1) {
    throw new Error(
      `Assertion failed: Expected count ${countBefore} → ${countBefore + 1}, but got ${countAfter}.`
    );
  }
  c.log(`Phase 1 PASSED: ${countBefore} → ${countAfter} (+1) ✓`);
}
