import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Leave Button (Phase 2)
 * description: Click Leave on ${attendButtonSelector} using before count from $[beforeAttendCount] and after attend count from $[afterAttendCount] store before leave count in $[beforeLeaveCount] and after leave count in $[afterLeaveCount]
 * actionType: custom_click_leave_button
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function clickLeaveButton(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — attendButtonSelector : same XPath used in Phase 1
  //                                    e.g. "//button[normalize-space()='Attend']"
  //   args[1] — "beforeAttendCount"  : input variable name (from $[beforeAttendCount])
  //                                    count stored by Phase 1 BEFORE clicking Attend (e.g. "0")
  //   args[2] — "afterAttendCount"   : input variable name (from $[afterAttendCount])
  //                                    count stored by Phase 1 AFTER clicking Attend (e.g. "1")
  //   args[3] — "beforeLeaveCount"   : output variable name (from $[beforeLeaveCount])
  //                                    live DOM count read BEFORE clicking Leave (e.g. "1")
  //   args[4] — "afterLeaveCount"    : output variable name (from $[afterLeaveCount])
  //                                    count read AFTER clicking Leave (e.g. "0")
  //
  // Phase 2 flow:
  //   1. Read beforeAttendCount and afterAttendCount from runtime variables (set by Phase 1)
  //   2. Read live DOM count BEFORE clicking Leave → store in $[beforeLeaveCount]
  //   3. Click the Leave button
  //   4. Verify button changes back to "Attend"
  //   5. Read live DOM count AFTER clicking Leave → store in $[afterLeaveCount]
  //   6. Assert afterLeaveCount = beforeLeaveCount - 1
  //   7. Assert afterLeaveCount = beforeAttendCount (restored to initial)

  const c = ctx as any;

  const attendButtonSelector: string = c.args?.[0];
  const beforeAttendVar: string      = c.args?.[1]; // $[beforeAttendCount]  — input  (from Phase 1)
  const afterAttendVar: string       = c.args?.[2]; // $[afterAttendCount]   — input  (from Phase 1)
  const beforeLeaveVar: string       = c.args?.[3]; // $[beforeLeaveCount]   — output (live DOM before Leave)
  const afterLeaveVar: string        = c.args?.[4]; // $[afterLeaveCount]    — output (live DOM after Leave)

  if (!attendButtonSelector) throw new Error('attendButtonSelector (args[0]) is required.');
  if (!beforeAttendVar)      throw new Error('Input variable $[beforeAttendCount] (args[1]) is required.');
  if (!afterAttendVar)       throw new Error('Input variable $[afterAttendCount] (args[2]) is required.');
  if (!beforeLeaveVar)       throw new Error('Output variable $[beforeLeaveCount] (args[3]) is required.');
  if (!afterLeaveVar)        throw new Error('Output variable $[afterLeaveCount] (args[4]) is required.');

  // ── Step 1: Read Phase 1 counts from runtime variables ───────────────────────
  const beforeAttendRaw = c.getVariable(beforeAttendVar);
  const afterAttendRaw  = c.getVariable(afterAttendVar);

  if (beforeAttendRaw === undefined || beforeAttendRaw === null || beforeAttendRaw === '') {
    throw new Error(`Runtime variable "$[${beforeAttendVar}]" is empty. Run Phase 1 (Click Attend) first.`);
  }
  if (afterAttendRaw === undefined || afterAttendRaw === null || afterAttendRaw === '') {
    throw new Error(`Runtime variable "$[${afterAttendVar}]" is empty. Run Phase 1 (Click Attend) first.`);
  }

  const countBeforeAttend = parseInt(String(beforeAttendRaw), 10);
  const countAfterAttend  = parseInt(String(afterAttendRaw), 10);

  c.log(`Read $[${beforeAttendVar}] = ${countBeforeAttend}`);
  c.log(`Read $[${afterAttendVar}] = ${countAfterAttend}`);

  // ── XPath helpers ────────────────────────────────────────────────────────────
  const countSpanXpath = (): string =>
    `(${attendButtonSelector})/ancestor::td[1]/preceding-sibling::td[1]//span[contains(@class,'text-gray-600')]`;

  const leaveXpath = (): string =>
    `(${attendButtonSelector})/ancestor::td[1]//button[normalize-space()='Leave']`;

  const attendXpath = (): string =>
    `(${attendButtonSelector})/ancestor::td[1]//button[normalize-space()='Attend']`;

  // ── Helper: read integer count from the live DOM count span ──────────────────
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

  // ── Step 2: Read live DOM count BEFORE clicking Leave ────────────────────────
  const countBeforeLeave = await readCount('BEFORE Leave');
  c.setVariable(beforeLeaveVar, String(countBeforeLeave));
  c.log(`Stored beforeLeaveCount="${countBeforeLeave}" → $[${beforeLeaveVar}]`);

  // ── Step 3: Click Leave ───────────────────────────────────────────────────────
  await c.click(leaveXpath());
  c.log('Clicked Leave button.');

  // ── Step 4: Verify button changed back to "Attend" ───────────────────────────
  await waitForButton(attendXpath(), 'Attend');

  // ── Step 5: Read live DOM count AFTER clicking Leave ─────────────────────────
  const countAfterLeave = await readCount('AFTER Leave');
  c.setVariable(afterLeaveVar, String(countAfterLeave));
  c.log(`Stored afterLeaveCount="${countAfterLeave}" → $[${afterLeaveVar}]`);

  // ── Step 6: Assert afterLeaveCount = beforeLeaveCount - 1 ────────────────────
  if (countAfterLeave !== countBeforeLeave - 1) {
    throw new Error(
      `Assertion failed [Phase 2 - Leave]: Expected count ${countBeforeLeave} → ${countBeforeLeave - 1}, ` +
      `but got ${countAfterLeave}.`
    );
  }

  // ── Step 7: Assert afterLeaveCount = beforeAttendCount (fully restored) ───────
  if (countAfterLeave !== countBeforeAttend) {
    throw new Error(
      `Assertion failed [Phase 2 - Leave]: Count after Leave (${countAfterLeave}) does not match ` +
      `initial count before Attend (${countBeforeAttend}).`
    );
  }

  c.log(`Phase 2 PASSED: beforeLeave=${countBeforeLeave} → afterLeave=${countAfterLeave} (-1, restored to initial ${countBeforeAttend}) ✓`);
}
