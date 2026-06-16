import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Current Date Time And Store
 * description: Get current system date and time in MM/DD/YYYY, HH:MM AM/PM format and store in $[currentDateTime]
 * actionType: custom_get_current_date_time_and_store
 * context: web
 * needsLocator: false
 * category: Data Processing
 */
export async function getCurrentDateTimeAndStore(ctx: WalnutContext) {
  // ctx.args[0] = "currentDateTime" (from $[currentDateTime]) — runtime variable name
  //
  // Always produces: "MM/DD/YYYY, HH:MM AM/PM"  e.g. "06/16/2026, 01:14 PM"
  // — Date part:  MM/DD/YYYY  (zero-padded month and day)
  // — Time part:  12-hour clock with AM/PM, regardless of system locale/24hr setting
  //
  // Example output: "06/16/2026, 01:14 PM"

  const outputVar = ctx.args[0]; // e.g. "currentDateTime"

  const now = new Date();

  // ── Date: MM/DD/YYYY ─────────────────────────────────────────────────────────────────────────
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const yyyy = String(now.getFullYear());

  // ── Time: 12-hour HH:MM AM/PM (always, regardless of system locale) ──────────────────────────
  const hours24  = now.getHours();   // 0–23
  const minutes  = now.getMinutes(); // 0–59
  const ampm     = hours24 >= 12 ? 'PM' : 'AM';
  const hours12  = hours24 % 12 || 12; // convert 0 → 12, 13 → 1, etc.
  const hh       = String(hours12).padStart(2, '0');
  const min      = String(minutes).padStart(2, '0');

  const formatted = `${mm}/${dd}/${yyyy}, ${hh}:${min} ${ampm}`;

  ctx.log(`[GetCurrentDateTimeAndStore] ${formatted} → $[${outputVar}]`);
  ctx.setVariable(outputVar, formatted);
}
