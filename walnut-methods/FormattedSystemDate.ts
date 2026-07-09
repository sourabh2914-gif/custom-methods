import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Formatted System Date
 * description: Capture system date for ${dateOffset} in YYYY-MM-DD format and store in $[dateValue]
 * actionType: custom_formatted_system_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function formattedSystemDate(ctx: WalnutContext) {
  // ctx.args[0] = value of ${dateOffset} — "Today" or "Today+1"
  // ctx.args[1] = name from $[dateValue]  — runtime variable to store the result

  const dateOffset  = String(ctx.args[0] ?? 'Today').trim();
  const outputVar   = String(ctx.args[1]);

  // Resolve day offset: "Today" → 0, "Today+1" → 1
  let offset = 0;
  const match = dateOffset.match(/^Today([+-]\d+)?$/i);
  if (!match) {
    throw new Error(
      `[FormattedSystemDate] Unsupported dateOffset "${dateOffset}". Use "Today" or "Today+1".`
    );
  }
  if (match[1]) {
    offset = parseInt(match[1], 10);
  }

  // Compute target date
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const yyyy = String(date.getFullYear());
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const formatted = `${yyyy}-${mm}-${dd}`;

  const label = offset === 0 ? 'Today' : `Today${offset > 0 ? '+' : ''}${offset}`;
  ctx.log(`[FormattedSystemDate] dateOffset: "${dateOffset}" (${label}) → "${formatted}" → $[${outputVar}]`);

  ctx.setVariable(outputVar, formatted);
}
