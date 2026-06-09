import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get current system date in format ${dateFormat} and store padded in $[paddedDate] and unpadded in $[unpaddedDate]
 * actionType: custom_get_date_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${dateFormat}      — e.g. "MM/DD/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"
  // ctx.args[1] = name from $[paddedDate]     — runtime variable for zero-padded date  e.g. "01-01-2004"
  // ctx.args[2] = name from $[unpaddedDate]   — runtime variable for non-padded date   e.g. "1-1-2004"

  const format          = String(ctx.args[0] ?? 'DD-MM-YYYY').trim();
  const paddedVarName   = String(ctx.args[1]);
  const unpaddedVarName = String(ctx.args[2]);

  // Always use the current system date
  const date = new Date();

  // Zero-padded components
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy   = yyyy.slice(-2);

  // Non-padded components (no leading zeros)
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1);

  const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthNamesFull  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mmm  = monthNamesShort[date.getMonth()];
  const mmmm = monthNamesFull[date.getMonth()];

  // Apply format — longest tokens first to avoid partial matches
  function applyFormat(padded: boolean): string {
    return format.toUpperCase()
      .replace('YYYY', yyyy)
      .replace('YY',   yy)
      .replace('MMMM', mmmm)
      .replace('MMM',  mmm)
      .replace('MM',   padded ? mm : m)
      .replace('DD',   padded ? dd : d);
  }

  const paddedFormatted   = applyFormat(true);   // e.g. "01-06-2026"
  const unpaddedFormatted = applyFormat(false);  // e.g. "1-6-2026"

  ctx.log(`[GetDateAndStore] system date → padded: "${paddedFormatted}", unpadded: "${unpaddedFormatted}" (format: "${format}")`);
  ctx.log(`[GetDateAndStore] Storing "${paddedFormatted}" → $[${paddedVarName}]`);
  ctx.log(`[GetDateAndStore] Storing "${unpaddedFormatted}" → $[${unpaddedVarName}]`);

  ctx.setVariable(paddedVarName, paddedFormatted);
  ctx.setVariable(unpaddedVarName, unpaddedFormatted);
}
