import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get system date for ${date} in format ${dateFormat} and store in $[runtimeParam]
 * actionType: custom_get_date_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date}         — e.g. "today", "today+1", "today-1", "today+7"
  // ctx.args[1] = value of ${dateFormat}   — e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = value of $[runtimeParam] — the runtime variable name to store the result in

  const dateInput     = String(ctx.args[0] ?? 'today').trim().toLowerCase();
  const format        = String(ctx.args[1] ?? 'MM/DD/YYYY').trim();
  const outputVarName = ctx.args[2];  // e.g. "runtimeParam"

  // Parse offset from "today", "today+1", "today-1", "today+7" etc.
  let offset = 0;
  if (dateInput === 'today') {
    offset = 0;
  } else if (dateInput.startsWith('today')) {
    const sign = dateInput.includes('-') ? -1 : 1;
    const num  = parseInt(dateInput.replace('today', '').replace('+', '').replace('-', ''), 10);
    offset = isNaN(num) ? 0 : sign * num;
  } else {
    // Allow plain integer offset as well (e.g. "0", "1", "-1")
    const parsed = parseInt(dateInput, 10);
    offset = isNaN(parsed) ? 0 : parsed;
  }

  // Compute the target date
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy   = yyyy.slice(-2);

  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mmm  = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesFull[date.getMonth()];

  // Format — longest tokens replaced first to avoid partial matches (YYYY before YY, MMMM before MMM before MM)
  const formatted = format.toUpperCase()
    .replace('YYYY', yyyy)
    .replace('YY',   yy)
    .replace('MMMM', mmmm)
    .replace('MMM',  mmm)
    .replace('MM',   mm)
    .replace('DD',   dd);

  const label = offset === 0 ? 'today' : `today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[GetDateAndStore] ${label} → "${formatted}" (format: "${format}") → stored in $[${outputVarName}]`);

  // Store the result in the runtime variable
  ctx.setVariable(outputVarName, formatted);
}
