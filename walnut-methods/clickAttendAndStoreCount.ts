import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Attend and Store Count
 * description: Validate Attend/Leave toggle on ${attendButtonSelector} store before count in $[beforeAttendCount] and after count in $[afterAttendCount]
 * actionType: custom_click_attend_and_store_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function clickAttendAndStoreCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — attendButtonSelector : XPath selector for the Attend button
  //                                    e.g. "//button[normalize-space()='Attend']"
  //   args[1] — "beforeAttendCount"  : output variable name (from $[beforeAttendCount])
  //                                    stores count BEFORE clicking Attend
  //   args[2] — "afterAttendCount"   : output variable name (from $[afterAttendCount])
  //                                    stores count AFTER clicking Attend (= beforeAttendCount + 1)
  //
  // Full flow:
  //   1. Read count BEFORE Attend → store in $[beforeAttendCount]
  //   2. Click Attend
  //   3. Verify button changes to "Leave"
  //   4. Read count AFTER Attend → store in $[afterAttendCount]
  //   5. Assert afterAttend = beforeAttend + 1
  //   6. Click Leave
  //   7. Verify button changes back to "Attend"
  //   8. Read count AFTER Leave
  //   9. Assert afterLeave = beforeAttend (restored) OR = afterAttend - 1
  //  10. Throw on any assertion failure

  const c = ctx as any;

  const attendButtonSelector: string = c.args?.[0];
  const beforeVar: string            = c.args?.[1]; // $[beforeAttendCount]
  const afterVar: string             = c.args?.[2]; // $[afterAttendCount]

  if (!attendButtonSelector) throw new Error('attendButtonSelector (args[0]) is required.');
  if (!beforeVar)            throw new Error('Output variable $[beforeAttendCount] (args[1]) is required.');
  if (!afterVar)             throw new Error('Output variable $[afterAttendCount] (args[2]) is required.');

  // ── DOM structure (from screenshots) ─────────────────────────────────────────
  // <tr>
  //   <td> <span class="text-sm text-gray-600">0</span> </td>   ← count
  //   <td> <div><div><div>
  //     <button class="... bg-[#3279AD] ...">Attend</button>    ← Attend
  //   </div></div></div> </td>
  // </tr>
  // After click:
  //   <span>1</span>  +  <button class="... bg-gray-100 ...">Leave</button>

  // ── Helper: build count-span XPath relative to the button selector ────────────
  const countSpanXpath = (btnXpath: string): string =>
    `(${btnXpath})/ancestor::td[1]/preceding-sibling::td[1]//span[contains(@class,'text-gray-600')]`;

  // ── Helper: build Leave-button XPath relative to the Attend selector ──────────
  const leaveXpath = (btnXpath: string): string =>
    `(${btnXpath})/ancestor::td[1]//button[normalize-space()='Leave']`;

  // ── Helper: build Attend-button XPath (for re-check after Leave click) ────────
  const attendXpath = (btnXpath: string): string =>
    `(${btnXpath})/ancestor::td[1]//button[normalize-space()='Attend']`;

  // ── Helper: read integer count from the sibling span ─────────────────────────
  const readCount = async (label: string): Promise<number> => {
    const spanXpath = countSpanXpath(attendButtonSelector);
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
      throw new Error(
        `[${label}] Could not read attendee count. XPath: "${spanXpath}". Got: "${raw}"`
      );
    }
    const val = parseInt(match[0], 10);
    c.log(`[${label}] Attendee count = ${val}`);
    return val;
  };

  // ── Helper: poll for a button text to become visible (up to maxMs) ───────────
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
      `Assertion failed: "${label}" button did not appear within ${maxMs / 1000}s. ` +
      `XPath: "${xpath}"`
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1 — ATTEND
  // ════════════════════════════════════════════════════════════════════════════

  // 1. Read count BEFORE Attend
  const countBeforeAttend = await readCount('BEFORE Attend');
  c.setVariable(beforeVar, String(countBeforeAttend));
  c.log(`Stored beforeAttendCount="${countBeforeAttend}" → $[${beforeVar}]`);

  // 2. Click Attend
  await c.click(attendButtonSelector);
  c.log(`Clicked Attend button.`);

  // 3. Verify button changed to "Leave"
  await waitForButton(leaveXpath(attendButtonSelector), 'Leave');

  // 4. Read count AFTER Attend
  const countAfterAttend = await readCount('AFTER Attend');
  c.setVariable(afterVar, String(countAfterAttend));
  c.log(`Stored afterAttendCount="${countAfterAttend}" → $[${afterVar}]`);

  // 5. Assert AfterAttend = BeforeAttend + 1
  if (countAfterAttend !== countBeforeAttend + 1) {
    throw new Error(
      `Assertion failed [Attend]: Expected count ${countBeforeAttend} → ${countBeforeAttend + 1}, ` +
      `but got ${countAfterAttend}.`
    );
  }
  c.log(`Attend assertion PASSED: ${countBeforeAttend} → ${countAfterAttend} (+1)`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — LEAVE
  // ════════════════════════════════════════════════════════════════════════════

  // 6. Click Leave (same row, now shows Leave button)
  await c.click(leaveXpath(attendButtonSelector));
  c.log(`Clicked Leave button.`);

  // 7. Verify button changed back to "Attend"
  await waitForButton(attendXpath(attendButtonSelector), 'Attend');

  // 8. Read count AFTER Leave
  const countAfterLeave = await readCount('AFTER Leave');

  // 9. Assert AfterLeave = AfterAttend - 1  (which also equals BeforeAttend)
  if (countAfterLeave !== countAfterAttend - 1) {
    throw new Error(
      `Assertion failed [Leave]: Expected count ${countAfterAttend} → ${countAfterAttend - 1}, ` +
      `but got ${countAfterLeave}.`
    );
  }
  if (countAfterLeave !== countBeforeAttend) {
    throw new Error(
      `Assertion failed [Leave]: Count after Leave (${countAfterLeave}) does not match ` +
      `initial count before Attend (${countBeforeAttend}).`
    );
  }
  c.log(`Leave assertion PASSED: ${countAfterAttend} → ${countAfterLeave} (-1, restored to initial)`);

  c.log(`Full Attend/Leave cycle validated successfully.`);
}
