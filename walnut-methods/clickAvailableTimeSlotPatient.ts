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

  // Capture current time in Node.js for logging only
  const nowDate    = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  ctx.log(`System time: ${nowDate.toISOString()} — nowMinutes=${nowMinutes} (${Math.floor(nowMinutes/60)}:${String(nowMinutes%60).padStart(2,'0')})`);

  // ── Helper: click Morning / Afternoon / Evening tab ─────────────────────────────────────────
  async function clickTab(label: string): Promise<void> {
    // Tab buttons contain the label text but never contain ":" (slot buttons always have ":")
    const xp = `//button[contains(normalize-space(.),'${label}') and not(contains(normalize-space(.),':'))]`;
    const found: boolean = await c.page.evaluate(
      (x: string) => document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null,
      xp
    );
    if (found) {
      await c.page.locator(`xpath=${xp}`).first().click({ force: true });
      await c.wait(1000);
    } else {
      ctx.log(`Tab "${label}" not found`);
    }
  }

  // ── Helper: collect raw slot texts visible on the current tab ───────────────────────────────
  async function getRawSlots(): Promise<string[]> {
    return await c.page.evaluate((): string[] => {
      const xp = `//button[contains(normalize-space(.),':') and string-length(normalize-space(.)) > 4 and not(contains(@class,'flex-1'))]`;
      const snap = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out: string[] = [];
      for (let i = 0; i < snap.snapshotLength; i++) {
        const el = snap.snapshotItem(i) as HTMLElement | null;
        if (!el) continue;
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t.length > 4 && !t.startsWith('Morning') && !t.startsWith('Afternoon') && !t.startsWith('Evening')) {
          out.push(t);
        }
      }
      return out;
    });
  }

  // ── Helper: parse start time in minutes-since-midnight from a slot text ─────────────────────
  // Runs entirely in Node.js. slot text example: "10:30 AM – 11:00 AM" or "17:00 – 17:30"
  function parseStartMin(text: string): number {
    // Normalize: replace en/em dash, non-breaking space, collapse whitespace
    const s = text
      .replace(/[\u2013\u2014\u2012\u2010\u00ad]/g, '-')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // AM/PM format: "10:30 AM" or "5:30PM"
    const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const min = parseInt(m12[2], 10);
      const ampm = m12[3].toUpperCase();
      if (ampm === 'AM') { if (h === 12) h = 0; }
      else               { if (h !== 12) h += 12; }
      return h * 60 + min;
    }

    // 24h format: "17:00"
    const m24 = s.match(/^(\d{1,2}):(\d{2})/);
    if (m24) {
      const h = parseInt(m24[1], 10), min = parseInt(m24[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    }

    return -1; // unparseable
  }

  // ── Helper: is a slot valid to click? ───────────────────────────────────────────────────────
  // A slot is valid if its START time is strictly AFTER the current system time.
  // This works for both today (skip past slots) and future dates (all slots pass).
  // We deliberately do NOT rely on calendar date detection — it has been unreliable.
  function isValidSlot(slotText: string): boolean {
    const startMin = parseStartMin(slotText);
    if (startMin < 0) {
      ctx.warn(`Cannot parse time from "${slotText}" — skipping`);
      return false;
    }
    const valid = startMin > nowMinutes;
    ctx.log(`  "${slotText}" startMin=${startMin} nowMinutes=${nowMinutes} → ${valid ? 'ALLOW' : 'SKIP'}`);
    return valid;
  }

  // ── Phase 1: collect all slots per tab (unfiltered, for firstSlot/lastSlot) ─────────────────
  ctx.log('--- Phase 1: collecting all slots ---');

  await clickTab('Morning');
  const morningAll = await getRawSlots();
  ctx.log(`Morning (all): [${morningAll.join(' | ')}]`);

  await clickTab('Afternoon');
  const afternoonAll = await getRawSlots();
  ctx.log(`Afternoon (all): [${afternoonAll.join(' | ')}]`);

  await clickTab('Evening');
  const eveningAll = await getRawSlots();
  ctx.log(`Evening (all): [${eveningAll.join(' | ')}]`);

  // firstSlot = first slot in Morning (no time filter — used as range boundary)
  const firstSlot = morningAll.length > 0 ? morningAll[0] : null;
  if (firstSlot && firstSlotVar) {
    ctx.setVariable(firstSlotVar, firstSlot);
    ctx.log(`firstSlot → "${firstSlot}"`);
  }

  // lastSlot = last valid slot in Evening, fallback Afternoon
  const eveningValid   = eveningAll.filter(isValidSlot);
  const afternoonValid = afternoonAll.filter(isValidSlot);
  const lastSlot =
    eveningValid.length   > 0 ? eveningValid[eveningValid.length - 1] :
    afternoonValid.length > 0 ? afternoonValid[afternoonValid.length - 1] :
    null;
  if (lastSlot && lastSlotVar) {
    ctx.setVariable(lastSlotVar, lastSlot);
    ctx.log(`lastSlot → "${lastSlot}"`);
  }

  // ── Phase 2: click first valid slot — Morning → Afternoon → Evening ──────────────────────────
  ctx.log('--- Phase 2: clicking first valid future slot ---');

  const sections = [
    { label: 'Morning',   all: morningAll },
    { label: 'Afternoon', all: afternoonAll },
    { label: 'Evening',   all: eveningAll },
  ];

  for (const { label, all } of sections) {
    if (all.length === 0) { ctx.log(`"${label}" — no slots, skip`); continue; }

    const valid = all.filter(isValidSlot);
    ctx.log(`"${label}" — ${valid.length}/${all.length} valid`);

    if (valid.length === 0) { ctx.log(`"${label}" — all in the past, trying next tab`); continue; }

    const target = valid[0];

    // Switch to this tab so the button is in the DOM
    await clickTab(label);

    ctx.log(`Clicking "${target}" in "${label}"...`);

    // Build button text for XPath. The DOM text may use en-dash (–) while our
    // collected text uses regular spaces. Use Playwright's locator with exact text
    // so Playwright handles whitespace/Unicode itself.
    let clicked = false;

    // Primary: Playwright getByRole + exact text (most resilient to Unicode)
    try {
      const loc = c.page.locator(`//button[not(contains(@class,'flex-1'))]`).filter({ hasText: target });
      const cnt: number = await loc.count();
      if (cnt > 0) {
        await loc.first().click({ force: true });
        clicked = true;
        ctx.log(`Clicked via Playwright filter: "${target}"`);
      }
    } catch (_) { /* fall through */ }

    // Fallback: ask the browser to find the button with the matching start time
    if (!clicked) {
      const startMin = parseStartMin(target);
      const clickedInBrowser: boolean = await c.page.evaluate(
        ({ startMin, nowMinutes }: { startMin: number; nowMinutes: number }): boolean => {
          function parseMin(t: string): number {
            const s = t.replace(/[\u2013\u2014\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
            const m12 = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (m12) {
              let h = parseInt(m12[1], 10);
              const min = parseInt(m12[2], 10);
              if (m12[3].toUpperCase() === 'AM') { if (h === 12) h = 0; }
              else { if (h !== 12) h += 12; }
              return h * 60 + min;
            }
            const m24 = s.match(/(\d{1,2}):(\d{2})/);
            if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
            return -1;
          }
          const xp = `//button[contains(normalize-space(.),':') and not(contains(@class,'flex-1'))]`;
          const snap = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < snap.snapshotLength; i++) {
            const el = snap.snapshotItem(i) as HTMLElement | null;
            if (!el) continue;
            const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (t.startsWith('Morning') || t.startsWith('Afternoon') || t.startsWith('Evening')) continue;
            const sm = parseMin(t);
            if (sm === startMin && sm > nowMinutes) {
              (el as HTMLButtonElement).click();
              return true;
            }
          }
          return false;
        },
        { startMin, nowMinutes }
      );
      if (clickedInBrowser) {
        clicked = true;
        ctx.log(`Clicked via browser fallback: startMin=${startMin}`);
      }
    }

    if (!clicked) {
      throw new Error(`Could not click slot "${target}" in section "${label}"`);
    }

    await c.wait(800);
    ctx.log(`Done — clicked "${target}"`);

    if (outputVar) {
      ctx.setVariable(outputVar, target);
      ctx.log(`selectedSlot → "${target}"`);
    }
    return;
  }

  throw new Error(
    `No bookable time slots found after ${Math.floor(nowMinutes/60)}:${String(nowMinutes%60).padStart(2,'0')}. ` +
    `All Morning, Afternoon, and Evening slots are in the past.`
  );
}
