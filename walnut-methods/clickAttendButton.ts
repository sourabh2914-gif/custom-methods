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
  //                                    e.g. "//button[normalize-space()='Attend']"
  //   args[1] — "beforeAttendCount"  : output variable name (from $[beforeAttendCount])
  //                                    stores count BEFORE clicking Attend (e.g. "0")
  //   args[2] — "afterAttendCount"   : output variable name (from $[afterAttendCount])
  //                                    stores count AFTER clicking Attend (e.g. "1")
  //
  // Phase 1 flow:
  //   1. Read attendee count BEFORE click → store in $[beforeAttendCount]
  //   2. Click the Attend button
  //   3. Verify button changes to "Leave"
  //   4. Read attendee count AFTER click  → store in $[afterAttendCount]
  //   5. Assert afterAttendCount = beforeAttendCount + 1

  const c = ctx as any;

  const attendButtonSelector: string = c.args?.[0];
  const beforeVar: string            = c.args?.[1]; // $[beforeAttendCount]
  const afterVar: string             = c.args?.[2]; // $[afterAttendCount]

  if (!attendButtonSelector) throw new Error('attendButtonSelector (args[0]) is required.');
  if (!beforeVar)            throw new Error('Output variable $[beforeAttendCount] (args[1]) is required.');
  if (!afterVar)             throw new Error('Output variable $[afterAttendCount] (args[2]) is required.');

  // ── XPath helpers ────────────────────────────────────────────────────────────
  // Count span: sibling <td> immediately before the button's <td>
  const countSpanXpath = (): string =>
    `(${attendButtonSelector})/ancestor::td[1]/preceding-sibling::td[1]//span[contains(@class,'text-gray-600')]`;

  // Leave button: same <td> as the Attend button, after click
  const leaveXpath = (): string =>
    `(${attendButtonSelector})/ancestor::td[1]//button[normalize-space()='Leave']`;

  // ── Helper: read integer count from the count span ───────────────────────────
  const readCount = async (label: string): Promise<number> => {
    const spanXpath = countSpanXpath();
    let raw = '';

    try {
      raw = (await c.getText(spanXpath) ?? '').trim();
    } catch (_) {}

    if (!raw || !/\d/.test(raw)) {
      try {
        raw = await c.page.evaluate((xp: string) => {
          const result = document.evaluate(
            xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          const node = result.singleNodeValue as Element | null;
          return node ? (node.textContent ?? '').trim() : '';
        }, spanXpath);
      } catch (_) {}
    }

    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(`[${label}] Could not read attendee count. XPath: "${spanXpath}". Got: "${raw}"`);
    }
    const val = parseInt(match[0], 10);
    c.log(`[${label}] Attendee count = ${val}`);
    return val;
  };

  // ── Helper: poll for a button to become visible ──────────────────────────────
  const waitForButton = async (xpath: string, label: string, maxMs = 7000): Promise<void> => {
    const pollMs = 300;
    const start  = Date.now();
    while (Date.now() - start < maxMs) {
      await c.wait(pollMs);
      try {
        if (await c.isVisible(xpath)) {
          c.log(`Button "${label}" is now visible.`);
          return;
        }
      } catch (_) {}
    }
    throw new Error(
      `Assertion failed: "${label}" button did not appear within ${maxMs / 1000}s. XPath: "${xpath}"`
    );
  };

  // ── Step 1: Read count BEFORE Attend ─────────────────────────────────────────
  const countBefore = await readCount('BEFORE Attend');
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored beforeAttendCount="${countBefore}" → $[${beforeVar}]`);

  // ── Step 2: Click Attend ──────────────────────────────────────────────────────
  await c.click(attendButtonSelector);
  c.log('Clicked Attend button.');

  // ── Step 3: Verify button changed to "Leave" ──────────────────────────────────
  await waitForButton(leaveXpath(), 'Leave');

  // ── Step 4: Read count AFTER Attend ──────────────────────────────────────────
  const countAfter = await readCount('AFTER Attend');
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored afterAttendCount="${countAfter}" → $[${afterVar}]`);

  // ── Step 5: Assert count increased by exactly +1 ─────────────────────────────
  if (countAfter !== countBefore + 1) {
    throw new Error(
      `Assertion failed [Phase 1 - Attend]: Expected count ${countBefore} → ${countBefore + 1}, ` +
      `but got ${countAfter}.`
    );
  }
  c.log(`Phase 1 PASSED: ${countBefore} → ${countAfter} (+1) ✓`);
}
