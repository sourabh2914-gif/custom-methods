import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Add/Delete Comment and Verify Count
 * description: Add comment ${commentText} in ${commentInputSelector} or delete using ${deleteSelector} with count in ${commentCountSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_add_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function addCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — commentText          : Comment text to type. Pass "NA" when deleting.
  //   args[1] — commentInputSelector : XPath of the "Add a comment..." input field. Pass "NA" when deleting.
  //   args[2] — deleteSelector       : XPath of the delete (trash) icon/button. Pass "NA" when adding.
  //   args[3] — commentCountSelector : XPath of the element showing the comment count (e.g. the span showing "1").
  //   args[4] — "beforeCommentCount" : output variable name (from $[beforeCommentCount]) — count BEFORE action
  //   args[5] — "afterCommentCount"  : output variable name (from $[afterCommentCount])  — count AFTER action
  //
  // ADD  → pass commentText + commentInputSelector, set deleteSelector = "NA"
  //         types the comment and presses Enter → count must increase by +1
  // DELETE → pass deleteSelector, set commentText = "NA" and commentInputSelector = "NA"
  //           clicks the delete button → count must decrease by -1
  //
  // Example test data for ADD:
  //   {
  //     "commentText": "Great article!",
  //     "commentInputSelector": "//input[@placeholder='Add a comment...']",
  //     "deleteSelector": "NA",
  //     "commentCountSelector": "//span[@class='text-sm text-text-gray']"
  //   }
  //
  // Example test data for DELETE:
  //   {
  //     "commentText": "NA",
  //     "commentInputSelector": "NA",
  //     "deleteSelector": "(//button[.//*[contains(@class,'lucide-trash')]])[1]",
  //     "commentCountSelector": "//span[@class='text-sm text-text-gray']"
  //   }

  const c = ctx as any;

  const commentText:          string = (c.args?.[0] ?? '').trim();
  const commentInputSelector: string = (c.args?.[1] ?? '').trim();
  const deleteSelector:       string = (c.args?.[2] ?? '').trim();
  const commentCountSelector: string = (c.args?.[3] ?? '').trim();
  const beforeVar:            string = c.args?.[4]; // $[beforeCommentCount]
  const afterVar:             string = c.args?.[5]; // $[afterCommentCount]

  const isAdd    = commentText.toUpperCase() !== 'NA' && commentInputSelector.toUpperCase() !== 'NA';
  const isDelete = deleteSelector.toUpperCase() !== 'NA';

  if (!isAdd && !isDelete)
    throw new Error('Provide commentText + commentInputSelector to add, or deleteSelector to delete.');
  if (!commentCountSelector)
    throw new Error('commentCountSelector (args[3]) is required.');
  if (!beforeVar)
    throw new Error('output variable $[beforeCommentCount] (args[4]) is required.');
  if (!afterVar)
    throw new Error('output variable $[afterCommentCount] (args[5]) is required.');

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

  const action = isAdd ? 'add' : 'delete';

  // 1. Read count BEFORE action
  const countBefore = await readCount();
  c.log(`Comment count BEFORE ${action}: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  if (isAdd) {
    // 2a. Type comment and press Enter
    await c.click(commentInputSelector);
    await c.type(commentInputSelector, commentText);
    c.log(`Typed comment: "${commentText}"`);
    await c.pressKey('Enter');
    c.log('Submitted comment by pressing Enter');
  } else {
    // 2b. Click delete button
    await c.click(deleteSelector);
    c.log(`Clicked delete button: "${deleteSelector}"`);
  }

  // 3. Poll up to 5s for count to change
  const maxWaitMs = 5000;
  const pollMs    = 300;
  const start     = Date.now();
  let countAfter  = countBefore;

  while (Date.now() - start < maxWaitMs) {
    await c.wait(pollMs);
    try { countAfter = await readCount(); } catch (_) { continue; }
    if (countAfter !== countBefore) break;
  }

  // 4. Verify count changed by exactly ±1
  const delta = countAfter - countBefore;

  if (isAdd) {
    if (delta === 1) {
      c.log(`Comment count INCREASED: ${countBefore} → ${countAfter} (added)`);
    } else if (delta === 0) {
      throw new Error(`Comment count did not increase after adding. Stayed at ${countBefore}.`);
    } else {
      throw new Error(`Unexpected count change after add: ${countBefore} → ${countAfter}. Expected +1.`);
    }
  } else {
    if (delta === -1) {
      c.log(`Comment count DECREASED: ${countBefore} → ${countAfter} (deleted)`);
    } else if (delta === 0) {
      throw new Error(`Comment count did not decrease after deleting. Stayed at ${countBefore}.`);
    } else {
      throw new Error(`Unexpected count change after delete: ${countBefore} → ${countAfter}. Expected -1.`);
    }
  }

  // 5. Store count AFTER action
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
