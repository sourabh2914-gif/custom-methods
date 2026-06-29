import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot
 * description: Click the first available time slot and store in $[selectedSlot], store first morning slot in $[firstSlot] and last evening/afternoon slot in $[lastSlot]
 * actionType: custom_click_available_time_slot
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlot(ctx: WalnutContext) {
  // ctx.args[0] = "selectedSlot" (from $[selectedSlot]) — clicked slot runtime variable name
  // ctx.args[1] = "firstSlot"    (from $[firstSlot])    — first morning slot (faded or unfaded)
  // ctx.args[2] = "lastSlot"     (from $[lastSlot])     — last evening slot (fallback: last afternoon slot)
  //
  // Supports three DOM variants:
  //
  // Variant A — slots inside a grid-cols-3 wrapper (old DOM):
  //   <div class="grid grid-cols-3 gap-2 pt-3">
  //     <div class="relative">
  //       <button class="... cursor-not-allowed" disabled>10:30 AM – 11:00 AM</button>   ← booked
  //     </div>
  //     <div class="relative">
  //       <button class="... cursor-pointer">10:00 AM – 10:30 AM</button>                ← available
  //     </div>
  //   </div>
  //   Section tabs: <button class="... font-bold ..."><span>Morning</span></button>
  //
  // Variant B — slots in individual relative divs, no grid-cols-3 wrapper:
  //   <div class="relative">
  //     <button class="w-full py-2 px-1 ... bg-gray-100 text-gray-600 ... cursor-pointer">
  //       09:30 AM – 10:00 AM
  //     </button>
  //   </div>
  //   Section tabs: <button class="flex-1 flex items-center ..."><img ...> Evening</button>  (img + text node)
  //
  //   Variant C — grid-cols-2 wrapper, 24-hour time format, bg-white for available slots:
  //   <div class="bg-[#F5F5F5] grid grid-cols-2 gap-2 p-3" style="position: relative; z-index: 1;">
  //     <button class="relative py-1.5 px-1 text-[11px] font-medium rounded-full ... bg-white text-[#555] hover:bg-gray-50">
  //       12:00 – 12:30
  //     </button>
  //   </div>
  //   Section tabs: <button class="flex-1 flex items-center justify-center gap-1.5 py-2.5 ...">
  //     <span class="relative z-10">Afternoon</span>
  //     <span class="relative z-10 text-[9px] bg-[#3279AD] text-white rounded-full px-1.5">10</span>
  //   </button>
  //
  //   Variant E — div-based tabs (NOT button), grid-cols-3 slot grid, 24-hour time format:
  //   Tab: <div class="flex gap-2 px-4 py-2 items-center rounded-t-xl cursor-pointer transition-colors text-gray-500 hover:bg-gray-100">
  //           <svg .../><span class="font-medium text-[12px]">Morning</span>
  //        </div>
  //   Active tab: bg-[#F5F0E8] text-gray-800 on the div
  //   Slots: <div class="rounded-b-3xl bg-[#F5F0E8] p-4 min-h-[100px] rounded-tl-3xl">
  //            <div class="grid grid-cols-3 gap-2">
  //              <button class="py-2 text-[11px] h-[30px] rounded-full font-medium transition-colors bg-white text-gray-600 hover:bg-gray-100">17:00 – 17:30</button>
  //            </div>
  //          </div>
  //
  // Available (clickable) slot = button NOT disabled, NOT cursor-not-allowed
  //                              has cursor-pointer (A/B) OR bg-white/hover:bg-gray-50 (C)
  // Faded/disabled slot        = button has @disabled attribute (captured for firstSlot/lastSlot)
  // Time format: 12-hour "09:30 AM – 10:00 AM" (A/B) or 24-hour "12:00 – 12:30" (C)
  //
  // Logic:
  //   1. Try Morning  → click tab if not active → find first non-disabled future slot → click it
  //   2. No slots in Morning → try Afternoon
  //   3. No slots in Afternoon → try Evening
  //   4. Throw if no clickable slot found in any section
  //
  // firstSlot / lastSlot capture (independent of click logic):
  //   - firstSlot = first slot in Morning (faded or unfaded), NO time filter — always the very
  //                 first morning slot regardless of whether the morning has passed
  //   - lastSlot  = last future slot in Evening (faded or unfaded);
  //                 if Evening has no slots, use last future slot in Afternoon

  const c = ctx as any;
  const outputVar  = ctx.args[0]; // from $[selectedSlot]
  const firstSlotVar = ctx.args[1]; // from $[firstSlot]
  const lastSlotVar  = ctx.args[2]; // from $[lastSlot]

  const sections = ['Morning', 'Afternoon', 'Evening'];

  // Tab XPath — supports all DOM variants:
  //   Variant A: <button><span>Morning</span></button>
  //   Variant B: <button><img alt="Morning" ...>"Morning"</button>  (has <img>, text node alongside)
  //   Variant C: <button ...><span class="relative z-10">Afternoon</span><span ...>10</span></button>
  //   Variant D: <button>🌙 Evening</button> or <button><svg .../>Evening</button> (icon + direct text)
  //   Variant E: <div class="flex gap-2 px-4 py-2 ... cursor-pointer ..."><svg .../><span class="font-medium text-[12px]">Morning</span></div>
  //              (tabs are <div> elements, NOT <button>, with SVG icon + span label)
  const findTabXpath = (label: string) =>
    `//*[` +
      `(self::button or (self::div and contains(@class,'cursor-pointer')))` +  // Variant A-D: button; Variant E: clickable div
      ` and (` +
        `.//span[normalize-space(text())='${label}']` +                    // Variant A, C, E: span contains label
        ` or (.//img and contains(normalize-space(.),'${label}'))` +       // Variant B: img sibling + text
        ` or (not(.//span[contains(@class,'rounded')]) and contains(normalize-space(.),'${label}') and not(contains(normalize-space(.),':')) and not(contains(normalize-space(.),'–')) and not(contains(normalize-space(.), ' - ')))` + // Variant D: direct text, no slot-like range
      `)` +
    `]`;

  // XPath for visible time-slot buttons — used for the click action.
  // NOTE: We do NOT filter by @disabled here because some apps (e.g. HHCS) mark slots with
  // the @disabled attribute purely for their booking-policy styling, even though the slot is
  // visually available and fully clickable. We use { force: true } on the Playwright click to
  // bypass Playwright's disabled-element guard and dispatch the click directly.
  // We only exclude slots that are visually booked/selected (bg color classes, opacity, line-through).
  const availableSlotXpath =
    `//button[` +
      `not(contains(@class,'cursor-not-allowed'))` +
      ` and contains(normalize-space(.),':')` +        // time slots contain ":"
      ` and (contains(normalize-space(.), '–') or contains(normalize-space(.), ' - '))` + // must be a range
      ` and not(contains(@class,'flex-1'))` +          // exclude section tab buttons
      ` and not(contains(@class,'bg-blue-500'))` +     // exclude already-selected slots
      ` and not(contains(@class,'bg-blue-600'))` +
      ` and not(contains(@class,'bg-blue-700'))` +
      ` and not(contains(@class,'bg-primary'))` +
      ` and not(contains(@class,'bg-black'))` +
      ` and not(contains(@class,'bg-gray-900'))` +
      ` and not(contains(@class,'opacity-50'))` +      // exclude visually booked/greyed slots
      ` and not(contains(@class,'opacity-40'))` +
      ` and not(contains(@class,'line-through'))` +
      ` and not(contains(@class,'bg-[#3279AD]'))` +
    `]`;

  // XPath for ALL slots (faded/disabled included) — used for firstSlot/lastSlot capture.
  // Key insight: time SLOT buttons always show a RANGE e.g. "09:00 AM – 09:30 AM" or "12:00 – 12:30".
  // Calendar row-header buttons show only a single time ("7:30 PM") and must be excluded.
  // We detect a range by requiring either an en-dash (– U+2013) or a hyphen-minus (-).
  const allSlotsXpath =
    `//button[` +
      `contains(normalize-space(.),':')` +             // time slots contain ":"
      ` and (contains(normalize-space(.), '–') or contains(normalize-space(.), ' - '))` + // must be a range (e.g. "09:00 AM – 09:30 AM"), not a single time label
      ` and not(contains(@class,'flex-1'))` +          // exclude section tab buttons
      ` and not(contains(@class,'bg-blue-500'))` +     // exclude selected/nav buttons
      ` and not(contains(@class,'bg-blue-600'))` +
      ` and not(contains(@class,'bg-blue-700'))` +
      ` and not(contains(@class,'bg-primary'))` +
      ` and not(contains(@class,'bg-black'))` +
      ` and not(contains(@class,'bg-gray-900'))` +
      ` and not(contains(@class,'bg-[#3279AD]'))` +
    `]`;

  // Current system time in minutes-since-midnight (used to skip past slots for TODAY only)
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const todayDay = nowDate.getDate(); // e.g. 21
  ctx.log(`Current system time: ${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')} (${nowMinutes} min since midnight)`);

  // Detect the selected/active date from the calendar DOM.
  // The active date button is typically highlighted (e.g. dark background, text-white, rounded-full).
  // We read the text content of the selected date button and compare to today's date.
  // If the selected date is NOT today, we skip the time filter entirely.
  const selectedDay: number | null = await c.page.evaluate((): number | null => {
    // Helper: parse RGB string "rgb(R, G, B)" → { r, g, b }
    function parseRgb(color: string): { r: number; g: number; b: number } | null {
      const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) return null;
      return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
    }
    // Helper: is a color "dark" (luminance < 0.15 — solid dark fill, not white/light/transparent)
    function isDark(color: string): boolean {
      const rgb = parseRgb(color);
      if (!rgb) return false;
      // Relative luminance formula
      const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      const L = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
      return L < 0.15; // dark enough to be a "selected" fill
    }
    // Helper: is color transparent or white/near-white (today outline indicator)
    function isLightOrTransparent(color: string): boolean {
      if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return true;
      const rgb = parseRgb(color);
      if (!rgb) return true;
      return rgb.r > 200 && rgb.g > 200 && rgb.b > 200;
    }

    // Strategy 1: aria-pressed="true" or aria-selected="true"
    const ariaSelected = document.querySelector(
      'button[aria-pressed="true"], button[aria-selected="true"], [role="gridcell"][aria-selected="true"]'
    ) as HTMLElement | null;
    if (ariaSelected) {
      const n = parseInt((ariaSelected.textContent ?? '').trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= 31) return n;
    }

    const allDateBtns = Array.from(document.querySelectorAll('button')) as HTMLElement[];

    // Strategy 2: explicit dark Tailwind bg class (fast, covers most cases)
    for (const btn of allDateBtns) {
      const cls = btn.className || '';
      const txt = (btn.textContent ?? '').trim();
      const num = parseInt(txt, 10);
      if (isNaN(num) || num < 1 || num > 31) continue;
      if (
        cls.includes('bg-black') ||
        cls.includes('bg-gray-900') ||
        cls.includes('bg-gray-800') ||
        cls.includes('bg-primary') ||
        cls.includes('bg-blue-600') ||
        cls.includes('bg-blue-500') ||
        cls.includes('bg-blue-700')
      ) {
        return num;
      }
    }

    // Strategy 3: computed background-color is dark (catches arbitrary Tailwind values like bg-[#1a1a1a])
    // Skip buttons whose bg is light/transparent (today outline indicator uses those)
    for (const btn of allDateBtns) {
      const txt = (btn.textContent ?? '').trim();
      const num = parseInt(txt, 10);
      if (isNaN(num) || num < 1 || num > 31) continue;
      const bg = window.getComputedStyle(btn).backgroundColor;
      if (!isLightOrTransparent(bg) && isDark(bg)) {
        return num;
      }
    }

    // Strategy 4: rounded-full + text-white, excluding light/outline today indicators
    for (const btn of allDateBtns) {
      const cls = btn.className || '';
      const txt = (btn.textContent ?? '').trim();
      const num = parseInt(txt, 10);
      if (isNaN(num) || num < 1 || num > 31) continue;
      if (
        cls.includes('rounded-full') &&
        cls.includes('text-white') &&
        !cls.includes('bg-transparent') &&
        !cls.includes('bg-white') &&
        !cls.includes('bg-gray-100') &&
        !cls.includes('bg-gray-50')
      ) {
        return num;
      }
    }

    // Strategy 5: arbitrary hex bg class e.g. bg-[#1a1a1a] — Variant C selected date
    for (const btn of allDateBtns) {
      const cls = btn.className || '';
      const txt = (btn.textContent ?? '').trim();
      const num = parseInt(txt, 10);
      if (isNaN(num) || num < 1 || num > 31) continue;
      // Match bg-[#xxxxxx] or bg-[#xxx] patterns used by Tailwind JIT for selected date
      if (/bg-\[#[0-9a-fA-F]{3,8}\]/.test(cls) && cls.includes('rounded')) {
        return num;
      }
    }

    // Strategy 6: widest computed-style sweep — any non-light/non-transparent bg,
    // relaxed luminance threshold (< 0.40) to catch mid-dark fills like deep blue/navy/teal
    for (const btn of allDateBtns) {
      const txt = (btn.textContent ?? '').trim();
      const num = parseInt(txt, 10);
      if (isNaN(num) || num < 1 || num > 31) continue;
      const bg = window.getComputedStyle(btn).backgroundColor;
      if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      const rgb2 = parseRgb(bg);
      if (!rgb2) continue;
      // Skip clearly white/near-white
      if (rgb2.r > 220 && rgb2.g > 220 && rgb2.b > 220) continue;
      // Accept any non-white, non-transparent solid fill (catches dark blue, navy, teal, etc.)
      const toLinear2 = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      const L2 = 0.2126 * toLinear2(rgb2.r) + 0.7152 * toLinear2(rgb2.g) + 0.0722 * toLinear2(rgb2.b);
      if (L2 < 0.40) {
        return num;
      }
    }

    return null;
  });

  // Time filter only applies when the selected date is TODAY.
  // For future dates, all slots are valid regardless of current system time.
  // Default to false (permissive) when date detection fails — better to show all slots than none.
  const isToday = selectedDay !== null ? selectedDay === todayDay : false;
  ctx.log(`Selected day in calendar: ${selectedDay ?? 'undetected'}, today: ${todayDay}, isToday: ${isToday}`);
  if (isToday) {
    ctx.log(`Time filter ON (today selected) — skipping slots with start time ≤ ${Math.floor(nowMinutes / 60)}:${String(nowMinutes % 60).padStart(2, '0')} (current system time)`);
  } else {
    ctx.log(`Time filter OFF — future date selected, all slots are valid`);
  }

  /**
   * Parse a slot's start time from its label and return minutes-since-midnight, or null if unparseable.
   * Supports:
   *   - 12-hour format: "09:30 AM – 10:00 AM"  (Variant A / B)
   *   - 24-hour format: "12:00 – 12:30"         (Variant C)
   */
  function parseSlotStartMinutes(slotText: string): number | null {
    // Try 12-hour format first: "09:30 AM" from "09:30 AM – 10:00 AM"
    const match12 = slotText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'AM') {
        if (hours === 12) hours = 0;          // 12:xx AM → 0:xx
      } else {
        if (hours !== 12) hours += 12;        // 1:xx PM → 13:xx, but 12:xx PM stays 12
      }
      return hours * 60 + minutes;
    }
    // Try 24-hour format: "12:00" from "12:00 – 12:30" (Variant C)
    const match24 = slotText.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 60 + minutes;
      }
    }
    return null;
  }

  /**
   * Click a section tab and collect slots from it.
   * Slots are scoped to the VISIBLE slot panel only — not global XPath across the whole page.
   * This prevents cross-section contamination when all three panels are in the DOM simultaneously.
   *
   * @param section  The tab label ('Morning', 'Afternoon', 'Evening')
   * @param xpath    The slot XPath to evaluate (allSlotsXpath or availableSlotXpath)
   * @returns        Array of slot text labels in DOM order, or [] if tab not found
   */
  async function collectSlotsFromSection(section: string, xpath: string): Promise<string[]> {
    const tabXpath = findTabXpath(section);

    // Check tab exists — do NOT skip based on @disabled attribute.
    // Some apps (e.g. HHCS) set disabled on tab buttons purely for styling even when
    // the section has slots. We click with force:true and let the slot count decide.
    const tabExists = await c.page.evaluate((xp: string) => {
      const r = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return r.singleNodeValue != null;
    }, tabXpath);

    if (!tabExists) return [];

    // Always click the tab to make it active — this ensures the correct slot grid is visible.
    // Clicking an already-active tab is harmless (it re-renders the same content).
    await c.page.locator(`xpath=${tabXpath}`).first().click();
    await c.wait(700);

    // Collect slots using page.evaluate with the provided XPath.
    // IMPORTANT: This XPath runs after the tab click, so only the active section's slots
    // are in the visible DOM. All three panels render simultaneously in some apps (hidden
    // via CSS), so we add a visibility check: only count buttons that are actually visible.
    const rawSlots: string[] = await c.page.evaluate((xp: string) => {
      const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const texts: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        // Only include slots that are currently visible (not hidden by CSS tab switching)
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        // Also check CSS visibility / display
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const text = (el.textContent ?? '').trim();
        if (text) texts.push(text);
      }
      return texts;
    }, xpath);

    return rawSlots;
  }

  /**
   * Activate Morning tab and collect ALL slots (faded + unfaded) with NO time filter.
   * Used for firstSlot capture.
   */
  async function collectAllSlotsInSection(section: string): Promise<string[]> {
    return collectSlotsFromSection(section, allSlotsXpath);
  }

  /**
   * Activate a section tab and collect all future slots (faded + unfaded) visible in that section.
   * Returns the list of slot texts (in DOM order), or empty array if tab not found / disabled.
   */
  async function collectAllFutureSlotsInSection(section: string): Promise<string[]> {
    const rawSlots = await collectSlotsFromSection(section, allSlotsXpath);
    // Only filter by current system time when TODAY is selected.
    // For future dates, all slots are valid regardless of current system time.
    if (!isToday) return rawSlots;
    return rawSlots.filter(text => {
      const startMin = parseSlotStartMinutes(text);
      if (startMin === null) return false;
      return startMin > nowMinutes;
    });
  }

  // ── Wait for the slot panel to load after date selection ───────────────────────────────────────
  // The slot picker (Morning/Afternoon/Evening tabs) loads asynchronously after a date is clicked.
  // Use Playwright's native waitForSelector — page.evaluate with setInterval does NOT await async
  // browser timers; it resolves immediately, so use waitForSelector instead.
  ctx.log('Waiting for slot panel (Morning/Afternoon/Evening tabs) to appear...');
  try {
    // Wait for any tab label to appear — covers all DOM variants:
    //   Variant A/B/C/D: <button>...<span>Morning</span>...</button>
    //   Variant E:       <div class="... cursor-pointer ..."><svg/><span>Morning</span></div>
    await Promise.race([
      // Variant A/C/D/E: any element containing span with section label
      c.page.waitForSelector('xpath=//*[.//span[normalize-space(text())="Morning"] or .//span[normalize-space(text())="Afternoon"] or .//span[normalize-space(text())="Evening"]]', { timeout: 8000 }),
      // Variant B: button with img child
      c.page.waitForSelector('xpath=//button[.//img and (contains(normalize-space(.),"Morning") or contains(normalize-space(.),"Evening"))]', { timeout: 8000 }),
    ]).catch(() => null);
    ctx.log('Slot panel detected — proceeding');
  } catch {
    ctx.log('WARNING: Slot panel wait timed out — proceeding anyway');
  }
  // Brief wait for slot grid to fully render after tabs appear
  await c.wait(500);

  // ── Phase 1: Capture firstSlot (Morning) and lastSlot (Evening, fallback Afternoon) ──────────

  ctx.log('Phase 1: Collecting first/last slots across sections...');

  // firstSlot uses NO time filter — switch to Morning tab and grab the very first slot
  // even if the morning section has already passed (e.g. it's now afternoon)
  const morningSlotsRaw = await collectAllSlotsInSection('Morning');
  ctx.log(`Morning slots (no time filter): ${morningSlotsRaw.length}`);

  const afternoonSlotsAll = await collectAllFutureSlotsInSection('Afternoon');
  ctx.log(`Afternoon future slots (all): ${afternoonSlotsAll.length}`);

  const eveningSlotsAll = await collectAllFutureSlotsInSection('Evening');
  ctx.log(`Evening future slots (all): ${eveningSlotsAll.length}`);

  // firstSlot = first slot in Morning (faded or unfaded), no time filter
  const firstSlotText = morningSlotsRaw.length > 0 ? morningSlotsRaw[0] : null;

  // lastSlot = last slot in Evening; if none, last in Afternoon; if none, last in Morning
  const lastSlotText =
    eveningSlotsAll.length > 0
      ? eveningSlotsAll[eveningSlotsAll.length - 1]
      : afternoonSlotsAll.length > 0
        ? afternoonSlotsAll[afternoonSlotsAll.length - 1]
        : morningSlotsRaw.length > 0
          ? morningSlotsRaw[morningSlotsRaw.length - 1]
          : null;

  if (firstSlotText && firstSlotVar) {
    ctx.setVariable(firstSlotVar, firstSlotText);
    ctx.log(`Stored first morning slot "${firstSlotText}" → $[${firstSlotVar}]`);
  } else if (!firstSlotText) {
    ctx.log('No future morning slots found — $[firstSlot] not set');
  }

  if (lastSlotText && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlotText);
    ctx.log(`Stored last slot "${lastSlotText}" → $[${lastSlotVar}]`);
  } else if (!lastSlotText) {
    ctx.log('No future afternoon/evening slots found — $[lastSlot] not set');
  }

  // ── Phase 2: Click the first available slot (Morning → Afternoon → Evening) ──────────────────

  ctx.log('Phase 2: Clicking first available slot...');

  for (const section of sections) {
    ctx.log(`Checking section: ${section}`);

    const tabXpath = findTabXpath(section);

    const tabExists = await c.page.evaluate((xp: string) => {
      const r = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return r.singleNodeValue != null;
    }, tabXpath);

    if (!tabExists) {
      ctx.log(`Section "${section}" tab not found — skipping`);
      continue;
    }

    const visibleSlots = await collectSlotsFromSection(section, availableSlotXpath);
    ctx.log(`Available slots in "${section}": ${visibleSlots.length}`);

    if (visibleSlots.length === 0) {
      ctx.log(`No clickable slots in "${section}" — moving to next section`);
      continue;
    }

    const slotText = visibleSlots[0];
    ctx.log(`Clicking slot "${slotText}" in "${section}"...`);

    const escapedText = slotText.replace(/'/g, "', \"'\", '");
    const slotXpathByText =
      `//button[` +
        `not(contains(@class,'flex-1'))` +
        ` and not(contains(@class,'bg-blue-500'))` +
        ` and not(contains(@class,'bg-blue-600'))` +
        ` and not(contains(@class,'bg-blue-700'))` +
        ` and not(contains(@class,'bg-primary'))` +
        ` and not(contains(@class,'bg-black'))` +
        ` and not(contains(@class,'bg-gray-900'))` +
        ` and not(contains(@class,'opacity-50'))` +
        ` and not(contains(@class,'opacity-40'))` +
        ` and not(contains(@class,'line-through'))` +
        ` and not(contains(@class,'bg-[#3279AD]'))` +
        ` and normalize-space(.)='${escapedText}'` +
      `]`;

    await c.page.locator(`xpath=${slotXpathByText}`).first().click({ force: true });
    await c.wait(800);

    ctx.log(`Clicked time slot: "${slotText}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, slotText);
      ctx.log(`Stored "${slotText}" → $[${outputVar}]`);
    }

    return;
  }

  throw new Error(
    `No available time slots found in Morning, Afternoon, or Evening. ` +
    `All slots may be booked or the date has no available slots.`
  );
}
