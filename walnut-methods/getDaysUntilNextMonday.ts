import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Days Until Next Monday
 * description: Calculate the number of days from today until the next Monday and store in $[daysUntilMonday]
 * actionType: custom_get_days_until_next_monday
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDaysUntilNextMonday(ctx: WalnutContext) {
  // ctx.args[0] = value of $[daysUntilMonday] — the runtime variable name to store the result in
  //
  // Logic:
  //   JS getDay() returns: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  //   Days until next Monday = (8 - currentDay) % 7, but if today IS Monday → 7 (next week's Monday)
  //
  // Examples:
  //   Tuesday  (2) → (8 - 2) % 7 = 6
  //   Wednesday(3) → (8 - 3) % 7 = 5
  //   Thursday (4) → (8 - 4) % 7 = 4
  //   Friday   (5) → (8 - 5) % 7 = 3
  //   Saturday (6) → (8 - 6) % 7 = 2
  //   Sunday   (0) → (8 - 0) % 7 = 1
  //   Monday   (1) → (8 - 1) % 7 = 0 → treated as 7 (next Monday)

  const outputVarName = ctx.args[0]; // e.g. "daysUntilMonday"

  const today = new Date();
  const currentDay = today.getDay(); // 0 (Sun) … 6 (Sat)

  let daysUntil = (8 - currentDay) % 7;
  if (daysUntil === 0) {
    daysUntil = 7; // today is Monday → next Monday is 7 days away
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  ctx.log(
    `[GetDaysUntilNextMonday] Today is ${dayNames[currentDay]} → next Monday is in ${daysUntil} day(s) → stored in $[${outputVarName}]`
  );

  ctx.setVariable(outputVarName, String(daysUntil));
}
