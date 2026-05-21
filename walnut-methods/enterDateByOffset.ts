import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Enter Date By Offset
 * description: Enter date with day offset ${offset} using format ${format} into ${selector}
 * actionType: custom_enter_date_by_offset
 * context: web
 * needsLocator: false
 * category: Forms
 */
export async function enterDateByOffset(ctx: WalnutContext) {
  // ctx.args[0] = value of ${offset}   — numeric day offset: 0 = today, 1 = tomorrow, -1 = yesterday, etc.
  // ctx.args[1] = value of ${format}   — output format e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "DD MMM YYYY"
  // ctx.args[2] = value of ${selector} — CSS/XPath selector of the date input field
  const offsetRaw = ctx.args[0];
  const format    = ctx.args[1];
  const selector  = ctx.args[2];

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

  // Normalize format to uppercase before replacing, so mm/dd/yyyy and MM/DD/YYYY both work
  const formatted = format.toUpperCase()
    .replace('YYYY', yyyy)
    .replace('YY',   yy)
    .replace('MMMM', mmmm)
    .replace('MMM',  mmm)
    .replace('MM',   mm)
    .replace('DD',   dd);

  const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : offset === -1 ? 'yesterday' : `today ${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`Entering date for "${label}" (offset ${offset}): "${formatted}" (format: "${format}") into "${selector}"`);

  // Clear the field and type the formatted date
  await ctx.clear(selector);
  await ctx.type(selector, formatted);
}
