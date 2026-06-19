import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Add/Delete Comment and Verify Count
 * description: Perform ${action} on comment using ${actionSelector} with input ${commentInputSelector} submit ${submitSelector} count shown in ${commentCountSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_add_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function addCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — action               : "add" to add a comment, "delete" to delete a comment
  //   args[1] — actionSelector       : For "add" → XPath of the comment input field ("Add a comment...")
  //                                    For "delete" → XPath of the delete (trash) icon/button
  //   args[2] — commentInputSelector : For "add" → same as actionSelector (comment input field)
  //                                    For "delete" → pass "NA" (not used)
  //   args[3] — submitSelector       : For "add" → XPath of submit button or "ENTER" to press Enter
  //                                    For "delete" → pass "NA" (not used)
  //   args[4] — commentCountSelector : XPath of the element showing the comment count number
  //   args[5] — "beforeCommentCount" : output variable name (from $[beforeCommentCount]) — count BEFORE action
  //   args[6] — "afterCommentCount"  : output variable name (from $[afterCommentCount])  — count AFTER action
  //
  // Behaviour for "add":
  //   1. Read count BEFORE → store in $[beforeCommentCount]
  //   2. Click input field and type comment text
  //   3. Submit (Enter or button click)
  //   4. Poll up to 5s for count to increase by 1
  //   5. Store count AFTER → $[afterCommentCount]
  //   6. Assert count increased by exactly +1
  //
  // Behaviour for "delete":
  //   1. Read count BEFORE → store in $[beforeCommentCount]
  //   2. Click the delete button/icon
  //   3. Poll up to 5s for count to decrease by 1
  //   4. Store count AFTER → $[afterCommentCount]
  //   5. Assert count decreased by exactly -1
  //
  // Example test data for ADD:
  //   {
  //     "action": "add",
  //     "actionSelector": "//input[@placeholder='Add a comment...']",
  //     "commentInputSelector": "This is a test comment",
  //     "submitSelector": "ENTER",
  //     "commentCountSelector": "(//*[contains(@class,'lucide-message')])/ancestor::div[contains(@class,'cursor-pointer')]//span"
  //   }
  //
  // Example test data for DELETE:
  //   {
  //     "action": "delete",
  //     "actionSelector": "(//button[.//*[contains(@class,'lucide-trash')]])[1]",
  //     "commentInputSelector": "NA",
  //     "submitSelector": "NA",
  //     "commentCountSelector": "(//*[contains(@class,'lucide-message')])/ancestor::div[contains(@class,'cursor-pointer')]//span"
  //   }

  const c = ctx as any;

  const action:               string = (c.args?.[0] ?? '').toLowerCase().trim();
  const actionSelector:       string = c.args?.[1];
  const commentText:          string = c.args?.[2]; // comment text for "add", "NA" for "delete"
  const submitSelector:       string = c.args?.[3]; // submit selector for "add", "NA" for "delete"
  const commentCountSelector: string = c.args?.[4];
  const beforeVar:            string = c.args?.[5]; // $[beforeCommentCount]
  const afterVar:             string = c.args?.[6]; // $[afterCommentCount]

  if (!action || (action !== 'add' && action !== 'delete'))
    throw new Error('action (args[0]) must be "add" or "delete".');
  if (!actionSelector)       throw new Error('actionSelector (args[1]) is required.');
  if (!commentCountSelector) throw new Error('commentCountSelector (args[4]) is required.');
  if (!beforeVar)            throw new Error('output variable $[beforeCommentCount] (args[5]) is required.');
  if (!afterVar)             throw new Error('output variable $[afterCommentCount] (args[6]) is required.');

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

  // 1. Read count BEFORE action
  const countBefore = await readCount();
  c.log(`Comment count BEFORE ${action}: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  if (action === 'add') {
    // 2a. Click input and type comment
    await c.click(actionSelector);
    await c.type(actionSelector, commentText);
    c.log(`Typed comment: "${commentText}"`);

    // 3a. Submit — press Enter or click submit button
    if (!submitSelector || submitSelector.trim().toUpperCase() === 'ENTER') {
      await c.pressKey('Enter');
      c.log('Submitted comment by pressing Enter');
    } else {
      await c.click(submitSelector);
      c.log(`Submitted comment by clicking: "${submitSelector}"`);
    }
  } else {
    // 2b. Click delete button
    await c.click(actionSelector);
    c.log(`Clicked delete button: "${actionSelector}"`);
  }

  // 3. Poll up to 5s for count to change
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

  if (action === 'add') {
    if (delta === 1) {
      c.log(`Comment count INCREASED: ${countBefore} → ${countAfter} (comment added)`);
    } else if (delta === 0) {
      throw new Error(
        `Comment count did not increase after adding. Count stayed at ${countBefore}. ` +
        `Check input selector, submit selector, and count selector.`
      );
    } else {
      throw new Error(
        `Unexpected comment count change after add: ${countBefore} → ${countAfter} (delta ${delta}). Expected +1.`
      );
    }
  } else {
    if (delta === -1) {
      c.log(`Comment count DECREASED: ${countBefore} → ${countAfter} (comment deleted)`);
    } else if (delta === 0) {
      throw new Error(
        `Comment count did not decrease after deleting. Count stayed at ${countBefore}. ` +
        `Check delete selector and count selector. If a confirmation dialog appeared, handle it first.`
      );
    } else {
      throw new Error(
        `Unexpected comment count change after delete: ${countBefore} → ${countAfter} (delta ${delta}). Expected -1.`
      );
    }
  }

  // 5. Store count AFTER action
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
