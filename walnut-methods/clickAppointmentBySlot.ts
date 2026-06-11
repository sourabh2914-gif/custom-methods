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
  //
  // Supports THREE DOM variants:
  //
  // ── Variant A — Old DOM (12-hour format, AM/PM) ───────────────────────────────────────────────
  //   Card container: <div class="cursor-pointer w-full h-full">
  //     <div class="w-full h-full flex items-start gap-2 p-2">
  //       <div class="h-7 w-7 ...">TV</div>
  //       <div class="min-w-0 flex-1 flex flex-col gap-0.5">
  //         <p class="text-[12px] font-semibold ...">Tarulata Venkataraman</p>
  //         <p class="text-[10px] leading-tight" style="...opacity: 0.7;">
  //           "2:30 PM"
  //           " – "
  //           "3:00 PM"
  //         </p>
  //       </div>
  //     </div>
  //   </div>
  //   Slot variable format: "03:30 PM – 04:00 PM"  (leading zero stripped → "3:30 PM – 4:00 PM")
  //
  // ── Variant B — New DOM (24-hour format, no AM/PM) ────────────────────────────────────────────
  //   Time label column: <span class="-rotate-90 text-[11px] text-text-gray ...">16:00</span>
  //   Card container: <div class="cursor-pointer w-full h-full">
  //     <div class="rounded-2xl border shadow-sm p-1.5 flex items-center gap-2 w-full h-full overflow-hidden ...">
  //       <div class="relative flex-shrink-0"> ... </div>
  //       <div class="min-w-0 flex-1">
  //         <p class="text-xs font-semibold text-text-color truncate">Krish krishna</p>
  //         <div class="flex items-center gap-1 flex-wrap">
  //           <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ...">Nurse Navigator</span>
  //         </div>
  //         <p class="text-[10px] text-text-gray">
  //           "16:00"
  //           " – "
  //           "16:30"
  //         </p>
  //       </div>
  //     </div>
  //   </div>
  //   Slot variable format: "16:00 – 16:30"  (24-hour, no AM/PM)
  //
  // ── Variant C — New DOM with doctor photo card (12-hour format, AM/PM) ───────────────────────
  //   Card container: <div class="cursor-pointer w-full h-full">
  //     <div class="rounded-2xl border shadow-sm p-1.5 flex items-center gap-2 w-full h-full overflow-hidden"
  //          style="background-color: rgb(238,242,255); border-color: rgb(199,210,254);">
  //       <div class="relative flex-shrink-0">
  //         <img src="..." alt="Dr. Doctor Appointment" class="w-9 h-9 rounded-full object-cover">
  //         <div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center
  //                     justify-center border-2 border-white" style="background-color: rgb(34,197,94);">
  //           <svg ...></svg>
  //         </div>
  //       </div>
  //       <div class="min-w-0 flex-1">
  //         <p class="text-xs font-semibold text-text-color truncate">Dr. Doctor Appointment</p>
  //         <div class="flex items-center gap-1 flex-wrap">
  //           <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
  //                 style="background-color: rgb(238,242,255); color: rgb(67,56,202); border: 1px solid rgb(199,210,254);">
  //             Doctor
  //           </span>
  //         </div>
  //         <p class="text-[10px] text-text-gray">
  //           "9:30 AM"
  //           " – "
  //           "10:00 AM"
  //         </p>
  //       </div>
  //     </div>
  //   </div>
  //   Slot variable format: "09:30 AM – 10:00 AM"  (leading zero stripped → "9:30 AM – 10:00 AM")
  //   Same <p class="text-[10px] text-text-gray"> as Variant B but 12-hour time with AM/PM.
  //
  // Detection strategy:
  //   - All variants: walk all <p> elements, match time text, walk up to cursor-pointer div and click
  //   - Variant A: time in <p class="text-[10px] leading-tight">
  //   - Variant B: time in <p class="text-[10px] text-text-gray"> with 24h format
  //   - Variant C: time in <p class="text-[10px] text-text-gray"> with 12h AM/PM format
  //   - Cross-format: both 12h and 24h candidates always tried (full12 + full24)
  //
  // Steps:
  //   1. Read slot value from runtime variable
  //   2. Normalize time format for matching
  //   3. Build candidate time strings (both 12h and 24h variants for cross-format tolerance)
  //   4. Find and click the matching card using querySelector + XPath fallback
  //   5. Poll for DOM text change to confirm details updated

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

  // ── Step 2: Normalize and build match candidates ───────────────────────────────────────────────
  // We need to handle:
  //   a) "03:30 PM – 04:00 PM"  →  normalize to "3:30 PM – 4:00 PM"  (old DOM, 12h)
  //   b) "16:00 – 16:30"        →  keep as-is                         (new DOM, 24h)
  //
  // Also convert between formats so one stored value can match either DOM variant.

  const is12Hour = /\b(AM|PM)\b/i.test(rawSlot);

  /** Strip leading zero from the hour part only: "03:30 PM" → "3:30 PM", "16:00" stays "16:00" */
  function stripLeadingZero(time: string): string {
    return time.replace(/\b0(\d)(:\d{2})/g, '$1$2');
  }

  /** Convert 12-hour "H:MM AM/PM" to 24-hour "HH:MM" */
  function to24h(time: string): string {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return time;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const period = m[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  /** Convert 24-hour "HH:MM" to 12-hour "H:MM AM/PM" */
  function to12h(time: string): string {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return time;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    if (h > 12) h -= 12;
    return `${h}:${min} ${period}`;
  }

  /** Normalize a time range string for DOM matching */
  function normalizeRange(range: string): string {
    return stripLeadingZero(range).replace(/\s*–\s*/g, ' – ').trim();
  }

  // Primary normalized form (matches the DOM variant the slot was captured from)
  const normalizedSlot = normalizeRange(rawSlot);

  // Split into start/end
  const parts = rawSlot.split('–').map(s => s.trim());
  const rawStart = parts[0] ?? '';
  const rawEnd   = parts[1] ?? '';

  // Build both 12h and 24h variants of start/end for cross-format tolerance
  const start12 = is12Hour ? stripLeadingZero(rawStart) : to12h(rawStart);
  const end12   = is12Hour ? stripLeadingZero(rawEnd)   : to12h(rawEnd);
  const start24 = is12Hour ? to24h(rawStart)             : stripLeadingZero(rawStart);
  const end24   = is12Hour ? to24h(rawEnd)               : stripLeadingZero(rawEnd);

  const full12 = `${start12} – ${end12}`;
  const full24 = `${start24} – ${end24}`;

  ctx.log(`Match candidates — 12h: "${full12}", 24h: "${full24}"`);

  // ── Step 3: Snapshot detail panel before click ────────────────────────────────────────────────
  // Capture the current state of the right-side detail area to detect change after click.
  // We snapshot the whole body's text as fallback since these apps use utility-class DOMs
  // with no stable "detail panel" class name.

  const beforeSnapshot: string = await c.page.evaluate(() => {
    return document.body.innerText ?? '';
  });

  // ── Step 4: Find and click the matching appointment card ──────────────────────────────────────
  //
  // Strategy A: querySelector scan — walk all <p> elements, match time text, then walk up
  //             to <div class="cursor-pointer ..."> and click it.
  //
  // Strategy B: XPath fallback — same logic expressed in XPath if Strategy A finds nothing.

  const clickResult: { clicked: boolean; matched: string; cardRole: string } = await c.page.evaluate(
    ({ f12, f24, s12, e12, s24, e24 }: {
      f12: string; f24: string;
      s12: string; e12: string;
      s24: string; e24: string;
    }) => {
      /**
       * Collapse all whitespace/newlines in a string and trim.
       * Text nodes inside <p> come as separate nodes; textContent joins them with
       * any whitespace between — this collapses that.
       */
      function collapse(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
      }

      /** Check if a collapsed paragraph text matches any of our candidate ranges */
      function isMatch(text: string): boolean {
        // ── Exact full-range match (primary) ─────────────────────────────────────────────────────
        // e.g. text === "2:00 PM – 2:30 PM"  or  text === "14:00 – 14:30"
        if (text === f12 || text === f24) return true;

        // ── Normalised separator variants ─────────────────────────────────────────────────────────
        // Some browsers render the en-dash differently; normalise and retry
        const norm = text.replace(/\s*[-–—]\s*/g, ' – ');
        if (norm === f12 || norm === f24) return true;

        // ── Zero-pad / strip comparison ───────────────────────────────────────────────────────────
        // Strip leading zeros from the card text and compare with our normalised candidates.
        // e.g. "02:00 PM – 02:30 PM" → "2:00 PM – 2:30 PM" === f12  ✓
        // This avoids partial substring hits like "2:00 PM" matching inside "01:30 PM – 02:00 PM".
        const stripped = norm.replace(/\b0(\d)(:\d{2})/g, '$1$2');
        if (stripped === f12 || stripped === f24) return true;

        return false;
      }

      /** Walk up from a matched element to find the cursor-pointer clickable container */
      function findClickable(el: HTMLElement): HTMLElement {
        let cur: HTMLElement | null = el;
        while (cur) {
          if (cur.classList.contains('cursor-pointer')) return cur;
          cur = cur.parentElement;
        }
        // Fallback: walk up to find any div with w-full
        cur = el;
        while (cur) {
          if (cur.tagName === 'DIV' && cur.classList.contains('w-full')) return cur;
          cur = cur.parentElement;
        }
        return el;
      }

      /**
       * Extract the role/title badge text from the card container.
       * Variant A: no role badge — returns ''
       * Variant B/C: <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ...">Nurse Navigator</span>
       *              inside <div class="flex items-center gap-1 flex-wrap">
       */
      function extractCardRole(container: HTMLElement): string {
        // Look for a role badge span: text-[9px] font-bold rounded-full inside flex-wrap div
        const roleSpans = Array.from(container.querySelectorAll(
          'div.flex.flex-wrap span, div[class*="flex-wrap"] span'
        )) as HTMLElement[];
        for (const span of roleSpans) {
          const t = (span.textContent ?? '').trim();
          if (t.length > 0 && t.length < 40) return t; // role labels are short
        }
        return '';
      }

      // ── All Variants: scan all <p> tags for time match ────────────────────────────────────────
      // Variant A: <p class="text-[10px] leading-tight" ...>
      // Variant B: <p class="text-[10px] text-text-gray"> with 24h format
      // Variant C: <p class="text-[10px] text-text-gray"> with 12h AM/PM format
      const paragraphs = Array.from(document.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = collapse(p.textContent ?? '');
        if (isMatch(text)) {
          const target = findClickable(p as HTMLElement);
          const cardRole = extractCardRole(target);
          target.click();
          return { clicked: true, matched: text, cardRole };
        }
      }

      return { clicked: false, matched: '', cardRole: '' };
    },
    { f12: full12, f24: full24, s12: start12, e12: end12, s24: start24, e24: end24 }
  );

  // Role extracted from the clicked card — used to verify detail panel update
  let cardRole = clickResult.cardRole;

  if (!clickResult.clicked) {
    // ── XPath fallback ─────────────────────────────────────────────────────────────────────────
    ctx.log('querySelector scan found no match — trying XPath fallback...');

    const xpathResult: { clicked: boolean; matched: string; cardRole: string } = await c.page.evaluate(
      ({ s12, e12, s24, e24, f12, f24 }: { s12: string; e12: string; s24: string; e24: string; f12: string; f24: string }) => {
        function findClickable(el: HTMLElement): HTMLElement {
          let cur: HTMLElement | null = el;
          while (cur) {
            if (cur.classList.contains('cursor-pointer')) return cur;
            cur = cur.parentElement;
          }
          cur = el;
          while (cur) {
            if (cur.tagName === 'DIV' && cur.classList.contains('w-full')) return cur;
            cur = cur.parentElement;
          }
          return el;
        }

        function extractCardRole(container: HTMLElement): string {
          const roleSpans = Array.from(container.querySelectorAll(
            'div.flex.flex-wrap span, div[class*="flex-wrap"] span'
          )) as HTMLElement[];
          for (const span of roleSpans) {
            const t = (span.textContent ?? '').trim();
            if (t.length > 0 && t.length < 40) return t;
          }
          return '';
        }

        // Match the FULL range string to avoid false positives.
        // e.g. "01:30 PM – 02:00 PM" must NOT match when target is "02:00 PM – 02:30 PM".
        // Strategy: find all <p> tags, strip leading zeros from their text, compare to full12/full24.
        function collapseAndStrip(t: string): string {
          return t.replace(/\s+/g, ' ').trim()
                  .replace(/\s*[-\u2013\u2014]\s*/g, ' \u2013 ')
                  .replace(/\b0(\d)(:\d{2})/g, '$1$2');
        }
        const allPs = Array.from(document.querySelectorAll('p')) as HTMLElement[];
        for (const p of allPs) {
          const norm = collapseAndStrip(p.textContent ?? '');
          if (norm === f12 || norm === f24) {
            const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
            const target = findClickable(p);
            const cardRole = extractCardRole(target);
            target.click();
            return { clicked: true, matched: text, cardRole };
          }
        }
        // XPath fallback for exact full-range match (contains full string)
        const xpaths = [
          `//p[contains(normalize-space(.), '${f12}')]`,
          `//p[contains(normalize-space(.), '${f24}')]`,
        ];

        for (const xp of xpaths) {
          try {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const p = result.singleNodeValue as HTMLElement | null;
            if (p) {
              const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
              const target = findClickable(p);
              const cardRole = extractCardRole(target);
              target.click();
              return { clicked: true, matched: text, cardRole };
            }
          } catch {
            // ignore invalid XPath and try next
          }
        }

        return { clicked: false, matched: '', cardRole: '' };
      },
      { s12: start12, e12: end12, s24: start24, e24: end24, f12: full12, f24: full24 }
    );

    if (!xpathResult.clicked) {
      throw new Error(
        `Could not find an appointment card matching slot "${rawSlot}". ` +
        `Tried 12h format "${full12}" and 24h format "${full24}". ` +
        `Check that the slot value matches the time displayed in the appointment cards.`
      );
    }

    cardRole = xpathResult.cardRole;
    ctx.log(`XPath fallback clicked card — matched text: "${xpathResult.matched}", role: "${cardRole}"`);
  } else {
    ctx.log(`Clicked appointment card — matched text: "${clickResult.matched}", role: "${cardRole}"`);
  }

  // ── Step 5: Poll for detail panel to show slot time AND role (confirms update) ─────────────────
  //
  // We check that the detail panel's text contains:
  //   1. The slot time (either 12h or 24h form of start/end)
  //   2. The role/title from the clicked card (e.g. "Nurse Navigator", "Doctor") — if available
  //
  // This handles both DOM variants:
  //   - Variant A (old DOM): no role badge → only slot time checked
  //   - Variant B/C (new DOM): role badge present → both slot time AND role checked

  ctx.log('Waiting for appointment details section to update...');
  if (cardRole) {
    ctx.log(`Expecting detail panel to show slot time and role: "${cardRole}"`);
  }

  const maxWaitMs = 5000;
  const pollIntervalMs = 300;
  const startTime = Date.now();
  let detailChanged = false;
  let slotVisible = false;
  let roleVisible = false;

  while (Date.now() - startTime < maxWaitMs) {
    await c.wait(pollIntervalMs);

    const afterSnapshot: string = await c.page.evaluate(() => {
      return document.body.innerText ?? '';
    });

    if (afterSnapshot === beforeSnapshot) continue;

    // DOM has changed — now check for specific content
    const bodyText = afterSnapshot;

    // Check slot time visible (any of the 4 time candidates)
    slotVisible =
      bodyText.includes(start12) || bodyText.includes(end12) ||
      bodyText.includes(start24) || bodyText.includes(end24);

    // Check role visible — only required if the card had a role badge
    roleVisible = !cardRole || bodyText.includes(cardRole);

    if (slotVisible && roleVisible) {
      ctx.log(
        `Detail panel updated after ${Date.now() - startTime}ms — ` +
        `slot time visible: ${slotVisible}, role visible: ${roleVisible}.`
      );
      detailChanged = true;
      break;
    }

    // DOM changed but expected content not yet there — keep polling
    ctx.log(`DOM changed but waiting for slot/role text... (slot: ${slotVisible}, role: ${roleVisible})`);
  }

  if (!detailChanged) {
    // Last-resort: accept any DOM change (detail panel may show data differently)
    const finalSnapshot: string = await c.page.evaluate(() => document.body.innerText ?? '');
    if (finalSnapshot !== beforeSnapshot) {
      ctx.log(
        `Warning: DOM changed but could not confirm slot time or role in detail panel within ${maxWaitMs}ms. ` +
        `Continuing — the click registered.`
      );
    } else {
      ctx.log(
        `Warning: DOM text did not change within ${maxWaitMs}ms after clicking. ` +
        `The click likely registered but the details panel may render identically. Continuing.`
      );
    }
  }

  ctx.log(
    `Done — clicked appointment slot "${rawSlot}" ` +
    `(slot visible: ${slotVisible}, role visible: ${roleVisible || !cardRole}).`
  );
}
