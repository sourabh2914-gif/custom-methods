import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Click Like/Dislike and Verify Count
 * description: Click like or unlike on ${likeSelector} and store before count in $[beforeLikeCount] and after count in $[afterLikeCount]
 * actionType: custom_click_like_dislike_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function clickLikeDislikeAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — likeSelector      : XPath of the like/unlike container (the clickable div that also
  //                                  contains the count — e.g. the div wrapping the thumbs-up SVG and span)
  //   args[1] — "beforeLikeCount" : output variable name (from $[beforeLikeCount]) — count BEFORE click
  //   args[2] — "afterLikeCount"  : output variable name (from $[afterLikeCount])  — count AFTER click
  //
  // How the count is read from a single selector:
  //   The method reads the full text content of the container and extracts the FIRST
  //   number it finds (stripping SVG text, labels, etc.).
  //   e.g. container text "2" or " 2 likes" → extracts 2
  //
  // Behaviour:
  //   1. Read the number from the container BEFORE click → store in $[beforeLikeCount]
  //   2. Click the same container (like / unlike)
  //   3. Poll up to 5 s for the number to change
  //   4. Read the number AFTER click → store in $[afterLikeCount]
  //   5. Assert count changed by exactly ±1 (throws if not)
  //
  // Example step description:
  //   "Click like or unlike on ${likeSelector} and store before count in $[beforeLikeCount] and after count in $[afterLikeCount]"
  //   test data: { likeSelector: "//div[contains(@class,'cursor-pointer') and .//*[contains(@class,'lucide-thumbs-up')]]" }
  //   → liked:   beforeLikeCount = "2", afterLikeCount = "3"
  //   → unliked: beforeLikeCount = "3", afterLikeCount = "2"

  const c = ctx as any;

  const likeSelector: string = c.args?.[0];
  const beforeVar: string    = c.args?.[1]; // $[beforeLikeCount]
  const afterVar: string     = c.args?.[2]; // $[afterLikeCount]

  if (!likeSelector) throw new Error('likeSelector (args[0]) is required.');
  if (!beforeVar)    throw new Error('output variable $[beforeLikeCount] (args[1]) is required.');
  if (!afterVar)     throw new Error('output variable $[afterLikeCount] (args[2]) is required.');

  // Helper: read the first integer found in the container's text content
  const readCount = async (): Promise<number> => {
    let raw = '';
    try {
      // Try innerText of the container first
      raw = (await c.getText(likeSelector) ?? '').trim();
    } catch (_) {}

    // Try reading just the child span text via XPath if container text is empty or non-numeric
    if (!raw || !/\d/.test(raw)) {
      try {
        const spanXpath = '(' + likeSelector + ')//span';
        raw = (await c.getText(spanXpath) ?? '').trim();
      } catch (_) {}
    }

    // Extract the first number found (handles "2", "2 likes", "(2)", " 2 ")
    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(
        `Could not find a number in the like container. Selector: "${likeSelector}". Got text: "${raw}"`
      );
    }
    return parseInt(match[0], 10);
  };

  // 1. Read count BEFORE click
  const countBefore = await readCount();
  c.log(`Like count BEFORE click: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  // 2. Click the like / unlike container
  await c.click(likeSelector);
  c.log(`Clicked like/unlike: "${likeSelector}"`);

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

  // 4. Verify count changed by exactly ±1
  const delta = countAfter - countBefore;

  if (delta === 1) {
    c.log(`Like count INCREASED: ${countBefore} → ${countAfter} (liked)`);
  } else if (delta === -1) {
    c.log(`Like count DECREASED: ${countBefore} → ${countAfter} (unliked / disliked)`);
  } else if (delta === 0) {
    throw new Error(
      `Like count did not change after clicking. Count stayed at ${countBefore}. ` +
      `Check that the selector is correct and the click registered.`
    );
  } else {
    throw new Error(
      `Unexpected like count change: ${countBefore} → ${countAfter} (delta ${delta}). ` +
      `Expected exactly +1 (like) or -1 (unlike).`
    );
  }

  // 5. Store count AFTER click
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
