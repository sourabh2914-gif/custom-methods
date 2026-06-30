import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Available Time Slot Patient
 * description: Click the first available time slot and store in $[selectedSlot], store first morning slot in $[firstSlot] and last evening/afternoon slot in $[lastSlot]
 * actionType: custom_click_available_time_slot_patient
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function clickAvailableTimeSlotPatient(ctx: WalnutContext) {
  const c = ctx as any;
  const outputVar    = ctx.args[0];
  const firstSlotVar = ctx.args[1];
  const lastSlotVar  = ctx.args[2];

  const nowMs      = Date.now();
  const cutoffMs   = nowMs + 48 * 60 * 60 * 1000;
  const nowDate    = new Date(nowMs);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  ctx.log(`System time: ${nowDate.toISOString()} nowMinutes=${nowMinutes}`);
  ctx.log(`48h cutoff : ${new Date(cutoffMs).toISOString()}`);

  // ── Step 1: Collect + filter slots entirely inside the browser ───────────────────────────────
  // Passing nowMs and cutoffMs into evaluate avoids any Node↔browser string/timezone mismatch.
  // The browser parses slot times, compares against now, and returns only valid slot texts.

  async function collectFilteredSlots(): Promise<string[]> {
    return await c.page.evaluate(
      ({ nowMs, cutoffMs }: { nowMs: number; cutoffMs: number }): string[] => {
        const now    = new Date(nowMs);
        const cutoff = new Date(cutoffMs);

        // ── Detect selected calendar date ──────────────────────────────────────────────
        const MONTHS: Record<string, number> = {
          january:1, february:2, march:3, april:4, may:5, june:6,
          july:7, august:8, september:9, october:10, november:11, december:12,
          jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
        };
        let calMonth = 0, calYear = 0;
        for (const el of Array.from(document.querySelectorAll('*')) as HTMLElement[]) {
          const txt = (el.textContent ?? '').trim();
          if (txt.length >= 8 && txt.length < 30) {
            const m = txt.match(/([A-Za-z]+)\s+(\d{4})/);
            if (m) {
              const mon = MONTHS[m[1].toLowerCase()];
              const yr  = parseInt(m[2], 10);
              if (mon && yr) { calMonth = mon; calYear = yr; break; }
            }
          }
        }

        let activeDay = 0;
        // Strategy 1: aria-pressed / aria-selected
        for (const sel of ['button[aria-pressed="true"]', 'button[aria-selected="true"]', '[role="gridcell"][aria-selected="true"]']) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            const n = parseInt((el.textContent ?? '').trim(), 10);
            if (!isNaN(n) && n >= 1 && n <= 31) { activeDay = n; break; }
          }
        }
        // Strategy 2: dark bg Tailwind class
        if (!activeDay) {
          for (const btn of Array.from(document.querySelectorAll('button')) as HTMLElement[]) {
            const txt = (btn.textContent ?? '').trim();
            const num = parseInt(txt, 10);
            if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
            const cls = btn.className || '';
            if (cls.includes('bg-black') || cls.includes('bg-primary') || cls.includes('bg-blue') ||
                cls.includes('bg-gray-900') ||
                (cls.includes('rounded-full') && cls.includes('text-white'))) {
              activeDay = num; break;
            }
          }
        }
        // Strategy 3: computed dark background
        if (!activeDay) {
          for (const btn of Array.from(document.querySelectorAll('button')) as HTMLElement[]) {
            const txt = (btn.textContent ?? '').trim();
            const num = parseInt(txt, 10);
            if (isNaN(num) || num < 1 || num > 31 || txt !== String(num)) continue;
            const bg = window.getComputedStyle(btn).backgroundColor;
            const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (!m) continue;
            const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
            if (r < 210 || g < 210 || b < 210) { activeDay = num; break; }
          }
        }

        // Build the selected date (use browser's local now if calendar detection failed)
        const selMonth = calMonth || (now.getMonth() + 1);
        const selYear  = calYear  || now.getFullYear();
        const selDay   = activeDay || now.getDate();
        const selectedMidnight = new Date(selYear, selMonth - 1, selDay, 0, 0, 0, 0);

        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const isToday = selectedMidnight.getTime() === todayMidnight.getTime();

        // ── Parse start-time minutes from slot text ────────────────────────────────────
        function parseStartMin(text: string): number {
          // Normalize: collapse all whitespace-like chars, keep only printable ASCII
          const s = text.replace(/\s/g, ' ').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
          const m12 = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (m12) {
            let h = parseInt(m12[1], 10);
            const min = parseInt(m12[2], 10);
            if (m12[3].toUpperCase() === 'AM') { if (h === 12) h = 0; }
            else { if (h !== 12) h += 12; }
            return h * 60 + min;
          }
          const m24 = s.match(/(\d{1,2}):(\d{2})/);
          if (m24) {
            const h = parseInt(m24[1], 10), min = parseInt(m24[2], 10);
            if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
          }
          return -1;
        }

        // ── Filter function ────────────────────────────────────────────────────────────
        function isValid(slotText: string): boolean {
          const startMin = parseStartMin(slotText);
          if (startMin < 0) return false; // unparseable → skip

          const nowMinutes = now.getHours() * 60 + now.getMinutes();

          if (isToday) {
            // Today: slot must be strictly after the current time-of-day
            return startMin > nowMinutes;
          }

          // Future date: slot datetime must be both after now AND beyond the 48h cutoff
          const slotDt = new Date(selectedMidnight.getTime());
          slotDt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
          return slotDt.getTime() > now.getTime() && slotDt.getTime() > cutoff.getTime();
        }

        // ── Collect slot button texts ──────────────────────────────────────────────────
        const xp = `//button[contains(normalize-space(.),':') and string-length(normalize-space(.)) > 4 and not(contains(@class,'flex-1'))]`;
        const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const slots: string[] = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const el = result.snapshotItem(i) as HTMLElement | null;
          if (!el) continue;
          const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t.length > 4 && !['Morning', 'Afternoon', 'Evening'].some(s => t.startsWith(s))) {
            slots.push(t);
          }
        }

        // Return only slots that pass the time filter, preserving order
        return slots.filter(isValid);
      },
      { nowMs, cutoffMs }
    );
  }

  // ── Step 2: Helper to click a tab ────────────────────────────────────────────────────────────
  async function clickSectionTab(label: string): Promise<boolean> {
    const xp = `//button[contains(normalize-space(.),'${label}') and not(contains(normalize-space(.),':'))]`;
    const found: boolean = await c.page.evaluate((x: string) =>
      document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null
    , xp);
    if (found) {
      await c.page.locator(`xpath=${xp}`).first().click({ force: true });
      await c.wait(1000);
      return true;
    }
    ctx.log(`Tab "${label}" not found`);
    return false;
  }

  // ── Step 3: Helper to collect ALL slot texts (unfiltered) ────────────────────────────────────
  async function collectAllSlots(): Promise<string[]> {
    const xp = `//button[contains(normalize-space(.),':') and string-length(normalize-space(.)) > 4 and not(contains(@class,'flex-1'))]`;
    return await c.page.evaluate((xpath: string): string[] => {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t.length > 4 && !['Morning', 'Afternoon', 'Evening'].some(s => t.startsWith(s))) out.push(t);
      }
      return out;
    }, xp);
  }

  // ── Step 4: Collect slots per section ────────────────────────────────────────────────────────
  ctx.log('Collecting slots from Morning, Afternoon, Evening...');

  await clickSectionTab('Morning');
  const morningSlots = await collectAllSlots();
  ctx.log(`Morning: [${morningSlots.join(' | ')}]`);

  await clickSectionTab('Afternoon');
  const afternoonSlots = await collectAllSlots();
  ctx.log(`Afternoon: [${afternoonSlots.join(' | ')}]`);

  await clickSectionTab('Evening');
  const eveningSlots = await collectAllSlots();
  ctx.log(`Evening: [${eveningSlots.join(' | ')}]`);

  // firstSlot = first morning slot (no time filter — used for range boundary)
  if (morningSlots.length > 0 && firstSlotVar) {
    ctx.setVariable(firstSlotVar, morningSlots[0]);
    ctx.log(`firstSlot → "${morningSlots[0]}"`);
  }

  // ── Step 5: Find first valid slot across sections (Morning → Afternoon → Evening) ────────────
  // Switch to each tab and re-run the browser-side filter to get valid slots
  const sections = [
    { label: 'Morning',   slots: morningSlots },
    { label: 'Afternoon', slots: afternoonSlots },
    { label: 'Evening',   slots: eveningSlots },
  ];

  // lastSlot = last valid slot from Evening or Afternoon
  let lastSlotText: string | null = null;
  for (const { label, slots } of [...sections].reverse()) {
    if (slots.length === 0) continue;
    await clickSectionTab(label);
    const valid = await collectFilteredSlots();
    ctx.log(`${label} valid slots: [${valid.join(' | ')}]`);
    if (valid.length > 0 && !lastSlotText) {
      lastSlotText = valid[valid.length - 1];
    }
  }
  if (lastSlotText && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlotText);
    ctx.log(`lastSlot → "${lastSlotText}"`);
  }

  // Find and click the first valid slot
  for (const { label } of sections) {
    await clickSectionTab(label);
    const valid = await collectFilteredSlots();
    ctx.log(`${label}: ${valid.length} valid slot(s) — [${valid.slice(0,3).join(' | ')}]`);

    if (valid.length === 0) {
      ctx.log(`"${label}" — no valid slots, trying next section`);
      continue;
    }

    const slotText = valid[0];
    ctx.log(`Clicking "${slotText}" in "${label}"...`);

    // Primary: exact full-text XPath match (handles en-dash and any Unicode correctly)
    const escapedFull = slotText.replace(/'/g, "\\'");
    const xpFull = `//button[not(contains(@class,'flex-1')) and normalize-space(.)='${escapedFull}']`;

    let clicked = false;
    const foundFull: boolean = await c.page.evaluate((x: string) =>
      document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null
    , xpFull);

    if (foundFull) {
      await c.page.locator(`xpath=${xpFull}`).first().click({ force: true });
      clicked = true;
    }

    // Fallback: scan visible buttons by start-time, re-filter in browser
    if (!clicked) {
      ctx.log(`Full-text XPath failed for "${slotText}" — using browser-side fallback`);
      const safeSlot: string | null = await c.page.evaluate(
        ({ nowMs, cutoffMs, hint }: { nowMs: number; cutoffMs: number; hint: string }): string | null => {
          const now    = new Date(nowMs);
          const cutoff = new Date(cutoffMs);

          function parseStartMin(text: string): number {
            const s = text.replace(/\s/g, ' ').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
            const m12 = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (m12) {
              let h = parseInt(m12[1], 10);
              const min = parseInt(m12[2], 10);
              if (m12[3].toUpperCase() === 'AM') { if (h === 12) h = 0; }
              else { if (h !== 12) h += 12; }
              return h * 60 + min;
            }
            const m24 = s.match(/(\d{1,2}):(\d{2})/);
            if (m24) {
              const h = parseInt(m24[1], 10), mn = parseInt(m24[2], 10);
              if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) return h * 60 + mn;
            }
            return -1;
          }

          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const hintMin = parseStartMin(hint);

          const xp = `//button[contains(normalize-space(.),':') and string-length(normalize-space(.)) > 4 and not(contains(@class,'flex-1'))]`;
          const result = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < result.snapshotLength; i++) {
            const el = result.snapshotItem(i) as HTMLElement | null;
            if (!el) continue;
            const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (t.length <= 4 || ['Morning','Afternoon','Evening'].some(s => t.startsWith(s))) continue;
            const sm = parseStartMin(t);
            if (sm < 0) continue;
            // Must match the hint slot's start time AND be after current time
            if (sm === hintMin && sm > nowMinutes) return t;
          }
          // If exact match not found, return first button after current time
          const result2 = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < result2.snapshotLength; i++) {
            const el = result2.snapshotItem(i) as HTMLElement | null;
            if (!el) continue;
            const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (t.length <= 4 || ['Morning','Afternoon','Evening'].some(s => t.startsWith(s))) continue;
            const sm = parseStartMin(t);
            if (sm > nowMinutes) return t;
          }
          return null;
        },
        { nowMs, cutoffMs, hint: slotText }
      );

      if (safeSlot) {
        const escapedSafe = safeSlot.replace(/'/g, "\\'");
        const xpSafe = `//button[not(contains(@class,'flex-1')) and normalize-space(.)='${escapedSafe}']`;
        const foundSafe: boolean = await c.page.evaluate((x: string) =>
          document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null
        , xpSafe);
        if (foundSafe) {
          await c.page.locator(`xpath=${xpSafe}`).first().click({ force: true });
          clicked = true;
          ctx.log(`Fallback clicked "${safeSlot}"`);
        }
      }
    }

    if (!clicked) {
      throw new Error(`Could not click slot "${slotText}" in section "${label}"`);
    }

    await c.wait(800);
    ctx.log(`Clicked: "${slotText}"`);
    if (outputVar) {
      ctx.setVariable(outputVar, slotText);
      ctx.log(`selectedSlot → "${slotText}"`);
    }
    return;
  }

  // All sections exhausted
  const cutoff = new Date(cutoffMs);
  const cutoffStr =
    `${cutoff.getDate()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${cutoff.getFullYear()} ` +
    `${String(cutoff.getHours()).padStart(2,'0')}:${String(cutoff.getMinutes()).padStart(2,'0')}`;
  throw new Error(
    `No bookable time slots found. All slots are in the past or within the 48-hour booking policy window. ` +
    `Earliest bookable datetime: ${cutoffStr}.`
  );
}
