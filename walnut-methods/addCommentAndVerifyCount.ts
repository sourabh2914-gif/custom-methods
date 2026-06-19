import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Add/Delete Comment and Verify Count
 * description: Verify comment ${action} on count shown in ${commentCountSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_add_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function addCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — action               : "add" → expects count +1 | "delete" → expects count -1
  //   args[1] — commentCountSelector : XPath of the element showing the comment count number
  //   args[2] — "beforeCommentCount" : output variable name (from $[beforeCommentCount]) — count BEFORE action
  //   args[3] — "afterCommentCount"  : output variable name (from $[afterCommentCount])  — count AFTER action
  //
  // How it works (same pattern as like/dislike):
  //   1. Reads the count BEFORE the action → stores in $[beforeCommentCount]
  //   2. Waits up to 5s for the count to change (user performs add/delete in a prior/parallel step)
  //   3. Reads the count AFTER → stores in $[afterCommentCount]
  //   4. Verifies count changed by exactly +1 (add) or -1 (delete)
  //
  // The user performs the actual add/delete action via normal Walnut steps BEFORE this step.
  // This method only tracks and verifies the count change.
  //
  // Example test data for ADD:
  //   { "action": "add", "commentCountSelector": "//span[@class='text-sm text-text-gray'][2]" }
  //   → verifies count increased by 1, stores beforeCommentCount and afterCommentCount
  //
  // Example test data for DELETE:
  //   { "action": "delete", "commentCountSelector": "//span[@class='text-sm text-text-gray'][2]" }
  //   → verifies count decreased by 1, stores beforeCommentCount and afterCommentCount

  const c = ctx as any;

  const action:               string = (c.args?.[0] ?? '').toLowerCase().trim();
  const commentCountSelector: string = (c.args?.[1] ?? '').trim();
  const beforeVar:            string = c.args?.[2]; // $[beforeCommentCount]
  const afterVar:             string = c.args?.[3]; // $[afterCommentCount]

  if (action !== 'add' && action !== 'delete')
    throw new Error('action (args[0]) must be "add" or "delete".');
  if (!commentCountSelector)
    throw new Error('commentCountSelector (args[1]) is required.');
  if (!beforeVar)
    throw new Error('output variable $[beforeCommentCount] (args[2]) is required.');
  if (!afterVar)
    throw new Error('output variable $[afterCommentCount] (args[3]) is required.');

  // Helper: read the first integer from the comment count element
  const readCount = async (): Promise<number> => {
    let raw = '';
    try {
      raw = (await c.getText(commentCountSelector) ?? '').trim();
    } catch (_) {}

    // Try child span if container text is empty or non-numeric
    if (!raw || !/\d/.test(raw)) {
      try {
        raw = (await c.getText('(' + commentCountSelector + ')//span') ?? '').trim();
      } catch (_) {}
    }

    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(
        `Could not find a number in the comment count element. Selector: "${commentCountSelector}". Got: "${raw}"`
      );
    }
    return parseInt(match[0], 10);
  };

  // 1. Read count BEFORE action
  const countBefore = await readCount();
  c.log(`Comment count BEFORE ${action}: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  // 2. Poll up to 5s for the count to change
  const maxWaitMs = 5000;
  const pollMs    = 300;
  const start     = Date.now();
  let countAfter  = countBefore;

  while (Date.now() - start < maxWaitMs) {
    await c.wait(pollMs);
    try { countAfter = await readCount(); } catch (_) { continue; }
    if (countAfter !== countBefore) break;
  }

  // 3. Verify count changed by exactly ±1
  const delta = countAfter - countBefore;

  if (action === 'add') {
    if (delta === 1) {
      c.log(`Comment count INCREASED: ${countBefore} → ${countAfter} (comment added)`);
    } else if (delta === 0) {
      throw new Error(`Comment count did not increase after adding. Stayed at ${countBefore}.`);
    } else {
      throw new Error(`Unexpected count change after add: ${countBefore} → ${countAfter}. Expected +1.`);
    }
  } else {
    if (delta === -1) {
      c.log(`Comment count DECREASED: ${countBefore} → ${countAfter} (comment deleted)`);
    } else if (delta === 0) {
      throw new Error(`Comment count did not decrease after deleting. Stayed at ${countBefore}.`);
    } else {
      throw new Error(`Unexpected count change after delete: ${countBefore} → ${countAfter}. Expected -1.`);
    }
  }

  // 4. Store count AFTER action
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
