import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get system date for ${date} in format ${dateFormat} and store in $[paddedDate] and $[unpaddedDate]
 * actionType: custom_get_date_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${date}           — e.g. "today", "today+1", "today-1", "today+7"
  // ctx.args[1] = value of ${dateFormat}     — e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = name from $[paddedDate]    — runtime variable for zero-padded date  e.g. "01-01-2004"
  // ctx.args[3] = name from $[unpaddedDate]  — runtime variable for non-padded date   e.g. "1-1-2004"

  const dateInput       = String(ctx.args[0] ?? 'today').trim().toLowerCase();
  const format          = String(ctx.args[1] ?? 'MM/DD/YYYY').trim();
  const paddedVarName   = String(ctx.args[2]);   // e.g. "paddedDate"
  const unpaddedVarName = String(ctx.args[3]);   // e.g. "unpaddedDate"

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

  // Zero-padded components
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy   = yyyy.slice(-2);

  // Non-padded components (no leading zeros)
  const d  = String(date.getDate());
  const m  = String(date.getMonth() + 1);

  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mmm  = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesFull[date.getMonth()];

  // Helper: apply format substitutions
  // Longest tokens replaced first to avoid partial matches (YYYY before YY, MMMM before MMM before MM)
  function applyFormat(padded: boolean): string {
    return format.toUpperCase()
      .replace('YYYY', yyyy)
      .replace('YY',   yy)
      .replace('MMMM', mmmm)
      .replace('MMM',  mmm)
      .replace('MM',   padded ? mm : m)
      .replace('DD',   padded ? dd : d);
  }

  const paddedFormatted   = applyFormat(true);   // e.g. "01-01-2004"
  const unpaddedFormatted = applyFormat(false);  // e.g. "1-1-2004"

  const label = offset === 0 ? 'today' : `today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[GetDateAndStore] ${label} → padded: "${paddedFormatted}", unpadded: "${unpaddedFormatted}" (format: "${format}")`);
  ctx.log(`[GetDateAndStore] Storing "${paddedFormatted}" → $[${paddedVarName}]`);
  ctx.log(`[GetDateAndStore] Storing "${unpaddedFormatted}" → $[${unpaddedVarName}]`);

  // Store both formats as runtime variables
  ctx.setVariable(paddedVarName, paddedFormatted);
  ctx.setVariable(unpaddedVarName, unpaddedFormatted);
}
