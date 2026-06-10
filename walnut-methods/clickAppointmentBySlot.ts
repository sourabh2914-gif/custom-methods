import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Appointment By Slot
 * description: Click the appointment card matching $[selectedslot] and verify details changed
 * actionType: custom_click_appointment_by_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAppointmentBySlot(ctx: WalnutContext) {
  // ctx.args[0] = "selectedslot" (from $[selectedslot]) — runtime variable holding slot time range
  //               e.g. "03:30 PM – 04:00 PM"
  //
  // DOM structure of each appointment card:
  //   <div class="w-full h-full flex items-start gap-2 p-2">
  //     <div class="h-7 w-7 ...">   ← avatar / initials
  //     <div class="min-w-0 flex-1 flex flex-col gap-0.5">
  //       <p class="text-[12px] font-semibold ...">Tarulata Venkataraman</p>
  //       <p class="text-[10px] leading-tight" style="...opacity: 0.7;">
  //         "2:30 PM"
  //         " – "
  //         "3:00 PM"
  //       </p>
  //     </div>
  //   </div>
  //
  // The slot variable may be formatted as "03:30 PM – 04:00 PM" (with leading zero) while
  // the DOM renders "3:30 PM – 4:00 PM" (no leading zero) — normalization handles both.
  //
  // Steps:
  //   1. Read the slot value from the runtime variable
  //   2. Normalize the time format (strip leading zeros from hour part)
  //   3. Capture the current text of the appointment detail panel (to detect change)
  //   4. Find and click the appointment card whose time text matches the slot
  //   5. Wait for the detail panel text to change, confirming the click registered

  const c = ctx as any;
  const slotVarName = ctx.args[0]; // e.g. "selectedslot"

  // ── Step 1: Read slot value from runtime variable ──────────────────────────────────────────────

  const rawSlot = ctx.getVariable(slotVarName) as string | undefined;
  if (!rawSlot) {
    throw new Error(
      `Runtime variable "$[${slotVarName}]" is empty or not set. ` +
      `Ensure a previous step stores the selected slot time into this variable.`
    );
  }

  ctx.log(`Slot from $[${slotVarName}]: "${rawSlot}"`);

  // ── Step 2: Normalize time format ─────────────────────────────────────────────────────────────
  // "03:30 PM – 04:00 PM"  →  "3:30 PM – 4:00 PM"
  // Strips leading zeros from each hour part so it matches DOM text nodes.

  function normalizeTimeRange(timeRange: string): string {
    return timeRange.replace(/\b0(\d)(:\d{2}\s*(?:AM|PM))/gi, '$1$2').trim();
  }

  const normalizedSlot = normalizeTimeRange(rawSlot);
  ctx.log(`Normalized slot: "${normalizedSlot}"`);

  // Also build individual start/end parts for partial matching against text nodes
  // e.g. "3:30 PM – 4:00 PM" → start="3:30 PM", end="4:00 PM"
  const slotParts = normalizedSlot.split('–').map(s => s.trim());
  const slotStart = slotParts[0] ?? '';
  const slotEnd   = slotParts[1] ?? '';

  ctx.log(`Slot start: "${slotStart}", end: "${slotEnd}"`);

  // ── Step 3: Capture current appointment detail panel text ─────────────────────────────────────
  // The detail panel is a sibling/parent area that shows full appointment info after a card click.
  // We snapshot its text now so we can detect a change after clicking.
  // Strategy: grab the outerText of the first element that likely holds appointment details.
  // We look for a panel that is NOT the calendar grid (which contains the cards themselves).

  const detailPanelSelector =
    // Common patterns for a detail/side-panel area — adjust if DOM differs:
    '[class*="detail"], [class*="panel"], [class*="sidebar"], [class*="appointment-info"]';

  let beforeDetailText: string = '';
  try {
    beforeDetailText = await c.page.evaluate(() => {
      // Try to find a dedicated detail panel; fall back to body text as a last resort
      const candidates = [
        document.querySelector('[class*="detail"]'),
        document.querySelector('[class*="panel"]'),
        document.querySelector('[class*="sidebar"]'),
        document.querySelector('[class*="appointment-info"]'),
      ].filter(Boolean);

      if (candidates.length > 0 && candidates[0]) {
        return (candidates[0] as HTMLElement).innerText ?? '';
      }
      return '';
    });
  } catch {
    beforeDetailText = '';
  }

  ctx.log(`Detail panel text before click (${beforeDetailText.length} chars): "${beforeDetailText.slice(0, 80)}..."`);

  // ── Step 4: Find and click the matching appointment card ──────────────────────────────────────
  // XPath that finds the <p> time-text element inside a card whose concatenated text matches
  // the slot. The text is split across text nodes, so we use contains() on the full text.
  //
  // Strategy: find ANY <p> or <span> whose innerText (after trimming) contains both
  // the start time AND the end time (or matches the normalized full range).

  const clicked: boolean = await c.page.evaluate(
    ({ start, end, full }: { start: string; end: string; full: string }) => {
      // Walk all <p> elements — the time paragraph is <p class="text-[10px] ...">
      const paragraphs = Array.from(document.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
        // Match if the paragraph contains both parts of the slot time range
        const matchesFull  = text === full;
        const matchesParts = start && end
          ? text.includes(start) && text.includes(end)
          : text.includes(full);

        if (matchesFull || matchesParts) {
          // Walk up to find the clickable card container (has w-full and flex)
          let el: HTMLElement | null = p;
          while (el && !el.matches('[class*="w-full"][class*="flex"]')) {
            el = el.parentElement;
          }
          const target = (el ?? p) as HTMLElement;
          target.click();
          return true;
        }
      }
      return false;
    },
    { start: slotStart, end: slotEnd, full: normalizedSlot }
  );

  if (!clicked) {
    // Fallback: try XPath approach with text node matching
    ctx.log('Direct querySelector approach found no match — trying XPath fallback...');

    const xpathFound: boolean = await c.page.evaluate(
      ({ start, end }: { start: string; end: string }) => {
        // XPath: find a <p> that contains a text node with slotStart AND another with slotEnd
        const xp = `//p[contains(normalize-space(.), '${start}') and contains(normalize-space(.), '${end}')]`;
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const p = result.singleNodeValue as HTMLElement | null;
        if (!p) return false;

        let el: HTMLElement | null = p;
        while (el && !el.matches('[class*="w-full"][class*="flex"]')) {
          el = el.parentElement;
        }
        const target = (el ?? p) as HTMLElement;
        target.click();
        return true;
      },
      { start: slotStart, end: slotEnd }
    );

    if (!xpathFound) {
      throw new Error(
        `Could not find an appointment card matching slot "${normalizedSlot}" (original: "${rawSlot}"). ` +
        `Check that the slot value matches the time range displayed on the calendar.`
      );
    }

    ctx.log('XPath fallback found and clicked the appointment card.');
  } else {
    ctx.log(`Clicked appointment card for slot "${normalizedSlot}".`);
  }

  // ── Step 5: Wait for detail panel text to change ─────────────────────────────────────────────
  // Poll up to 5 seconds for the detail area text to differ from what it was before the click.

  ctx.log('Waiting for appointment details to update...');

  const maxWaitMs = 5000;
  const pollIntervalMs = 300;
  const startTime = Date.now();
  let detailChanged = false;

  while (Date.now() - startTime < maxWaitMs) {
    await c.wait(pollIntervalMs);

    const afterDetailText: string = await c.page.evaluate(() => {
      const candidates = [
        document.querySelector('[class*="detail"]'),
        document.querySelector('[class*="panel"]'),
        document.querySelector('[class*="sidebar"]'),
        document.querySelector('[class*="appointment-info"]'),
      ].filter(Boolean);

      if (candidates.length > 0 && candidates[0]) {
        return (candidates[0] as HTMLElement).innerText ?? '';
      }
      return '';
    });

    if (afterDetailText !== beforeDetailText && afterDetailText.length > 0) {
      ctx.log(`Detail panel text changed after ${Date.now() - startTime}ms — appointment details updated.`);
      detailChanged = true;
      break;
    }
  }

  if (!detailChanged) {
    ctx.log(
      `Warning: Detail panel text did not change within ${maxWaitMs}ms. ` +
      `The click may have registered but the panel selector may not match your DOM. ` +
      `Verify the detail panel selector or increase the wait time.`
    );
  }

  ctx.log(`Done — clicked appointment slot "${normalizedSlot}" and detail panel ${detailChanged ? 'updated' : 'unchanged'}.`);
}
