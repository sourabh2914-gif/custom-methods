import type { WalnutContext } from './walnut';
import { AppointmentAvailabilityHelper } from './AppointmentAvailabilityHelper';

/** @walnut_method
 * name: Find Next Available Appointment
 * description: Find the next available appointment slot for ${preferredSession} session on ${preferredDay} days, skipping ${skipDays}, and store date in $[selectedDate], day in $[selectedDay], slot in $[selectedSlot], start time in $[startTime], end time in $[endTime]
 * actionType: custom_find_next_available_appointment
 * context: web
 * needsLocator: false
 * category: Appointment Booking
 */
export async function findNextAvailableAppointment(ctx: WalnutContext) {
  // ctx.args[0] = preferredSession value  (from ${preferredSession})  e.g. "Morning" | ""
  // ctx.args[1] = preferredDay value      (from ${preferredDay})       e.g. "Monday,Tuesday" | ""
  // ctx.args[2] = skipDays value          (from ${skipDays})           e.g. "Saturday,Sunday" | ""
  // ctx.args[3] = "selectedDate"          (from $[selectedDate])
  // ctx.args[4] = "selectedDay"           (from $[selectedDay])
  // ctx.args[5] = "selectedSlot"          (from $[selectedSlot])
  // ctx.args[6] = "startTime"             (from $[startTime])
  // ctx.args[7] = "endTime"               (from $[endTime])

  const rawSession  = (ctx.args[0] ?? '').trim();
  const rawPreferred = (ctx.args[1] ?? '').trim();
  const rawSkip      = (ctx.args[2] ?? '').trim();

  // Parse session
  type Session = 'Morning' | 'Afternoon' | 'Evening';
  const SESSIONS: Session[] = ['Morning', 'Afternoon', 'Evening'];
  const preferredSession = SESSIONS.find(
    s => s.toLowerCase() === rawSession.toLowerCase()
  );

  // Parse comma-separated day lists
  const parseList = (raw: string): string[] =>
    raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const preferredDay = parseList(rawPreferred);
  const skipDays     = parseList(rawSkip);

  ctx.log(`findNextAvailableAppointment — options:`);
  ctx.log(`  preferredSession : ${preferredSession ?? '(any)'}`);
  ctx.log(`  preferredDay     : ${preferredDay.length ? preferredDay.join(', ') : '(any)'}`);
  ctx.log(`  skipDays         : ${skipDays.length ? skipDays.join(', ') : '(none)'}`);

  const helper = new AppointmentAvailabilityHelper(ctx);

  const result = await helper.findNextAvailableAppointment({
    preferredSession,
    preferredDay: preferredDay.length ? preferredDay : undefined,
    skipDays:     skipDays.length     ? skipDays     : undefined,
  });

  // Store all captured values as runtime variables
  ctx.setVariable(ctx.args[3], result.selectedDate);
  ctx.setVariable(ctx.args[4], result.selectedDay);
  ctx.setVariable(ctx.args[5], result.selectedSlot);
  ctx.setVariable(ctx.args[6], result.startTime);
  ctx.setVariable(ctx.args[7], result.endTime);

  ctx.log(`Appointment booked:`);
  ctx.log(`  Date  : ${result.selectedDate} (${result.selectedDay})`);
  ctx.log(`  Slot  : ${result.selectedSlot}`);
  ctx.log(`  Start : ${result.startTime}`);
  ctx.log(`  End   : ${result.endTime}`);
}
