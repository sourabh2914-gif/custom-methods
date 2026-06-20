import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Add/Delete Comment and Verify Count
 * description: Verify comment count change on ${countSpanSelector} and ${headingSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_add_delete_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function addDeleteCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — countSpanSelector  : XPath/CSS for the numeric span in the blog header bar
  //                                   → shows "1", "2", etc.  May be absent/hidden at 0 comments
  //                                   e.g. "//span[@class='text-sm text-text-gray'][2]"
  //   args[1] — headingSelector    : XPath/CSS for the h2 heading inside the blog detail section
  //                                   → "Comments" when 0 comments, "1 Comments" after first comment
  //                                   e.g. "//h2[contains(@class,'text-lg') and contains(@class,'font-semibold') and contains(@class,'text-gray-900')]"
  //   args[2] — "beforeCommentCount" : output variable (from $[beforeCommentCount])
  //   args[3] — "afterCommentCount"  : output variable (from $[afterCommentCount])
  //
  // Handles the "first comment" edge case:
  //   - countSpan may not exist / be hidden at 0 comments → treated as 0
  //   - headingSelector text = "Comments" (no number)     → treated as 0
  //   - After adding first comment: span shows "1", heading shows "1 Comments"
  //
  // Example test data:
  // {
  //   "countSpanSelector": "//span[@class='text-sm text-text-gray'][2]",
  //   "headingSelector":   "//h2[contains(@class,'text-lg') and contains(@class,'font-semibold') and contains(@class,'text-gray-900')]"
  // }

  const c = ctx as any;

  const countSpanSelector: string = (c.args?.[0] ?? '').trim();
  const headingSelector:   string = (c.args?.[1] ?? '').trim();
  const beforeVar:         string = c.args?.[2];
  const afterVar:          string = c.args?.[3];

  if (!countSpanSelector)
    throw new Error('countSpanSelector (args[0]) is required — the numeric span next to the comment icon.');
  if (!headingSelector)
    throw new Error('headingSelector (args[1]) is required — the h2 heading in the comments section.');
  if (!beforeVar)
    throw new Error('output variable $[beforeCommentCount] (args[2]) is required.');
  if (!afterVar)
    throw new Error('output variable $[afterCommentCount] (args[3]) is required.');

  // ── Helper: read the numeric span count ───────────────────────────────────
  // Returns 0 if the element is absent, hidden, or has no numeric text.
  // (At 0 comments the span may not be rendered at all.)
  const readSpanCount = async (): Promise<number> => {
    let raw = '';
    try { raw = (await c.getText(countSpanSelector) ?? '').trim(); } catch (_) {}
    if (!raw) return 0;                     // absent / hidden / empty → 0 comments
    const match = raw.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // ── Helper: read the h2 heading count ─────────────────────────────────────
  // "Comments"    → 0   (plain label, no comments yet)
  // "1 Comments"  → 1
  // "5 Comments"  → 5
  const readHeadingCount = async (): Promise<number> => {
    let raw = '';
    try { raw = (await c.getText(headingSelector) ?? '').trim(); } catch (_) {}
    if (!raw) {
      throw new Error(
        `Heading element returned empty text. Selector: "${headingSelector}". ` +
        `Make sure the blog detail page is open and the selector is correct.`
      );
    }
    const match = raw.match(/\d+/);
    if (match) return parseInt(match[0], 10);
    if (/comments?/i.test(raw)) return 0;   // "Comments" with no leading number → 0
    throw new Error(
      `Could not parse comment count from heading text. ` +
      `Selector: "${headingSelector}". Got: "${raw}"`
    );
  };

  // ── 1. Read counts BEFORE action ──────────────────────────────────────────
  const spanBefore    = await readSpanCount();
  const headingBefore = await readHeadingCount();

  c.log(`BEFORE — span: ${spanBefore}, heading: ${headingBefore === 0 ? '"Comments" (0)' : headingBefore}`);

  if (spanBefore !== headingBefore) {
    throw new Error(
      `Comment counts disagree BEFORE action — ` +
      `span shows ${spanBefore}, heading shows ${headingBefore}. ` +
      `Verify both selectors target the same blog post.`
    );
  }

  c.setVariable(beforeVar, String(spanBefore));
  c.log(`Stored before count "${spanBefore}" → $[${beforeVar}]`);

  // ── 2. Poll up to 5 s for both counts to update ───────────────────────────
  const maxWaitMs = 5000;
  const pollMs    = 300;
  const start     = Date.now();
  let spanAfter    = spanBefore;
  let headingAfter = headingBefore;

  while (Date.now() - start < maxWaitMs) {
    await c.wait(pollMs);
    try { spanAfter    = await readSpanCount();    } catch (_) { continue; }
    try { headingAfter = await readHeadingCount(); } catch (_) { continue; }
    // Both must have changed from the before-values before we stop polling
    if (spanAfter !== spanBefore && headingAfter !== headingBefore) break;
  }

  c.log(`AFTER — span: ${spanAfter}, heading: ${headingAfter}`);

  // ── 3. Cross-validate AFTER counts ────────────────────────────────────────
  if (spanAfter !== headingAfter) {
    throw new Error(
      `Comment counts disagree AFTER action — ` +
      `span shows ${spanAfter}, heading shows ${headingAfter}.`
    );
  }

  // ── 4. Verify exactly ±1 ──────────────────────────────────────────────────
  const delta = spanAfter - spanBefore;

  if (delta === 1) {
    c.log(`Comment count INCREASED: ${spanBefore} → ${spanAfter} (comment added) ✓`);
  } else if (delta === -1) {
    c.log(`Comment count DECREASED: ${spanBefore} → ${spanAfter} (comment deleted) ✓`);
  } else if (delta === 0) {
    throw new Error(
      `Comment count did not change after ${maxWaitMs}ms. Both counters stayed at ${spanBefore}. ` +
      `Make sure the add/delete action is performed BEFORE this step finishes.`
    );
  } else {
    throw new Error(
      `Unexpected delta: ${spanBefore} → ${spanAfter} (delta ${delta}). Expected exactly ±1.`
    );
  }

  // ── 5. Store after count ──────────────────────────────────────────────────
  c.setVariable(afterVar, String(spanAfter));
  c.log(`Stored after count "${spanAfter}" → $[${afterVar}]`);
}
