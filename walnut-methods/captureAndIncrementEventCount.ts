import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture and Increment Event Count
 * description: Read event count from $[currentEventCount] add 1 and store in $[expectedEventCount]
 * actionType: custom_capture_and_increment_event_count
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function captureAndIncrementEventCount(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] — "currentEventCount" : input variable name (from $[currentEventCount])
  //                                   must already be stored in runtime context (e.g. "70")
  //   args[1] — "expectedEventCount": output variable name (from $[expectedEventCount])
  //                                   stores currentCount + 1 (e.g. "71")
  //
  // Example step description:
  //   "Read event count from $[currentEventCount] add 1 and store in $[expectedEventCount]"
  //   Prerequisite: a previous step stored "70" in $[currentEventCount]
  //   Result: stores "71" in $[expectedEventCount]

  const c = ctx as any;

  const inputVar: string  = c.args?.[0]; // $[currentEventCount]  → variable name string "currentEventCount"
  const outputVar: string = c.args?.[1]; // $[expectedEventCount] → variable name string "expectedEventCount"

  if (!inputVar)  throw new Error('Input variable $[currentEventCount] (args[0]) is required.');
  if (!outputVar) throw new Error('Output variable $[expectedEventCount] (args[1]) is required.');

  // Read the stored value from the runtime variable
  const storedValue: string = c.getVariable(inputVar);

  if (storedValue === undefined || storedValue === null || storedValue === '') {
    throw new Error(
      `Runtime variable "$[${inputVar}]" is empty or not set. ` +
      `Make sure a previous step has stored the event count into it.`
    );
  }

  // Parse and increment
  const match = String(storedValue).match(/\d+/);
  if (!match) {
    throw new Error(
      `Runtime variable "$[${inputVar}]" contains "${storedValue}" — no number found.`
    );
  }

  const currentCount  = parseInt(match[0], 10);
  const expectedCount = currentCount + 1;

  c.log(`Read $[${inputVar}] = "${currentCount}"`);
  c.log(`Incremented by 1 → ${expectedCount}`);

  c.setVariable(outputVar, String(expectedCount));
  c.log(`Stored "${expectedCount}" → $[${outputVar}]`);
}
