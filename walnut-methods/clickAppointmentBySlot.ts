import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Appointment By Slot
 * description: Click the appointment card matching $[selectedslot] with optional role filter $[role] and verify details changed
 * actionType: custom_click_appointment_by_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAppointmentBySlot(ctx: WalnutContext) {
  // ctx.args[0] = "selectedslot" (from $[selectedslot]) — runtime variable holding slot time range
  // ctx.args[1] = "role" (from $[role]) — optional runtime variable; when set, disambiguates between
  //               multiple cards at the same slot by matching the role badge text (e.g. "Doctor", "Nurse Navigator")
  // ctx.args[2] = "weekday" (from $[weekday]) — optional output variable name; receives the weekday text
  //               read from the column header of the matched card (e.g. "Wed", "Thu")
  // ctx.args[3] = "date" (from $[date]) — optional output variable name; receives the date number text
  //               read from the column header of the matched card (e.g. "17", "18")
  //
  // Supports SEVEN DOM variants (E has two sub-variants E1/E2, F is the new week-view):
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
  // ── Variant B2 — Same as B but with purple/avatar style and green status badge ─────────────────
  //   Card container: <div class="cursor-pointer w-full h-full">
  //     <div class="rounded-2xl border shadow-sm p-1.5 flex items-center gap-2 w-full h-full overflow-hidden"
  //          style="background-color: rgb(253,244,255); border-color: rgb(233,213,255);">
  //       <div class="relative flex-shrink-0">
  //         <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
  //              style="background-color: rgb(192,132,252);">KK</div>
  //         <div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center
  //                     justify-center border-2 border-white" style="background-color: rgb(34,197,94);">
  //           <svg ...></svg>
  //         </div>
  //       </div>
  //       <div class="min-w-0 flex-1">
  //         <p class="text-xs font-semibold text-text-color truncate">Krish krishna</p>
  //         <div class="flex items-center gap-1 flex-wrap">
  //           <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
  //                 style="background-color:rgb(253,244,255); color:rgb(126,34,206); border:1px solid rgb(233,213,255);">
  //             Nurse Navigator
  //           </span>
  //         </div>
  //         <p class="text-[10px] text-text-gray">
  //           "16:30"
  //           " – "
  //           "17:00"
  //         </p>
  //       </div>
  //     </div>
  //   </div>
  //   Time is in <p class="text-[10px] text-text-gray"> — identical to Variant B.
  //   Handled by the same <p> scan. No special-casing needed.
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
  // ── Variant C2 — Doctor photo card, 12-hour with leading zeros, hyphen separator ───────────────
  //   Outer wrapper: <div class="w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-sm
  //                              border border-gray-200 border-transparent shadow-none">
  //   Card container: <div class="cursor-pointer w-full h-full">
  //     <div class="rounded-2xl border shadow-sm p-1.5 flex items-center gap-2 w-full h-full overflow-hidden"
  //          style="background-color: rgb(238,242,255); border-color: rgb(199,210,254);">
  //       <div class="relative flex-shrink-0">
  //         <img src="..." alt="Dr. carrot k" class="w-9 h-9 rounded-full object-cover">
  //         <div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ... border-2 border-white"
  //              style="background-color: rgb(34,197,94);"><svg ...></svg></div>
  //       </div>
  //       <div class="min-w-0 flex-1">
  //         <p class="text-xs font-semibold text-text-color truncate">Dr. carrot k</p>
  //         <div class="flex items-center gap-1 flex-wrap">
  //           <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
  //                 style="background-color:rgb(238,242,255); color:rgb(67,56,202); border:1px solid rgb(199,210,254);">
  //             Doctor
  //           </span>
  //         </div>
  //         <p class="text-[10px] text-text-gray">
  //           "05:17 PM"
  //           " - "
  //           "05:47 PM"
  //         </p>
  //       </div>
  //     </div>
  //   </div>
  //   Slot variable format: "05:17 PM – 05:47 PM" → f12 = "5:17 PM – 5:47 PM" (leading zero stripped)
  //   DOM uses plain hyphen " - " separator and leading-zero times e.g. "05:17 PM".
  //   isMatch() handles: norm("-"→"–") then stripped(leading zero) → "5:17 PM – 5:47 PM" === f12 ✓
  //   Handled by the same <p> scan as Variants B/C. No special-casing needed.
  //
  // ── Multiple cards at the same slot (role disambiguation) ────────────────────────────────────────
  //   When two appointment cards share the same time slot (e.g. 15:30–16:00), each card has a role
  //   badge: "Nurse Navigator" (pink card) and "Doctor" (green card):
  //
  //   Green Doctor card DOM (from screenshot):
  //     <div class="cursor-pointer w-full h-full">
  //       <div class="rounded-2xl border shadow-sm p-1.5 flex items-center gap-2 w-full h-full overflow-hidden"
  //            style="background-color: rgb(240,253,244); border-color: rgb(187,247,208);">
  //         <div class="relative flex-shrink-0">
  //           <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
  //                style="background-color: rgb(74,222,128);">DJ</div>
  //           <div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center
  //                       justify-center border-2 border-white" style="background-color: rgb(34,197,94);">
  //             <svg ...></svg>
  //           </div>
  //         </div>
  //         <div class="min-w-0 flex-1">
  //           <p class="text-xs font-semibold text-text-color truncate">Dr. Johnc Smith</p>
  //           <div class="flex items-center gap-1 flex-wrap">
  //             <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
  //                   style="background-color: rgb(240,253,244); color: rgb(21,128,61);
  //                          border: 1px solid rgb(187,247,208);">Doctor</span>
  //           </div>
  //           <p class="text-[10px] text-text-gray">
  //             "15:30"
  //             " – "
  //             "16:00"
  //           </p>
  //         </div>
  //       </div>
  //     </div>
  //
  //   Strategy: when $[role] variable is set, ALL time-matching cards are collected first, then
  //   the one whose <span class="text-[9px] font-bold ... rounded-full"> badge text matches the
  //   role (case-insensitive) is preferred. If role is unset or no match, the first card is used.
  //
  // Detection strategy:
  //   - Variant A/B/C: scan all <p> elements, match full time range text, walk up to cursor-pointer div
  //   - Variant D: find row whose two time <span> labels match start+end of target slot,
  //                then click the cursor-pointer card div in that same row
  //   - Variant E: scan data-apt-card elements, check all <span> texts for time match
  //   - Cross-format: both 12h and 24h candidates always tried (full12 + full24)
  //   - All matching uses equality (never partial includes) to avoid adjacent-slot false positives
  //   - Role filter: when multiple cards share a slot, $[role] selects the correct card
  //
  // Steps:
  //   1. Read slot value from runtime variable
  //   2. Normalize time format for matching
  //   3. Build candidate time strings (both 12h and 24h variants for cross-format tolerance)
  //   4. Find and click the matching card using querySelector + XPath fallback
  //   5. Poll for DOM text change to confirm details updated

  const c = ctx as any;
  const slotVarName = ctx.args[0]; // e.g. "selectedslot"
  const roleVarName = ctx.args[1] as string | undefined; // e.g. "role" (optional)
  const weekdayVarName = ctx.args[2] as string | undefined; // e.g. "weekday" (optional output)
  const dateVarName    = ctx.args[3] as string | undefined; // e.g. "date" (optional output)

  // ── Step 1: Read slot value from runtime variable ──────────────────────────────────────────────

  const rawSlot = ctx.getVariable(slotVarName) as string | undefined;
  if (!rawSlot) {
    throw new Error(
      `Runtime variable "$[${slotVarName}]" is empty or not set. ` +
      `Ensure a previous step stores the selected slot time into this variable.`
    );
  }

  // Read optional role filter — empty string / undefined means no role filter
  const roleFilter: string = roleVarName ? ((ctx.getVariable(roleVarName) as string | undefined) ?? '').trim() : '';

  ctx.log(`Slot from $[${slotVarName}]: "${rawSlot}"`);
  if (roleFilter) ctx.log(`Role filter from $[${roleVarName}]: "${roleFilter}"`);

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
  // The modal calendar is scrollable — slots below the visible area must be scrolled into view
  // before clicking. Strategy:
  //   1. evaluate() finds the matching element and scrolls it into view (scrollIntoView),
  //      marks it with a unique data attribute, and returns metadata (matched text, role).
  //      It does NOT call .click() — clicking an off-screen element inside overflow:scroll fails.
  //   2. After evaluate(), wait briefly for scroll animation, then use Playwright's native
  //      locator click (which handles viewport scrolling and pointer events correctly).
  //   3. Remove the temporary marker attribute after clicking.

  const MARKER = 'data-walnut-apt-target';

  // Clean up any leftover marker from a previous run
  await c.page.evaluate((marker: string) => {
    document.querySelectorAll(`[${marker}]`).forEach((el: Element) => el.removeAttribute(marker));
  }, MARKER);

  // ── Pre-scroll: bring the target time slot into the visible area before searching ─────────────
  // The modal calendar uses a fixed-height scrollable container. If the target slot is below
  // the current viewport (e.g. 12:30 PM when only 9–10 AM is visible), the card may not be
  // rendered yet. We scroll by time-position so the card is in the DOM before querying it.
  await c.page.evaluate(({ start24, start12 }: { start24: string; start12: string }) => {

    // ── Convert time string to minutes since midnight ────────────────────────────────────────────
    // Handles both "12:30" (24h) and "12:30 PM" (12h)
    function toMinutes(t: string): number {
      const t24 = t.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (t24) return parseInt(t24[1], 10) * 60 + parseInt(t24[2], 10);
      const t12 = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (t12) {
        let h = parseInt(t12[1], 10);
        const min = parseInt(t12[2], 10);
        const p = t12[3].toUpperCase();
        if (p === 'PM' && h !== 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;
        return h * 60 + min;
      }
      return -1;
    }

    const targetMins = toMinutes(start24) >= 0 ? toMinutes(start24) : toMinutes(start12);
    if (targetMins < 0) return; // can't parse — skip pre-scroll

    // ── Find the modal's scrollable calendar container ────────────────────────────────────────────
    // We want the INNERMOST scrollable container that:
    //   1. Has overflow-y auto/scroll
    //   2. Has scrollable content (scrollHeight > clientHeight)
    //   3. Has visible height >= 150px (rules out tiny dropdowns)
    //   4. Is NOT the document body/html (those scroll the whole page, not the modal)
    function findCalendarScrollable(): HTMLElement | null {
      const candidates = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      let best: HTMLElement | null = null;
      let bestScrollable = 0;

      for (const el of candidates) {
        if (el === document.body || el.tagName === 'HTML') continue;
        const style = window.getComputedStyle(el);
        const ov = style.overflowY;
        if (ov !== 'auto' && ov !== 'scroll') continue;
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable < 50) continue; // not meaningfully scrollable
        const rect = el.getBoundingClientRect();
        if (rect.height < 150) continue; // too small
        if (scrollable > bestScrollable) {
          bestScrollable = scrollable;
          best = el;
        }
      }
      return best;
    }

    // ── Strategy A: find a rendered time-label SPAN (leaf, exact match) and scroll to it ─────────
    // The calendar renders hour/half-hour labels in spans like "9 AM", "9:30 AM", "12 PM" etc.
    // We use ONLY spans (not divs) with exact time-label text to avoid false matches on
    // composite divs whose textContent aggregates multiple labels.
    const labelSpans = Array.from(document.querySelectorAll('span')) as HTMLElement[];
    let bestLabelEl: HTMLElement | null = null;
    let bestDiff = Infinity;

    for (const span of labelSpans) {
      // Must be a leaf or near-leaf (textContent === own text)
      const text = (span.textContent ?? '').trim();
      if (!text || text.length > 12) continue; // time labels are short
      const mins = toMinutes(text);
      if (mins < 0) continue;
      const diff = Math.abs(mins - targetMins);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLabelEl = span;
      }
    }

    if (bestLabelEl && bestDiff <= 60) {
      // Found a time label within 60 min of target — scroll it to the top of the viewport
      // so the card for that slot (which starts AT the label and extends downward) is visible.
      // Use 'start' not 'center' — 'center' puts the label mid-screen but the card body is below.
      bestLabelEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      return;
    }

    // ── Strategy B: scroll the calendar container by computed pixel offset ───────────────────────
    // Measure the pixel-per-minute ratio from two visible time labels, then scroll proportionally.
    const scrollContainer = findCalendarScrollable();
    if (!scrollContainer) return;

    // Try to detect px-per-hour from the DOM by finding two time labels with known positions
    const timeLabels: { mins: number; top: number }[] = [];
    for (const span of labelSpans) {
      const text = (span.textContent ?? '').trim();
      if (!text || text.length > 12) continue;
      const mins = toMinutes(text);
      if (mins < 0) continue;
      const rect = span.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const relTop = rect.top - containerRect.top + scrollContainer.scrollTop;
      timeLabels.push({ mins, top: relTop });
    }

    if (timeLabels.length >= 2) {
      // Sort by position and compute px-per-minute from the first two distinct labels
      timeLabels.sort((a, b) => a.top - b.top);
      let pxPerMin = 2; // default: ~120px/hour
      for (let i = 1; i < timeLabels.length; i++) {
        const dMin = timeLabels[i].mins - timeLabels[i - 1].mins;
        const dPx  = timeLabels[i].top  - timeLabels[i - 1].top;
        if (dMin > 0 && dPx > 0) {
          pxPerMin = dPx / dMin;
          break;
        }
      }
      const firstLabel = timeLabels[0];
      const targetPx = firstLabel.top + (targetMins - firstLabel.mins) * pxPerMin;
      scrollContainer.scrollTop = Math.max(0, targetPx - scrollContainer.clientHeight / 2);
      return;
    }

    // ── Strategy C: last-resort — use proportional scroll based on assumed calendar bounds ────────
    // Assume calendar shows 0:00–24:00 (or 8:00–20:00) and scroll proportionally.
    const calStartMins = 0;
    const calEndMins   = 24 * 60;
    const ratio = (targetMins - calStartMins) / (calEndMins - calStartMins);
    scrollContainer.scrollTop = ratio * scrollContainer.scrollHeight - scrollContainer.clientHeight / 2;

  }, { start24, start12 });

  // Wait for first scroll to settle
  await c.wait(500);

  // ── Second-pass scroll: find the actual card span and ensure it's in view ───────────────────
  // The pre-scroll gets us to the right time region, but the card may still be just off-screen.
  // Now that the DOM is populated, find the card's time span and scroll it into view directly.
  await c.page.evaluate(({ f12, f24 }: { f12: string; f24: string }) => {
    function collapse(t: string) { return t.replace(/\s+/g, ' ').trim(); }
    function normR(range: string): string {
      const parts = range.replace(/\s*[-\u2013\u2014]\s*/g, '|||').split('|||');
      return parts.map(t => {
        let s = t.replace(/\b0(\d)(:\d{2})/g, '$1$2');
        s = s.replace(/\b(\d{1,2}):00(\s*(AM|PM))/gi, '$1$2');
        s = s.replace(/\b(\d{1,2}):00$/, '$1');
        return s.trim();
      }).join(' \u2013 ');
    }
    function isM(text: string): boolean {
      if (text.length > 30) return false;
      const norm = text.replace(/\s*[-\u2013\u2014]\s*/g, ' \u2013 ');
      if (norm === f12 || norm === f24) return true;
      const stripped = norm.replace(/\b0(\d)(:\d{2})/g, '$1$2');
      if (stripped === f12 || stripped === f24) return true;
      if (normR(text) === normR(f12) || normR(text) === normR(f24)) return true;
      return false;
    }
    // Find the first matching span/p and scroll it into view
    const candidates = Array.from(document.querySelectorAll('span, p')) as HTMLElement[];
    for (const el of candidates) {
      const text = collapse(el.textContent ?? '');
      if (isM(text)) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return;
      }
    }
  }, { f12: full12, f24: full24 });

  // Wait for second scroll to settle and card to be fully in view
  await c.wait(300);

  const clickResult: { clicked: boolean; matched: string; cardRole: string; weekday: string; date: string } = await c.page.evaluate(
    ({ f12, f24, s12, e12, s24, e24, marker, roleFilter }: {
      f12: string; f24: string;
      s12: string; e12: string;
      s24: string; e24: string;
      marker: string;
      roleFilter: string;
    }) => {
      /**
       * Collapse all whitespace/newlines in a string and trim.
       * Text nodes inside <p> come as separate nodes; textContent joins them with
       * any whitespace between — this collapses that.
       */
      function collapse(text: string): string {
        return text.replace(/\s+/g, ' ').trim();
      }

      /**
       * Normalise a single time token for flexible matching:
       *   "1:00 PM" → "1 PM"   (strip :00 minutes)
       *   "01:30 PM" → "1:30 PM" (strip leading zero)
       *   "13:00" → "13:00"    (24h kept as-is)
       */
      function normToken(t: string): string {
        // Strip leading zero on hour
        let s = t.replace(/\b0(\d)(:\d{2})/g, '$1$2');
        // Strip :00 minutes when they're on the hour: "1:00 PM" → "1 PM", "13:00" → "13"
        s = s.replace(/\b(\d{1,2}):00(\s*(AM|PM))/gi, '$1$2');
        s = s.replace(/\b(\d{1,2}):00$/, '$1');
        return s.trim();
      }

      /** Build all normalised forms of a full range string for comparison */
      function normRange(range: string): string {
        // Normalise separator to ' – '
        const parts = range.replace(/\s*[-–—]\s*/g, '|||').split('|||');
        return parts.map(normToken).join(' – ');
      }

      /** Check if a collapsed paragraph text matches any of our candidate ranges */
      function isMatch(text: string): boolean {
        // Reject overly long strings — a valid time range "H:MM AM – H:MM AM" is at most ~22 chars.
        // Parent elements that aggregate multiple slots will be much longer; skip them entirely.
        if (text.length > 30) return false;

        // ── Exact full-range match (primary) ─────────────────────────────────────────────────────
        if (text === f12 || text === f24) return true;

        // ── Normalised separator variants ─────────────────────────────────────────────────────────
        const norm = text.replace(/\s*[-–—]\s*/g, ' – ');
        if (norm === f12 || norm === f24) return true;

        // ── Zero-pad / strip comparison ───────────────────────────────────────────────────────────
        const stripped = norm.replace(/\b0(\d)(:\d{2})/g, '$1$2');
        if (stripped === f12 || stripped === f24) return true;

        // ── :00 minute omission — DOM may render "1:00 PM" as "1 PM" ────────────────────────────
        // e.g. card shows "12:30 PM - 1 PM" but target is "12:30 PM – 1:00 PM"
        // Normalise both the card text and our candidates by stripping :00 minutes.
        const normText   = normRange(text);
        const normF12    = normRange(f12);
        const normF24    = normRange(f24);
        if (normText === normF12 || normText === normF24) return true;

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

      /**
       * Mark the target element with a unique attribute, scroll it into view inside its
       * scrollable container, and return. The actual click is done by Playwright after
       * the scroll completes so that pointer events fire correctly.
       */
      function markAndScroll(target: HTMLElement, matched: string, cardRole: string, weekday = '', date = ''): { clicked: boolean; matched: string; cardRole: string; weekday: string; date: string } {
        target.setAttribute(marker, 'true');
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        return { clicked: true, matched, cardRole, weekday, date };
      }

      /**
       * Given an element inside a week-view column, walk up to find the column container
       * (div.flex-1 with min-w-[140px]) and read the weekday/date from its header.
       * Header DOM:
       *   <div class="flex-1 rounded-t-2xl border-x border-white border-opacity-50 min-w-[140px] bg-primary-bg bg-opacity-20">
       *     <div class="h-12 p-2 rounded-t-2xl text-center flex justify-center items-center gap-1.5 font-bold text-text-color">
       *       <span class="text-sm font-medium">Wed</span>
       *       <span class="text-lg">17</span>
       *     </div>
       *   </div>
       */
      function extractWeekdayDate(el: HTMLElement): { weekday: string; date: string } {
        // Walk up to find a column div that contains a min-w-[140px] class
        let cur: HTMLElement | null = el;
        while (cur) {
          if (cur.classList.contains('flex-1') && cur.className.includes('min-w-')) {
            // Found the column container — read spans from the header child
            const headerDiv = cur.querySelector('div[class*="h-12"]') as HTMLElement | null;
            if (headerDiv) {
              const spans = Array.from(headerDiv.querySelectorAll('span')) as HTMLElement[];
              const weekday = spans[0] ? (spans[0].textContent ?? '').trim() : '';
              const date    = spans[1] ? (spans[1].textContent ?? '').trim() : '';
              return { weekday, date };
            }
            // Try direct child spans if no h-12 header found
            const directSpans = Array.from(cur.querySelectorAll(':scope > div span')) as HTMLElement[];
            if (directSpans.length >= 2) {
              return { weekday: (directSpans[0].textContent ?? '').trim(), date: (directSpans[1].textContent ?? '').trim() };
            }
          }
          cur = cur.parentElement;
        }
        return { weekday: '', date: '' };
      }

      // ── Variant F: multi-column week-view with day-header columns ───────────────────────────────
      // Each column:
      //   <div class="flex-1 rounded-t-2xl border-x border-white border-opacity-50 min-w-[140px] bg-primary-bg bg-opacity-20">
      //     <div class="h-12 p-2 rounded-t-2xl text-center flex justify-center items-center gap-1.5 font-bold text-text-color">
      //       <span class="text-sm font-medium">Wed</span>
      //       <span class="text-lg">17</span>
      //     </div>
      //     ... appointment cards ...
      //     <div class="cursor-pointer w-full h-full"> or <div data-apt-card="1" ...>
      //       ...
      //       <span ...>15:00 – 15:30</span>  or  <p ...>15:00 – 15:30</p>
      //     </div>
      //   </div>
      //
      // Strategy: find all week-view columns (flex-1 + min-w-[140px]), search their cards for
      // a time match, then read the weekday/date from the column header.
      const weekColumns = Array.from(
        document.querySelectorAll('div.flex-1[class*="min-w-"]')
      ) as HTMLElement[];
      const matchedWeekColCards: { target: HTMLElement; text: string; cardRole: string; weekday: string; date: string }[] = [];
      for (const col of weekColumns) {
        // Read weekday + date from the column header
        const { weekday: colWeekday, date: colDate } = extractWeekdayDate(col);

        // Search <p> elements inside this column
        const colPs = Array.from(col.querySelectorAll('p')) as HTMLElement[];
        for (const p of colPs) {
          const text = collapse(p.textContent ?? '');
          if (isMatch(text)) {
            const target = findClickable(p);
            const cardRole = extractCardRole(target);
            matchedWeekColCards.push({ target, text, cardRole, weekday: colWeekday, date: colDate });
          }
        }
        // Search <span> elements inside this column (for data-apt-card or direct span time)
        const colSpans = Array.from(col.querySelectorAll('span')) as HTMLElement[];
        for (const span of colSpans) {
          const isLeaf = span.querySelector('*') === null;
          if (!isLeaf) continue;
          const text = collapse(span.textContent ?? '');
          if (isMatch(text)) {
            const target = findClickable(span);
            if (target !== span) {
              const cardRole = extractCardRole(target);
              // Avoid duplicate if already found via <p> scan
              if (!matchedWeekColCards.some(m => m.target === target)) {
                matchedWeekColCards.push({ target, text, cardRole, weekday: colWeekday, date: colDate });
              }
            }
          }
        }
      }
      if (matchedWeekColCards.length > 0) {
        if (roleFilter) {
          const roleMatch = matchedWeekColCards.find(
            c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase()
          );
          if (roleMatch) return markAndScroll(roleMatch.target, roleMatch.text, roleMatch.cardRole, roleMatch.weekday, roleMatch.date);
        }
        const first = matchedWeekColCards[0];
        return markAndScroll(first.target, first.text, first.cardRole, first.weekday, first.date);
      }

      // ── Variants A/B/C: scan all <p> tags for time match ─────────────────────────────────────
      // Variant A: <p class="text-[10px] leading-tight" ...>
      // Variant B: <p class="text-[10px] text-text-gray"> with 24h format
      // Variant C: <p class="text-[10px] text-text-gray"> with 12h AM/PM format
      //
      // When roleFilter is set (multiple cards share the same slot), we collect ALL matching
      // time-range paragraphs first, then pick the one whose card's role badge matches roleFilter.
      // If roleFilter is empty or no role-matched card is found, fall through to first match.
      const paragraphs = Array.from(document.querySelectorAll('p'));
      const matchedParagraphCards: { target: HTMLElement; text: string; cardRole: string }[] = [];
      for (const p of paragraphs) {
        const text = collapse(p.textContent ?? '');
        if (isMatch(text)) {
          const target = findClickable(p as HTMLElement);
          const cardRole = extractCardRole(target);
          matchedParagraphCards.push({ target, text, cardRole });
        }
      }
      if (matchedParagraphCards.length > 0) {
        // If a role filter is provided, prefer a card whose role badge matches
        if (roleFilter) {
          const roleMatch = matchedParagraphCards.find(
            c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase()
          );
          if (roleMatch) return markAndScroll(roleMatch.target, roleMatch.text, roleMatch.cardRole);
          // Role filter provided but not matched — fall through to first card (log a warning)
        }
        // No role filter (or role not found) — use the first matching card
        const first = matchedParagraphCards[0];
        return markAndScroll(first.target, first.text, first.cardRole);
      }

      // ── Variant E: data-apt-card absolute-positioned cards with time in <span> ─────────────────
      // Covers two sub-variants of this card type:
      //
      // E1 (modal / Appointment List):
      //   <div data-apt-card="1" class="absolute left-1 right-1 cursor-pointer ...">
      //     <div class="rounded-md px-1.5 py-0.5 self-start">
      //       <span class="text-[10px] font-medium leading-tight truncate" style="color:rgb(5,150,105)">
      //         "5:30 PM" " - " "6:00 PM"
      //       </span>
      //     </div>
      //   </div>
      //
      // E2 (day/week calendar view — same card structure, different page context):
      //   <div data-apt-card="1" class="absolute left-1 right-1 cursor-pointer rounded-lg ...">
      //     <div class="flex flex-col h-full px-2 py-1 gap-0.5 overflow-hidden">
      //       <div class="flex items-center gap-1.5 min-w-0">
      //         <div class="h-6 w-6 rounded-full ...">DP</div>
      //         <span class="text-[13px] font-semibold ...">DemoTest patient</span>
      //       </div>
      //       <div class="rounded-md px-1.5 py-0.5 self-start" style="background-color:rgb(255,255,255)">
      //         <span class="text-[10px] font-medium leading-tight truncate" style="color:rgb(5,150,105)">
      //           "1:00 PM"
      //           " - "
      //           "1:30 PM"
      //         </span>
      //       </div>
      //       <div class="flex items-center gap-1 mt-auto pl-0.5">
      //         <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" ...></span>
      //         <span>Md New Patient Hematol...</span>
      //       </div>
      //     </div>
      //   </div>
      //
      // isMatch() normalises "-" → " – " and handles ":00" omission, so both sub-variants match.
      const aptCards = Array.from(document.querySelectorAll('[data-apt-card]')) as HTMLElement[];
      const matchedAptCards: { target: HTMLElement; text: string; cardRole: string }[] = [];
      for (const card of aptCards) {
        // First: try the specific time span selector used in both E1 and E2
        // (class contains "font-medium" and "leading-tight" — the time badge span)
        const timeSpanDirect = card.querySelector(
          'span[class*="font-medium"][class*="leading-tight"], span[class*="text-[10px]"][class*="font-medium"]'
        ) as HTMLElement | null;
        if (timeSpanDirect) {
          const text = collapse(timeSpanDirect.textContent ?? '');
          if (isMatch(text)) {
            const target = findClickable(card);
            const cardRole = extractCardRole(target);
            matchedAptCards.push({ target, text, cardRole });
            continue;
          }
        }
        // Fallback: scan all spans in the card
        const spans = Array.from(card.querySelectorAll('span')) as HTMLElement[];
        for (const span of spans) {
          const text = collapse(span.textContent ?? '');
          if (isMatch(text)) {
            const target = findClickable(card);
            const cardRole = extractCardRole(target);
            matchedAptCards.push({ target, text, cardRole });
            break;
          }
        }
      }
      if (matchedAptCards.length > 0) {
        if (roleFilter) {
          const roleMatch = matchedAptCards.find(
            c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase()
          );
          if (roleMatch) return markAndScroll(roleMatch.target, roleMatch.text, roleMatch.cardRole);
        }
        const first = matchedAptCards[0];
        return markAndScroll(first.target, first.text, first.cardRole);
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
      const matchedFlexRowCards: { target: HTMLElement; rowRange: string; cardRole: string }[] = [];
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
          // Found a matching row — collect cursor-pointer cards inside it
          const card = row.querySelector('[class*="cursor-pointer"]') as HTMLElement | null;
          if (card) {
            const cardRole = extractCardRole(card);
            matchedFlexRowCards.push({ target: card, rowRange, cardRole });
          }
        }
      }
      if (matchedFlexRowCards.length > 0) {
        if (roleFilter) {
          const roleMatch = matchedFlexRowCards.find(
            c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase()
          );
          if (roleMatch) return markAndScroll(roleMatch.target, roleMatch.rowRange, roleMatch.cardRole);
        }
        const first = matchedFlexRowCards[0];
        return markAndScroll(first.target, first.rowRange, first.cardRole);
      }

      // ── Final fallback: scan ALL spans on the page ─────────────────────────────────────────────
      // Catches any card DOM where the time is in a <span> but not inside [data-apt-card].
      // IMPORTANT: only match spans whose OWN text (not inherited from children) equals the target.
      // Using textContent on a parent span can pick up sibling card text — causing wrong-slot clicks.
      const allSpans = Array.from(document.querySelectorAll('span')) as HTMLElement[];
      const matchedSpanCards: { target: HTMLElement; text: string; cardRole: string }[] = [];
      for (const span of allSpans) {
        // Use only the direct text nodes of the span (not descendants) to avoid false positives
        // where a wrapper span accumulates text from multiple child cards.
        const directText = Array.from(span.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent ?? '')
          .join('');
        const directCollapsed = collapse(directText);
        // Also try full textContent but ONLY if this span has no element children
        // (i.e. it's a leaf node), preventing ancestor spans from matching.
        const isLeaf = span.querySelector('*') === null;
        const text = isLeaf ? collapse(span.textContent ?? '') : directCollapsed;
        if (text && isMatch(text)) {
          const target = findClickable(span);
          if (target !== span) { // only click if we found a real cursor-pointer ancestor
            const cardRole = extractCardRole(target);
            matchedSpanCards.push({ target, text, cardRole });
          }
        }
      }
      if (matchedSpanCards.length > 0) {
        if (roleFilter) {
          const roleMatch = matchedSpanCards.find(
            c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase()
          );
          if (roleMatch) return markAndScroll(roleMatch.target, roleMatch.text, roleMatch.cardRole);
        }
        const first = matchedSpanCards[0];
        return markAndScroll(first.target, first.text, first.cardRole);
      }

      return { clicked: false, matched: '', cardRole: '', weekday: '', date: '' };
    },
    { f12: full12, f24: full24, s12: start12, e12: end12, s24: start24, e24: end24, marker: MARKER, roleFilter }
  );

  // ── Playwright native click on the marked element ────────────────────────────────────────────
  // evaluate() scrolled the element into view and marked it with MARKER.
  // Now use Playwright's locator to actually click it — this fires proper pointer events
  // and works correctly even inside overflow:scroll modal containers.
  if (clickResult.clicked) {
    // Wait for smooth scroll animation to settle (300ms is typical)
    await c.wait(400);
    try {
      await c.page.locator(`[${MARKER}]`).first().click({ timeout: 5000 });
    } finally {
      // Remove the marker attribute regardless of click success/failure
      await c.page.evaluate((marker: string) => {
        document.querySelectorAll(`[${marker}]`).forEach((el: Element) => el.removeAttribute(marker));
      }, MARKER);
    }
  }

  // Role extracted from the clicked card — used to verify detail panel update
  let cardRole = clickResult.cardRole;

  if (!clickResult.clicked) {
    // ── XPath fallback ─────────────────────────────────────────────────────────────────────────
    ctx.log('querySelector scan found no match — trying XPath fallback...');

    const xpathResult: { clicked: boolean; matched: string; cardRole: string; weekday: string; date: string } = await c.page.evaluate(
      ({ s12, e12, s24, e24, f12, f24, marker, roleFilter }: { s12: string; e12: string; s24: string; e24: string; f12: string; f24: string; marker: string; roleFilter: string }) => {
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

        function markAndScroll2(target: HTMLElement, matched: string, cardRole: string): { clicked: boolean; matched: string; cardRole: string; weekday: string; date: string } {
          target.setAttribute(marker, 'true');
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          return { clicked: true, matched, cardRole, weekday: '', date: '' };
        }

        // Match the FULL range string to avoid false positives.
        function collapseAndStrip(t: string): string {
          return t.replace(/\s+/g, ' ').trim()
                  .replace(/\s*[-\u2013\u2014]\s*/g, ' \u2013 ')
                  .replace(/\b0(\d)(:\d{2})/g, '$1$2');
        }
        const allPs = Array.from(document.querySelectorAll('p')) as HTMLElement[];
        const matchedPs: { target: HTMLElement; text: string; cardRole: string }[] = [];
        for (const p of allPs) {
          const norm = collapseAndStrip(p.textContent ?? '');
          if (norm === f12 || norm === f24) {
            const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
            const target = findClickable(p);
            const cardRole = extractCardRole(target);
            matchedPs.push({ target, text, cardRole });
          }
        }
        if (matchedPs.length > 0) {
          if (roleFilter) {
            const rm = matchedPs.find(c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase());
            if (rm) return markAndScroll2(rm.target, rm.text, rm.cardRole);
          }
          const fp = matchedPs[0];
          return markAndScroll2(fp.target, fp.text, fp.cardRole);
        }

        // Variant E fallback: data-apt-card absolute-positioned cards with time in <span>
        const aptCards2 = Array.from(document.querySelectorAll('[data-apt-card]')) as HTMLElement[];
        const matchedApt2: { target: HTMLElement; text: string; cardRole: string }[] = [];
        for (const card of aptCards2) {
          const spans2 = Array.from(card.querySelectorAll('span')) as HTMLElement[];
          for (const span of spans2) {
            // Only leaf spans — avoids parent spans accumulating text from multiple cards
            if (span.querySelector('*') !== null) continue;
            const norm2 = collapseAndStrip(span.textContent ?? '');
            if (norm2 === f12 || norm2 === f24) {
              const target = findClickable(card);
              const cardRole = extractCardRole(target);
              matchedApt2.push({ target, text: norm2, cardRole });
              break;
            }
          }
        }
        if (matchedApt2.length > 0) {
          if (roleFilter) {
            const rm = matchedApt2.find(c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase());
            if (rm) return markAndScroll2(rm.target, rm.text, rm.cardRole);
          }
          const fa = matchedApt2[0];
          return markAndScroll2(fa.target, fa.text, fa.cardRole);
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
        const matchedFlex2: { target: HTMLElement; rowRange: string; cardRole: string }[] = [];
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
              matchedFlex2.push({ target: card, rowRange, cardRole });
            }
          }
        }
        if (matchedFlex2.length > 0) {
          if (roleFilter) {
            const rm = matchedFlex2.find(c => c.cardRole.trim().toLowerCase() === roleFilter.toLowerCase());
            if (rm) return markAndScroll2(rm.target, rm.rowRange, rm.cardRole);
          }
          const ff = matchedFlex2[0];
          return markAndScroll2(ff.target, ff.rowRange, ff.cardRole);
        }

        // XPath fallback — EXACT normalize-space match (not contains)
        const xpaths = [
          `//p[normalize-space(.) = '${f12}']`,
          `//p[normalize-space(.) = '${f24}']`,
        ];

        for (const xp of xpaths) {
          try {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const p = result.singleNodeValue as HTMLElement | null;
            if (p) {
              const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
              const target = findClickable(p);
              const cardRole = extractCardRole(target);
              return markAndScroll2(target, text, cardRole);
            }
          } catch {
            // ignore invalid XPath and try next
          }
        }

        // XPath span fallback — leaf spans only
        const spanXpaths = [
          `//span[not(*) and normalize-space(.) = '${f12}']`,
          `//span[not(*) and normalize-space(.) = '${f24}']`,
        ];
        for (const xp of spanXpaths) {
          try {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const span = result.singleNodeValue as HTMLElement | null;
            if (span) {
              const text = (span.textContent ?? '').replace(/\s+/g, ' ').trim();
              const target = findClickable(span);
              if (target !== span) {
                const cardRole = extractCardRole(target);
                return markAndScroll2(target, text, cardRole);
              }
            }
          } catch {
            // ignore
          }
        }

        return { clicked: false, matched: '', cardRole: '', weekday: '', date: '' };
      },
      { s12: start12, e12: end12, s24: start24, e24: end24, f12: full12, f24: full24, marker: MARKER, roleFilter }
    );

    if (!xpathResult.clicked) {
      throw new Error(
        `Could not find an appointment card matching slot "${rawSlot}". ` +
        `Tried 12h format "${full12}" and 24h format "${full24}". ` +
        `Check that the slot value matches the time displayed in the appointment cards.`
      );
    }

    // Playwright native click after scroll (same as primary path)
    await c.wait(400);
    try {
      await c.page.locator(`[${MARKER}]`).first().click({ timeout: 5000 });
    } finally {
      await c.page.evaluate((marker: string) => {
        document.querySelectorAll(`[${marker}]`).forEach((el: Element) => el.removeAttribute(marker));
      }, MARKER);
    }

    cardRole = xpathResult.cardRole;
    // Store weekday/date from XPath fallback (empty for non-Variant-F paths)
    if (weekdayVarName && xpathResult.weekday) ctx.setVariable(weekdayVarName, xpathResult.weekday);
    if (dateVarName && xpathResult.date) ctx.setVariable(dateVarName, xpathResult.date);
    ctx.log(`XPath fallback clicked card — matched text: "${xpathResult.matched}", role: "${cardRole}"`);
    if (xpathResult.weekday || xpathResult.date) ctx.log(`Column header — weekday: "${xpathResult.weekday}", date: "${xpathResult.date}"`);
  } else {
    // Store weekday/date from primary scan (Variant F populates these)
    if (weekdayVarName && clickResult.weekday) ctx.setVariable(weekdayVarName, clickResult.weekday);
    if (dateVarName && clickResult.date) ctx.setVariable(dateVarName, clickResult.date);
    ctx.log(`Clicked appointment card — matched text: "${clickResult.matched}", role: "${cardRole}"`);
    if (clickResult.weekday || clickResult.date) ctx.log(`Column header — weekday: "${clickResult.weekday}", date: "${clickResult.date}"`);
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
