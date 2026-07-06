import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture and Increment Event Count
 * description: Read total public events count from ${countSelector} add 1 and store expected count in $[expectedEventCount]
 * actionType: custom_capture_and_increment_event_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function captureAndIncrementEventCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — countSelector       : CSS/XPath selector targeting the element showing the event count
  //                                   e.g. "p.font-bold.text-gray-800" or "//p[contains(@class,'text-4xl')]"
  //   args[1] — "expectedEventCount": output variable name (from $[expectedEventCount])
  //                                   stores currentCount + 1
  //
  // Example step description:
  //   "Read total public events count from ${countSelector} add 1 and store expected count in $[expectedEventCount]"
  //   test data: { countSelector: "//p[contains(@class,'text-4xl') and contains(@class,'font-bold')]" }
  //   If the element shows "70" → stores "71" in $[expectedEventCount]

  const c = ctx as any;

  const countSelector: string = c.args?.[0];
  const outputVar: string     = c.args?.[1]; // $[expectedEventCount]

  if (!countSelector) throw new Error('countSelector (args[0]) is required.');
  if (!outputVar)     throw new Error('output variable $[expectedEventCount] (args[1]) is required.');

  // Read the raw text from the element
  let raw = '';

  try {
    raw = (await c.getText(countSelector) ?? '').trim();
  } catch (_) {}

  // Fallback: try page.evaluate for XPath selectors that getText may not resolve
  if (!raw || !/\d/.test(raw)) {
    try {
      raw = await c.page.evaluate((sel: string) => {
        // Try XPath first
        if (sel.startsWith('/') || sel.startsWith('(')) {
          const result = document.evaluate(
            sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          const node = result.singleNodeValue as Element | null;
          return node ? (node.textContent ?? '').trim() : '';
        }
        // CSS selector
        const el = document.querySelector(sel);
        return el ? (el.textContent ?? '').trim() : '';
      }, countSelector);
    } catch (_) {}
  }

  // Extract the first integer from the text (handles "70", " 70 ", "70 events", etc.)
  const match = raw.match(/\d+/);
  if (!match) {
    throw new Error(
      `Could not find a number in the event count element. ` +
      `Selector: "${countSelector}". Got text: "${raw}"`
    );
  }

  const currentCount  = parseInt(match[0], 10);
  const expectedCount = currentCount + 1;

  c.log(`Current event count: ${currentCount}`);
  c.log(`Expected count after adding 1 event: ${expectedCount}`);

  c.setVariable(outputVar, String(expectedCount));
  c.log(`Stored expected count "${expectedCount}" → $[${outputVar}]`);
}
