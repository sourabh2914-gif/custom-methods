import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date
 * description: Get date for ${date} with format ${format} and store in $[result]
 * actionType: custom_get_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDate(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date} — date string or keywords: "today", "tomorrow", "yesterday", or any valid date (e.g. "2026-04-24")
  // ctx.args[1] = value of ${format} — format string e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = "result" (from $[result]) — runtime variable name to store into
  const dateInput = ctx.args[0];
  const format = ctx.args[1];
  const outputVar = ctx.args[2];

  // Resolve the date
  let date: Date;
  const normalized = dateInput.trim().toLowerCase();
  if (normalized === 'today') {
    date = new Date();
  } else if (normalized === 'tomorrow') {
    date = new Date();
    date.setDate(date.getDate() + 1);
  } else if (normalized === 'yesterday') {
    date = new Date();
    date.setDate(date.getDate() - 1);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) {
    ctx.log(`Invalid date input: "${dateInput}"`);
    ctx.setVariable(outputVar, '');
    return;
  }

  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy   = yyyy.slice(-2);

  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mmm  = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesFull[date.getMonth()];

  const result = format
    .replace('YYYY', yyyy)
    .replace('YY',   yy)
    .replace('MMMM', mmmm)
    .replace('MMM',  mmm)
    .replace('MM',   mm)
    .replace('DD',   dd);

  ctx.log(`Resolved date: "${dateInput}" → "${result}" (format: "${format}")`);
  ctx.setVariable(outputVar, result);
}
