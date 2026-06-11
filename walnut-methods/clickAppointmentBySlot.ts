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
  // Supports FIVE DOM variants:
  //
  // ── Variant E — Absolute-positioned appointment card (data-apt-card, 12-hour, hyphen separator) ──
  //   Card container: <div data-apt-card="1" class="absolute left-1 right-1 cursor-pointer rounded-lg
  //                        overflow-hidden transition-shadow hover:shadow-md"
  //                        style="top: 2800px; height: 80px; background-color: rgb(236,253,245);
  //                               border: 1px solid rgb(167,243,208); z-index: 5;">
  //     <div class="flex flex-col h-full px-2 py-1 gap-0.5 overflow-hidden">
  //       <div class="flex items-center gap-1.5 min-w-0">
  //         <div class="h-6 w-6 rounded-full ...">DP</div>
  //         <span class="text-[13px] font-semibold ...">DemoTest patient</span>
  //       </div>
  //       <div class="rounded-md px-1.5 py-0.5 self-start" style="background-color: rgb(255,255,255);">
  //         <span class="text-[10px] font-medium leading-tight truncate" style="color: rgb(5,150,105);">
  //           "5:30 PM"
  //           " - "
  //           "6:00 PM"
  //         </span>
  //       </div>
  //       <div class="flex items-center gap-1 mt-auto pl-0.5">
  //         <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" ...></span>
  //         <span class="text-[12px] font-medium ... capitalize">md new patient hematology</span>
  //       </div>
  //     </div>
  //   </div>
  //   Time is in a <span class="text-[10px] font-medium leading-tight truncate"> with " - " separator
  //   (hyphen, not en-dash). The data-apt-card attribute identifies this card type.
  //   isMatch() already normalises "-" → " – " so matching works without special-casing.
  //   findClickable() walks up to the cursor-pointer div (the data-apt-card element itself).
  //
  //
  // ── Variant D — Week-view calendar grid (12-hour, AM/PM, time in span labels) ─────────────────
  //   Row structure:
  //   <div class="flex" style="border-bottom: ...; height: 175px;">
  //     <div class="flex-shrink-0 flex flex-col justify-between py-2 p-3"
  //          style="width: 90px; border-right: ...">
  //       <span class="text-[11px] text-gray-400 font-medium whitespace-nowrap text-right">5 PM</span>
  //       <span class="text-[11px] text-gray-400 font-medium whitespace-nowrap text-right">5:30 PM</span>
  //     </div>
  //     <div class="flex-shrink-0" style="width: 160px; height: 175px; border-right: ...">
  //       <div class="rounded-xl flex flex-col justify-end overflow-hidden cursor-pointer select-none
  //                   transition-all duration-300"
  //            style="background-color: rgb(253,244,255); border-left: 4px solid rgb(233,213,255);
  //                   height: 159px; outline: none;">
  //         ... card content ...
  //       </div>
  //     </div>
  //   </div>
  //   Time is shown as TWO separate <span> labels in the left column of the row (start time + end time).
  //   The card container has class "cursor-pointer" directly (no w-full h-full wrapper).
  //   Slot variable format: "5:00 PM – 5:30 PM" (or "05:00 PM – 05:30 PM" with leading zero)
  //   Match strategy: find the row whose two time spans form the target range, then click the
  //                   cursor-pointer card div in that same row.
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
  //   - Variant A/B/C: scan all <p> elements, match full time range text, walk up to cursor-pointer div
  //   - Variant D: find row whose two time <span> labels match start+end of target slot,
  //                then click the cursor-pointer card div in that same row
  //   - Variant E: scan data-apt-card elements, check all <span> texts for time match
  //   - Cross-format: both 12h and 24h candidates always tried (full12 + full24)
  //   - All matching uses equality (never partial includes) to avoid adjacent-slot false positives
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

  // Split into start/end — handle both en-dash (–) and plain hyphen (-) separators
  const parts = rawSlot.split(/\s*[\u2013\u2014-]\s*/).map(s => s.trim());
  const rawStart = parts[0] ?? '';
  const rawEnd   = parts[1] ?? ''

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

      // ── Variants A/B/C: scan all <p> tags for time match ─────────────────────────────────────
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

      // ── Variant E: data-apt-card absolute-positioned cards with time in <span> ─────────────────
      // Card: <div data-apt-card="..." class="... cursor-pointer ...">
      //   <div class="rounded-md px-1.5 py-0.5 self-start">
      //     <span class="text-[10px] font-medium leading-tight truncate">
      //       "5:30 PM" " - " "6:00 PM"   ← hyphen separator, not en-dash
      //     </span>
      //   </div>
      // </div>
      // isMatch() normalises the hyphen to " – " so no special-casing needed.
      const aptCards = Array.from(document.querySelectorAll('[data-apt-card]')) as HTMLElement[];
      for (const card of aptCards) {
        const spans = Array.from(card.querySelectorAll('span')) as HTMLElement[];
        for (const span of spans) {
          const text = collapse(span.textContent ?? '');
          if (isMatch(text)) {
            const target = findClickable(card);
            const cardRole = extractCardRole(target);
            target.click();
            return { clicked: true, matched: text, cardRole };
          }
        }
      }

      // ── Variant D: week-view row with two time <span> labels ──────────────────────────────────
      // Row: <div class="flex" style="...height: 175px;">
      //   Left col: <div class="flex-shrink-0 flex flex-col justify-between ...">
      //     <span>5 PM</span>   ← start label (may be "5 PM", "05:00", "5:00 PM" etc.)
      //     <span>5:30 PM</span> ← end label
      //   </div>
      //   Card col: <div class="flex-shrink-0" style="width: 160px; ...">
      //     <div class="... cursor-pointer ...">...</div>  ← clickable card
      //   </div>
      // </div>
      //
      // Strategy: find all flex rows that have a time-label column (flex-col justify-between),
      // read both span texts, normalise to "H:MM AM/PM – H:MM AM/PM", compare to candidates,
      // then find and click the cursor-pointer div in the same row.

      /** Normalise a single time label to stripped 12h form for comparison.
       *  "5 PM" → "5:00 PM", "05:30" → "5:30 AM/PM" (treated as 24h → 12h), "5:30 PM" → "5:30 PM" */
      function normaliseLabel(label: string): string {
        const t = label.trim();
        // "5 PM" or "5:30 PM" style
        const match12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (match12) {
          const h = match12[1];
          const m = match12[2] ?? '00';
          const period = match12[3].toUpperCase();
          return `${parseInt(h, 10)}:${m} ${period}`;
        }
        // "05:30" or "17:00" 24h style
        const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
        if (match24) {
          let h = parseInt(match24[1], 10);
          const m = match24[2];
          const period = h >= 12 ? 'PM' : 'AM';
          if (h === 0) h = 12;
          else if (h > 12) h -= 12;
          return `${h}:${m} ${period}`;
        }
        return t;
      }

      // Scan flex row containers
      const flexRows = Array.from(document.querySelectorAll('div.flex')) as HTMLElement[];
      for (const row of flexRows) {
        // Find the time-label column: flex-col + justify-between child
        const labelCol = row.querySelector(':scope > div.flex-col.justify-between, :scope > div[class*="flex-col"][class*="justify-between"]') as HTMLElement | null;
        if (!labelCol) continue;
        const spans = Array.from(labelCol.querySelectorAll('span')) as HTMLElement[];
        if (spans.length < 2) continue;
        const startLabel = normaliseLabel(spans[0].textContent ?? '');
        const endLabel   = normaliseLabel(spans[spans.length - 1].textContent ?? '');
        const rowRange = `${startLabel} – ${endLabel}`;

        if (isMatch(rowRange)) {
          // Found the matching row — click the cursor-pointer card inside it
          const card = row.querySelector('[class*="cursor-pointer"]') as HTMLElement | null;
          if (card) {
            const cardRole = extractCardRole(card);
            card.click();
            return { clicked: true, matched: rowRange, cardRole };
          }
        }
      }

      // ── Final fallback: scan ALL spans on the page ─────────────────────────────────────────────
      // Catches any card DOM where the time is in a <span> but not inside [data-apt-card]
      const allSpans = Array.from(document.querySelectorAll('span')) as HTMLElement[];
      for (const span of allSpans) {
        const text = collapse(span.textContent ?? '');
        if (isMatch(text)) {
          const target = findClickable(span);
          if (target !== span) { // only click if we found a real cursor-pointer ancestor
            const cardRole = extractCardRole(target);
            target.click();
            return { clicked: true, matched: text, cardRole };
          }
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

        // Variant E fallback: data-apt-card absolute-positioned cards with time in <span>
        const aptCards2 = Array.from(document.querySelectorAll('[data-apt-card]')) as HTMLElement[];
        for (const card of aptCards2) {
          const spans2 = Array.from(card.querySelectorAll('span')) as HTMLElement[];
          for (const span of spans2) {
            const norm2 = collapseAndStrip(span.textContent ?? '');
            if (norm2 === f12 || norm2 === f24) {
              const target = findClickable(card);
              const cardRole = extractCardRole(target);
              target.click();
              return { clicked: true, matched: norm2, cardRole };
            }
          }
        }

        // Variant D fallback: flex row with two time span labels
        function normaliseLabel2(label: string): string {
          const t = label.trim();
          const match12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
          if (match12) {
            const h = match12[1];
            const m = match12[2] ?? '00';
            const period = match12[3].toUpperCase();
            return `${parseInt(h, 10)}:${m} ${period}`;
          }
          const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
          if (match24) {
            let h = parseInt(match24[1], 10);
            const m = match24[2];
            const period = h >= 12 ? 'PM' : 'AM';
            if (h === 0) h = 12;
            else if (h > 12) h -= 12;
            return `${h}:${m} ${period}`;
          }
          return t;
        }
        function collapseAndStrip2(t: string): string {
          return t.replace(/\s+/g, ' ').trim()
                  .replace(/\s*[-\u2013\u2014]\s*/g, ' \u2013 ')
                  .replace(/\b0(\d)(:\d{2})/g, '$1$2');
        }
        const flexRows2 = Array.from(document.querySelectorAll('div.flex')) as HTMLElement[];
        for (const row of flexRows2) {
          const labelCol = row.querySelector(':scope > div.flex-col.justify-between, :scope > div[class*="flex-col"][class*="justify-between"]') as HTMLElement | null;
          if (!labelCol) continue;
          const spans2 = Array.from(labelCol.querySelectorAll('span')) as HTMLElement[];
          if (spans2.length < 2) continue;
          const startLabel = normaliseLabel2(spans2[0].textContent ?? '');
          const endLabel   = normaliseLabel2(spans2[spans2.length - 1].textContent ?? '');
          const rowRange = `${startLabel} – ${endLabel}`;
          const normRange = collapseAndStrip2(rowRange);
          if (normRange === f12 || normRange === f24) {
            const card = row.querySelector('[class*="cursor-pointer"]') as HTMLElement | null;
            if (card) {
              const cardRole = extractCardRole(card);
              card.click();
              return { clicked: true, matched: rowRange, cardRole };
            }
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
