import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date By Offset
 * description: Get date for offset ${offset} with format ${format} and store in $[result]
 * actionType: custom_get_date_by_offset
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateByOffset(ctx: WalnutContext) {
  // ctx.args[0] = value of ${offset} — numeric day offset: 0 = today, 1 = tomorrow, -1 = yesterday, etc.
  // ctx.args[1] = value of ${format} — output format e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = "result" (from $[result]) — runtime variable name to store the formatted date into
  const offsetRaw = ctx.args[0];
  const format    = ctx.args[1];
  const outputVar = ctx.args[2];

  // Parse offset — accepts integers like 0, 1, -1, "+1", "-1"
  const offset = parseInt(String(offsetRaw), 10);
  if (isNaN(offset)) {
    throw new Error(`Invalid offset value: "${offsetRaw}". Expected an integer (e.g. 0, 1, -1).`);
  }

  // Resolve the target date
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

  // Normalize format to uppercase so mm/dd/yyyy and MM/DD/YYYY both work
  const formatted = format.toUpperCase()
    .replace('YYYY', yyyy)
    .replace('YY',   yy)
    .replace('MMMM', mmmm)
    .replace('MMM',  mmm)
    .replace('MM',   mm)
    .replace('DD',   dd);

  const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : offset === -1 ? 'yesterday' : `today ${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`Resolved date for "${label}" (offset ${offset}): "${formatted}" (format: "${format}")`);
  ctx.setVariable(outputVar, formatted);
}
