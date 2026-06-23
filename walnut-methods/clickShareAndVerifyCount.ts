import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Share and Verify Count
 * description: Click share button on ${shareSelector} and store before count in $[beforeShareCount] and after count in $[afterShareCount]
 * actionType: custom_click_share_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function clickShareAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — shareSelector       : XPath of the share button container (the clickable div that also
  //                                   contains the count — e.g. the div wrapping the lucide-share2 SVG and span)
  //   args[1] — "beforeShareCount"  : output variable name (from $[beforeShareCount]) — count BEFORE click
  //   args[2] — "afterShareCount"   : output variable name (from $[afterShareCount])  — count AFTER click
  //
  // How the count is read from a single selector:
  //   The method reads the full text content of the container and extracts the FIRST
  //   number it finds (stripping SVG text, labels, etc.).
  //   e.g. container text "0" or " 2 shares" → extracts 0 or 2
  //
  // Behaviour:
  //   1. Read the number from the container BEFORE click → store in $[beforeShareCount]
  //   2. Click the same container (share button)
  //   3. Poll up to 5 s for the number to change
  //   4. Read the number AFTER click → store in $[afterShareCount]
  //   5. Assert count increased by exactly +1 (throws if not)
  //
  // Example step description:
  //   "Click share button on ${shareSelector} and store before count in $[beforeShareCount] and after count in $[afterShareCount]"
  //   test data: { shareSelector: "//div[contains(@class,'cursor-pointer') and .//*[contains(@class,'lucide-share2')]]" }
  //   → shared: beforeShareCount = "0", afterShareCount = "1"

  const c = ctx as any;

  const shareSelector: string = c.args?.[0];
  const beforeVar: string     = c.args?.[1]; // $[beforeShareCount]
  const afterVar: string      = c.args?.[2]; // $[afterShareCount]

  if (!shareSelector) throw new Error('shareSelector (args[0]) is required.');
  if (!beforeVar)     throw new Error('output variable $[beforeShareCount] (args[1]) is required.');
  if (!afterVar)      throw new Error('output variable $[afterShareCount] (args[2]) is required.');

  // Helper: read the first integer found in the share container's text content
  const readCount = async (): Promise<number> => {
    let raw = '';
    try {
      // Try innerText of the container first
      raw = (await c.getText(shareSelector) ?? '').trim();
    } catch (_) {}

    // Try reading just the child span text via XPath if container text is empty or non-numeric
    if (!raw || !/\d/.test(raw)) {
      try {
        const spanXpath = '(' + shareSelector + ')//span';
        raw = (await c.getText(spanXpath) ?? '').trim();
      } catch (_) {}
    }

    // Extract the first number found (handles "0", "2", "2 shares", "(2)", " 2 ")
    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(
        `Could not find a number in the share container. Selector: "${shareSelector}". Got text: "${raw}"`
      );
    }
    return parseInt(match[0], 10);
  };

  // 1. Read count BEFORE click
  const countBefore = await readCount();
  c.log(`Share count BEFORE click: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  // 2. Click the share button container
  await c.click(shareSelector);
  c.log(`Clicked share button: "${shareSelector}"`);

  // 3. Poll up to 5 s for the count to change
  const maxWaitMs = 5000;
  const pollMs    = 300;
  const start     = Date.now();
  let countAfter  = countBefore;

  while (Date.now() - start < maxWaitMs) {
    await c.wait(pollMs);
    try {
      countAfter = await readCount();
    } catch (_) {
      continue;
    }
    if (countAfter !== countBefore) break;
  }

  // 4. Verify count increased by exactly +1
  const delta = countAfter - countBefore;

  if (delta === 1) {
    c.log(`Share count INCREASED: ${countBefore} → ${countAfter} (shared successfully)`);
  } else if (delta === 0) {
    throw new Error(
      `Share count did not change after clicking. Count stayed at ${countBefore}. ` +
      `Check that the selector is correct and the click registered.`
    );
  } else {
    throw new Error(
      `Unexpected share count change: ${countBefore} → ${countAfter} (delta ${delta}). ` +
      `Expected exactly +1 after sharing.`
    );
  }

  // 5. Store count AFTER click
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
