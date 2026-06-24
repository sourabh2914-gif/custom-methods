import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Like Dislike Comment Nested Comment and Verify Count
 * description: Click like or dislike on comment ${commentLikeSelector} and store before count in $[beforeCommentLikeCount] and after count in $[afterCommentLikeCount]
 * actionType: custom_like_dislike_comment_nested_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function likeDislikeCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — commentLikeSelector      : XPath of the like button/container for the comment or nested comment
  //   args[1] — "beforeCommentLikeCount" : output variable name — count BEFORE click (defaults to 0 if not shown)
  //   args[2] — "afterCommentLikeCount"  : output variable name — count AFTER click
  //
  // Key behaviour:
  //   - Initially there may be NO count shown (empty span or no span at all) → treated as 0
  //   - Like   → count increases by exactly +1
  //   - Dislike → count decreases by exactly -1
  //   - Works for both top-level comments and nested comments via the same selector

  const c = ctx as any;

  const commentLikeSelector: string = c.args?.[0];
  const beforeVar: string           = c.args?.[1]; // $[beforeCommentLikeCount]
  const afterVar: string            = c.args?.[2]; // $[afterCommentLikeCount]

  if (!commentLikeSelector) throw new Error('commentLikeSelector (args[0]) is required.');
  if (!beforeVar)           throw new Error('output variable $[beforeCommentLikeCount] (args[1]) is required.');
  if (!afterVar)            throw new Error('output variable $[afterCommentLikeCount] (args[2]) is required.');

  // Helper: read the like count from the comment like container via textContent
  // Returns 0 if no number is found (handles the "initially no count" case)
  const readCount = async (): Promise<number> => {
    const raw: string = await c.page.evaluate((xpath: string) => {
      const result = document.evaluate(
        xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      );
      const node = result.singleNodeValue as Element | null;
      if (!node) return '';
      // Try child span first (like button containers often have SVG + span)
      const span = node.querySelector('span');
      if (span) return (span.textContent ?? '').trim();
      return (node.textContent ?? '').trim();
    }, commentLikeSelector);

    const match = raw.match(/\d+/);
    // If no number found — initial state with no count shown — return 0
    return match ? parseInt(match[0], 10) : 0;
  };

  // 1. Read count BEFORE click (may be 0 if not yet shown)
  const countBefore = await readCount();
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Comment like count BEFORE click: ${countBefore}`);

  // 2. Click the like/dislike button
  await c.click(commentLikeSelector);
  c.log(`Clicked comment like/dislike: "${commentLikeSelector}"`);

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

  // 4. Assert count changed by exactly ±1
  const delta = countAfter - countBefore;

  if (delta === 1) {
    c.log(`Comment like count INCREASED: ${countBefore} → ${countAfter} (liked)`);
  } else if (delta === -1) {
    c.log(`Comment like count DECREASED: ${countBefore} → ${countAfter} (disliked)`);
  } else if (delta === 0) {
    throw new Error(
      `Comment like count did not change after clicking. Count stayed at ${countBefore}. ` +
      `Check that the selector is correct and the click registered.`
    );
  } else {
    throw new Error(
      `Unexpected comment like count change: ${countBefore} → ${countAfter} (delta ${delta}). ` +
      `Expected exactly +1 (like) or -1 (dislike).`
    );
  }

  // 5. Store count AFTER click
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored → $[${beforeVar}] = "${countBefore}", $[${afterVar}] = "${countAfter}"`);
}
