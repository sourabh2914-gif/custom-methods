import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get system date in format ${dateFormat} and store padded in $[paddedDate] and unpadded in $[unpaddedDate]
 * actionType: custom_get_date_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getDateAndStore(ctx: WalnutContext) {
  // ctx.args[0] = value of ${dateFormat}
  //   — format only:           "DD-MM-YYYY"        → current date
  //   — format with offset:    "DD-MM-YYYY +1"     → tomorrow
  //                            "DD-MM-YYYY +2"     → day after tomorrow
  //                            "DD-MM-YYYY -1"     → yesterday
  // ctx.args[1] = name from $[paddedDate]    — stores zero-padded date  e.g. "09-06-2026"
  // ctx.args[2] = name from $[unpaddedDate]  — stores non-padded date   e.g. "9-6-2026"

  const rawInput        = String(ctx.args[0] ?? 'DD-MM-YYYY').trim();
  const paddedVarName   = String(ctx.args[1]);
  const unpaddedVarName = String(ctx.args[2]);

  // Split "DD-MM-YYYY +1" into format="DD-MM-YYYY" and offset=1
  // Matches optional trailing whitespace + sign + digits at the end
  const offsetMatch = rawInput.match(/^(.*?)\s*([+-]\s*\d+)\s*$/);
  let format: string;
  let offset: number;

  if (offsetMatch) {
    format = offsetMatch[1].trim();
    offset = parseInt(offsetMatch[2].replace(/\s/g, ''), 10);
  } else {
    format = rawInput;
    offset = 0;
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

  const paddedFormatted   = applyFormat(true);   // e.g. "09-06-2026"
  const unpaddedFormatted = applyFormat(false);  // e.g. "9-6-2026"

  const label = offset === 0 ? 'today' : `today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[GetDateAndStore] input: "${rawInput}" → format: "${format}", offset: ${offset} (${label})`);
  ctx.log(`[GetDateAndStore] padded: "${paddedFormatted}" → $[${paddedVarName}]`);
  ctx.log(`[GetDateAndStore] unpadded: "${unpaddedFormatted}" → $[${unpaddedVarName}]`);

  ctx.setVariable(paddedVarName, paddedFormatted);
  ctx.setVariable(unpaddedVarName, unpaddedFormatted);
}
