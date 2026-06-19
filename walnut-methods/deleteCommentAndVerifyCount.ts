import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Delete Comment and Verify Count
 * description: Delete comment using ${deleteSelector} with count shown in ${commentCountSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_delete_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function deleteCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — deleteSelector        : XPath of the delete (trash) icon/button of the comment to delete
  //   args[1] — commentCountSelector  : XPath of the element showing the comment count number
  //   args[2] — "beforeCommentCount"  : output variable name (from $[beforeCommentCount]) — count BEFORE delete
  //   args[3] — "afterCommentCount"   : output variable name (from $[afterCommentCount])  — count AFTER delete
  //
  // Behaviour:
  //   1. Read the comment count BEFORE delete → store in $[beforeCommentCount]
  //   2. Click the delete button/icon
  //   3. Poll up to 5 s for the count to decrease by 1
  //   4. Read the comment count AFTER delete → store in $[afterCommentCount]
  //   5. Assert count decreased by exactly 1 (throws if not)
  //
  // Example step description:
  //   "Delete comment using ${deleteSelector} with count shown in ${commentCountSelector}
  //    and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]"
  //
  // Example test data:
  //   {
  //     "deleteSelector": "(//button[.//*[contains(@class,'lucide-trash')]])[1]",
  //     "commentCountSelector": "(//*[contains(@class,'lucide-message')])/ancestor::div[contains(@class,'cursor-pointer')]//span"
  //   }
  //
  // Note: If deletion shows a confirmation dialog, add a separate step to confirm it BEFORE using this method,
  //       OR pass the confirmation button XPath as deleteSelector if it appears immediately after clicking delete.

  const c = ctx as any;

  const deleteSelector:       string = c.args?.[0];
  const commentCountSelector: string = c.args?.[1];
  const beforeVar:            string = c.args?.[2]; // $[beforeCommentCount]
  const afterVar:             string = c.args?.[3]; // $[afterCommentCount]

  if (!deleteSelector)       throw new Error('deleteSelector (args[0]) is required.');
  if (!commentCountSelector) throw new Error('commentCountSelector (args[1]) is required.');
  if (!beforeVar)            throw new Error('output variable $[beforeCommentCount] (args[2]) is required.');
  if (!afterVar)             throw new Error('output variable $[afterCommentCount] (args[3]) is required.');

  // Helper: read the first integer from the comment count element
  const readCount = async (): Promise<number> => {
    let raw = '';
    try {
      raw = (await c.getText(commentCountSelector) ?? '').trim();
    } catch (_) {}

    // Try child span if container text is empty or non-numeric
    if (!raw || !/\d/.test(raw)) {
      try {
        const spanXpath = '(' + commentCountSelector + ')//span';
        raw = (await c.getText(spanXpath) ?? '').trim();
      } catch (_) {}
    }

    // Extract first number (handles "1", "1 Comments", "(1)", " 1 ")
    const match = raw.match(/\d+/);
    if (!match) {
      throw new Error(
        `Could not find a number in the comment count element. Selector: "${commentCountSelector}". Got text: "${raw}"`
      );
    }
    return parseInt(match[0], 10);
  };

  // 1. Read count BEFORE delete
  const countBefore = await readCount();
  c.log(`Comment count BEFORE delete: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  // 2. Click the delete button
  await c.click(deleteSelector);
  c.log(`Clicked delete button: "${deleteSelector}"`);

  // 3. Poll up to 5 s for the count to decrease
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

  // 4. Verify count decreased by exactly 1
  const delta = countAfter - countBefore;

  if (delta === -1) {
    c.log(`Comment count DECREASED: ${countBefore} → ${countAfter} (comment deleted)`);
  } else if (delta === 0) {
    throw new Error(
      `Comment count did not decrease after deleting. Count stayed at ${countBefore}. ` +
      `Check that the delete selector is correct and the click registered. ` +
      `If a confirmation dialog appeared, handle it before using this method.`
    );
  } else {
    throw new Error(
      `Unexpected comment count change: ${countBefore} → ${countAfter} (delta ${delta}). ` +
      `Expected exactly -1 after deleting a comment.`
    );
  }

  // 5. Store count AFTER delete
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
