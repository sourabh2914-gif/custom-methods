import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Add Comment and Verify Count
 * description: Type ${commentText} in ${commentInputSelector} and submit using ${submitSelector} with count shown in ${commentCountSelector} and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]
 * actionType: custom_add_comment_and_verify_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function addCommentAndVerifyCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — commentText           : The comment text to type
  //   args[1] — commentInputSelector  : XPath of the "Add a comment..." input field
  //   args[2] — submitSelector        : XPath of the submit button (or "ENTER" to press Enter key)
  //   args[3] — commentCountSelector  : XPath of the element showing the comment count number
  //   args[4] — "beforeCommentCount"  : output variable name (from $[beforeCommentCount]) — count BEFORE submit
  //   args[5] — "afterCommentCount"   : output variable name (from $[afterCommentCount])  — count AFTER submit
  //
  // Behaviour:
  //   1. Read the comment count BEFORE submitting → store in $[beforeCommentCount]
  //   2. Type commentText into the input field
  //   3. Click the submit button (or press Enter if submitSelector is "ENTER")
  //   4. Poll up to 5 s for the count to increase by 1
  //   5. Read the comment count AFTER submit → store in $[afterCommentCount]
  //   6. Assert count increased by exactly 1 (throws if not)
  //
  // Example step description:
  //   "Type ${commentText} in ${commentInputSelector} and submit using ${submitSelector}
  //    with count shown in ${commentCountSelector}
  //    and store before count in $[beforeCommentCount] and after count in $[afterCommentCount]"
  //
  // Example test data:
  //   {
  //     "commentText": "This is a test comment",
  //     "commentInputSelector": "//input[@placeholder='Add a comment...']",
  //     "submitSelector": "ENTER",
  //     "commentCountSelector": "(//*[contains(@class,'lucide-message')])/ancestor::div[contains(@class,'cursor-pointer')]//span"
  //   }

  const c = ctx as any;

  const commentText:          string = c.args?.[0];
  const commentInputSelector: string = c.args?.[1];
  const submitSelector:       string = c.args?.[2];
  const commentCountSelector: string = c.args?.[3];
  const beforeVar:            string = c.args?.[4]; // $[beforeCommentCount]
  const afterVar:             string = c.args?.[5]; // $[afterCommentCount]

  if (!commentText)          throw new Error('commentText (args[0]) is required.');
  if (!commentInputSelector) throw new Error('commentInputSelector (args[1]) is required.');
  if (!submitSelector)       throw new Error('submitSelector (args[2]) is required. Pass "ENTER" to press Enter key.');
  if (!commentCountSelector) throw new Error('commentCountSelector (args[3]) is required.');
  if (!beforeVar)            throw new Error('output variable $[beforeCommentCount] (args[4]) is required.');
  if (!afterVar)             throw new Error('output variable $[afterCommentCount] (args[5]) is required.');

  // Helper: read the first integer from the comment count element
  const readCount = async (): Promise<number> => {
    let raw = '';
    try {
      raw = (await c.getText(commentCountSelector) ?? '').trim();
    } catch (_) {}

    // Try child span if container text is empty
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

  // 1. Read count BEFORE submitting comment
  const countBefore = await readCount();
  c.log(`Comment count BEFORE submit: ${countBefore}`);
  c.setVariable(beforeVar, String(countBefore));
  c.log(`Stored before count "${countBefore}" → $[${beforeVar}]`);

  // 2. Type the comment into the input field
  await c.click(commentInputSelector);
  await c.type(commentInputSelector, commentText);
  c.log(`Typed comment: "${commentText}"`);

  // 3. Submit — either press Enter or click the submit button
  if (submitSelector.trim().toUpperCase() === 'ENTER') {
    await c.pressKey('Enter');
    c.log('Submitted comment by pressing Enter');
  } else {
    await c.click(submitSelector);
    c.log(`Submitted comment by clicking: "${submitSelector}"`);
  }

  // 4. Poll up to 5 s for the count to increase
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

  // 5. Verify count increased by exactly 1
  const delta = countAfter - countBefore;

  if (delta === 1) {
    c.log(`Comment count INCREASED: ${countBefore} → ${countAfter}`);
  } else if (delta === 0) {
    throw new Error(
      `Comment count did not increase after submitting. Count stayed at ${countBefore}. ` +
      `Check that the input selector, submit selector, and count selector are correct.`
    );
  } else {
    throw new Error(
      `Unexpected comment count change: ${countBefore} → ${countAfter} (delta ${delta}). ` +
      `Expected exactly +1 after adding a comment.`
    );
  }

  // 6. Store count AFTER submit
  c.setVariable(afterVar, String(countAfter));
  c.log(`Stored after count "${countAfter}" → $[${afterVar}]`);
}
