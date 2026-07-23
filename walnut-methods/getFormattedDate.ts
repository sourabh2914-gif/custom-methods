import type { WalnutContext } from './walnut';
import * as dayjs from 'dayjs';

/** @walnut_method
 * name: Get Formatted Date
 * description: Get date for ${date} with format ${format} and store in $[result]
 * actionType: custom_get_formatted_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getFormattedDate(ctx: WalnutContext) {
  // ctx.args[0] = date input (from ${date})  — e.g. "today", "tomorrow", "yesterday", "+3d", "-1m", "+2y", "2026-07-23"
  // ctx.args[1] = format string (from ${format}) — e.g. "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"
  // ctx.args[2] = "result" (from $[result])   — runtime variable name to store the formatted date

  const dateInput: string = ctx.args[0];
  const format: string = ctx.args[1];
  const outputVar: string = ctx.args[2];

  let date = dayjs();

  const normalized = dateInput.trim().toLowerCase();

  if (normalized === 'today') {
    date = dayjs();
  } else if (normalized === 'tomorrow') {
    date = dayjs().add(1, 'day');
  } else if (normalized === 'yesterday') {
    date = dayjs().subtract(1, 'day');
  } else {
    // Relative offset: +3d, -2m, +1y, -7d
    const relativeMatch = normalized.match(/^([+-])(\d+)([dmy])$/);
    if (relativeMatch) {
      const sign = relativeMatch[1] === '+' ? 1 : -1;
      const amount = parseInt(relativeMatch[2], 10) * sign;
      const unitMap: Record<string, dayjs.ManipulateType> = { d: 'day', m: 'month', y: 'year' };
      date = dayjs().add(amount, unitMap[relativeMatch[3]]);
    } else {
      // Absolute date string (e.g. "2026-07-23", "07/23/2026")
      const parsed = dayjs(dateInput);
      if (!parsed.isValid()) {
        throw new Error(
          `getFormattedDate: unrecognized date input "${dateInput}". ` +
          `Accepted values: "today", "tomorrow", "yesterday", a relative offset like "+3d"/"-1m"/"+2y", or an absolute date string.`
        );
      }
      date = parsed;
    }
  }

  const formatted = date.format(format);
  ctx.setVariable(outputVar, formatted);
  ctx.log(`getFormattedDate: "${dateInput}" → "${formatted}" (format: ${format})`);
}
