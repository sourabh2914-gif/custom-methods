import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Get Next Week Day Date
 * description: Calculate the date of next ${dayName} and store in $[nextDayDate]
 * actionType: custom_get_next_week_day_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function getNextWeekDayDate(ctx: WalnutContext) {
  // ctx.args[0] = value of ${dayName}     — e.g. "Monday", "Wednesday", "Fri"
  // ctx.args[1] = value of $[nextDayDate] — runtime variable name to store the result

  const dayNameInput = String(ctx.args[0] ?? '').trim();
  const outputVar    = ctx.args[1]; // e.g. "nextDayDate"

  // ── Step 1: Resolve the target day index (0=Sun,1=Mon,...,6=Sat) ──
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  const targetDayIndex = dayMap[dayNameInput.toLowerCase()];
  if (targetDayIndex === undefined) {
    throw new Error(
      `[GetNextWeekDayDate] Invalid day name: "${dayNameInput}". ` +
      `Use a full name like "Monday", "Wednesday", or abbreviation like "Mon", "Wed".`
    );
  }

  // ── Step 2: Get today's date in Indian Standard Time (IST = UTC+5:30) ──
  // Use Intl to extract the current day/date in IST regardless of server timezone.
  const nowUtc = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
  });
  const parts = istFormatter.formatToParts(nowUtc);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  // Build a plain Date at midnight IST so getDay() is correct
  const istDateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const today      = new Date(istDateStr + 'T00:00:00'); // local midnight, but we only need getDay()
  const currentDay = today.getDay(); // 0=Sun … 6=Sat (in IST)

  ctx.log(`[GetNextWeekDayDate] IST today: ${istDateStr} (${get('weekday')})`);

  // ── Step 3: Calculate the NEXT occurrence of that day ──
  // Formula: ((targetDayIndex - currentDay + 7) % 7) || 7
  //   - If target is ahead or later this week: gives days until that day (1–6) ✓
  //   - If target is the same as today: % 7 = 0 → fallback to 7 (same day next week) ✓
  //   e.g. today=Tue(2), target=Mon(1) → (1-2+7)%7 = 6 → next Monday in 6 days ✓
  //        today=Tue(2), target=Wed(3) → (3-2+7)%7 = 1 → next Wednesday tomorrow ✓
  //        today=Tue(2), target=Tue(2) → (2-2+7)%7 = 0 → fallback 7 → same day next week ✓
  const daysToTarget = ((targetDayIndex - currentDay + 7) % 7) || 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToTarget);

  const dayNames   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const dd    = String(targetDate.getDate()).padStart(2, '0');
  const mm    = String(targetDate.getMonth() + 1).padStart(2, '0');
  const yyyy  = targetDate.getFullYear();
  const dateString = `${dd}/${mm}/${yyyy}`; // e.g. "16/06/2026"

  ctx.log(
    `[GetNextWeekDayDate] Requested: next ${dayNameInput}. ` +
    `Resolved to ${dayNames[targetDayIndex]} ${targetDate.getDate()} ${monthNames[targetDate.getMonth()]} ${yyyy} → ${dateString}`
  );

  ctx.setVariable(outputVar, dateString);
}
