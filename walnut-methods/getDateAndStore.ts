import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Date And Store
 * description: Get system date in format ${dateFormat} and store padded in $[paddedDate] and unpadded in $[unpaddedDate]
 * actionType: custom_get_date_and_store
 * context: web
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

  // ── Parse format and offset (unchanged) ──────────────────────────────────────────────────────
  // Split "DD-MM-YYYY +1" into format="DD-MM-YYYY" and offset=1
  const tokens = rawInput.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? '';
  let format: string;
  let offset: number;

  if (/^[+-]\d+$/.test(lastToken)) {
    format = tokens.slice(0, -1).join(' ').trim();
    offset = parseInt(lastToken, 10);
  } else {
    format = rawInput;
    offset = 0;
  }

  // ── Compute target date (unchanged) ──────────────────────────────────────────────────────────
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

  // Apply format — single-pass regex replacement to avoid cascade/overlap issues.
  // Alternation order ensures longer tokens (YYYY, MMMM, MMM) are always tried
  // before their shorter overlapping counterparts (YY, MM).
  function applyFormat(padded: boolean): string {
    const tokenMap: Record<string, string> = {
      'YYYY': yyyy,
      'YY':   yy,
      'MMMM': mmmm,
      'MMM':  mmm,
      'MM':   padded ? mm : m,
      'DD':   padded ? dd : d,
    };
    return format.toUpperCase().replace(
      /YYYY|YY|MMMM|MMM|MM|DD/g,
      (token) => tokenMap[token] ?? token
    );
  }

  const paddedFormatted   = applyFormat(true);   // e.g. "09-06-2026"
  const unpaddedFormatted = applyFormat(false);  // e.g. "9-6-2026"

  const label = offset === 0 ? 'today' : `today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[GetDateAndStore] input: "${rawInput}" → format: "${format}", offset: ${offset} (${label})`);
  ctx.log(`[GetDateAndStore] padded: "${paddedFormatted}" → $[${paddedVarName}]`);
  ctx.log(`[GetDateAndStore] unpadded: "${unpaddedFormatted}" → $[${unpaddedVarName}]`);

  // ── Store variables (unchanged) ───────────────────────────────────────────────────────────────
  ctx.setVariable(paddedVarName, paddedFormatted);
  ctx.setVariable(unpaddedVarName, unpaddedFormatted);

}
