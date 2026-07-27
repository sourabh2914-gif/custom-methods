import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Formatted Date
 * description: Get date for ${date} with format ${format} and store in $[result]
 * actionType: custom_get_formatted_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getFormattedDate(ctx: WalnutContext) {
  const dateInput: string = ctx.args[0];  // e.g. "today", "tomorrow", "yesterday", "+3d", "-1m", "+2y"
  const format: string = ctx.args[1];     // e.g. "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"
  const outputVar: string = ctx.args[2];  // variable name from $[result]

  const date = new Date();
  const normalized = dateInput.trim().toLowerCase();

  if (normalized === 'today') {
    // use current date as-is
  } else if (normalized === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  } else if (normalized === 'yesterday') {
    date.setDate(date.getDate() - 1);
  } else {
    // Relative offset: +3d, -2m, +1y
    const match = normalized.match(/^([+-])(\d+)([dmy])$/);
    if (match) {
      const sign = match[1] === '+' ? 1 : -1;
      const amount = parseInt(match[2], 10) * sign;
      if (match[3] === 'd') date.setDate(date.getDate() + amount);
      else if (match[3] === 'm') date.setMonth(date.getMonth() + amount);
      else if (match[3] === 'y') date.setFullYear(date.getFullYear() + amount);
    } else {
      // Absolute date string e.g. "2026-07-23"
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        throw new Error(`getFormattedDate: unrecognized date input "${dateInput}"`);
      }
      date.setTime(parsed.getTime());
    }
  }

  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());

  const formatted = format
    .replace('MM', mm)
    .replace('DD', dd)
    .replace('YYYY', yyyy);

  ctx.setVariable(outputVar, formatted);
  ctx.log(`getFormattedDate: "${dateInput}" → "${formatted}" (format: ${format})`);
}
