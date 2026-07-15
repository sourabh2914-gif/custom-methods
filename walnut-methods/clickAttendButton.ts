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
  // Flow:
  //   1. Read count BEFORE click  → anchor on Attend button (exists in DOM) → $[beforeAttendCount]
  //   2. Click Attend
  //   3. Wait up to 9s for Leave button to appear in the SAME <tr> row
  //   4. Read count AFTER click   → anchor on Leave button (Attend is gone from DOM) → $[afterAttendCount]
  //   5. Assert afterCount = beforeCount + 1
  //   NOTE: Leave button is NOT clicked here.

  const c = ctx as any;

  const attendButtonSelector: string = c.args?.[0];
  const beforeVar: string            = c.args?.[1]; // $[beforeAttendCount]
  const afterVar: string             = c.args?.[2]; // $[afterAttendCount]

  if (!attendButtonSelector) throw new Error('attendButtonSelector (args[0]) is required.');
  if (!beforeVar)            throw new Error('Output variable $[beforeAttendCount] (args[1]) is required.');
  if (!afterVar)             throw new Error('Output variable $[afterAttendCount] (args[2]) is required.');

  // ── Derived XPaths ───────────────────────────────────────────────────────────
  // The Leave button appears in the same <tr> after clicking Attend.
  // We anchor via ancestor::tr[1] so it stays valid regardless of button state.
  const leaveInRowXpath = `(${attendButtonSelector})/ancestor::td[1]//button[normalize-space()='Leave']`;

  // Count span BEFORE click — Attend button exists, safe to anchor on it
  const countBeforeXpath = `(${attendButtonSelector})/ancestor::tr[1]//span[contains(@class,'text-gray-600')]`;

  // Count span AFTER click — Attend button is GONE, anchor on Leave button instead
  const countAfterXpath  = `(${leaveInRowXpath})/ancestor::tr[1]//span[contains(@class,'text-gray-600')]`;

  // ── Helper: read integer count ───────────────────────────────────────────────
  const readCount = async (label: string, spanXpath: string): Promise<number> => {
    let raw = '';
    try {
      raw = (await c.getText(spanXpath) ?? '').trim();
    } catch (_) {}

    if (!raw || !/\d/.test(raw)) {
      try {
        raw = await c.page.evaluate((xp: string) => {
          const res = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const node = res.singleNodeValue as Element | null;
          return node ? (node.textContent ?? '').trim() : '';
        }, spanXpath);
      } catch (_) {}
    }

    const match = raw.match(/\d+/);
    if (!match) throw new Error(`[${label}] Could not read count. XPath: "${spanXpath}". Got: "${raw}"`);
    const val = parseInt(match[0], 10);
    c.log(`[${label}] Attendee count = ${val}`);
    return val;
  };

  // ── Helper: poll until button visible ───────────────────────────────────────
  const waitForButton = async (xpath: string, label: string, maxMs = 10000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await c.wait(300);
      try {
        if (await c.isVisible(xpath)) {
          c.log(`Button "${label}" is now visible.`);
          return;
        }
      } catch (_) {}
    }
    throw new Error(`"${label}" button did not appear within ${maxMs / 1000}s. XPath: "${xpath}"`);
  };

  // ── Step 1: Read count BEFORE clicking Attend ────────────────────────────────
  const countBefore = await readCount('BEFORE Attend', countBeforeXpath);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored $[${beforeVar}] = ${countBefore}`);

  // ── Step 2: Click Attend ──────────────────────────────────────────────────────
  await c.click(attendButtonSelector);
  c.log('Clicked Attend button.');

  // ── Step 3: Wait for Leave to appear in the same row ─────────────────────────
  await waitForButton(leaveInRowXpath, 'Leave');

  // ── Step 4: Read count AFTER clicking Attend ──────────────────────────────────
  const countAfter = await readCount('AFTER Attend', countAfterXpath);
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored $[${afterVar}] = ${countAfter}`);

  // ── Step 5: Assert +1 ────────────────────────────────────────────────────────
  if (countAfter !== countBefore + 1) {
    throw new Error(
      `Assertion failed: Expected count ${countBefore} → ${countBefore + 1}, but got ${countAfter}.`
    );
  }
  c.log(`Phase 1 PASSED: ${countBefore} → ${countAfter} (+1) ✓`);
}
