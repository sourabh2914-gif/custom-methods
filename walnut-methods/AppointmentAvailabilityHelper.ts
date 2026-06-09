import type { WalnutContext } from './walnut';
import type { Locator, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Result returned by findNextAvailableAppointment() */
export interface AppointmentResult {
  /** Full date string, e.g. "09-Jun-2026" */
  selectedDate: string;
  /** Day name, e.g. "Monday" */
  selectedDay: string;
  /** Full slot text, e.g. "10:30 AM - 11:00 AM" */
  selectedSlot: string;
  /** Start time extracted from slot, e.g. "10:30 AM" */
  startTime: string;
  /** End time extracted from slot, e.g. "11:00 AM" */
  endTime: string;
}

/** Optional filter options for findNextAvailableAppointment() */
export interface AppointmentFilterOptions {
  /**
   * Restrict search to a specific time-of-day session.
   * Matches slots by hour:
   *   Morning   = 06:00–11:59
   *   Afternoon = 12:00–16:59
   *   Evening   = 17:00–23:59
   */
  preferredSession?: 'Morning' | 'Afternoon' | 'Evening';

  /**
   * Only consider dates that fall on one of these day names.
   * e.g. ['Monday', 'Tuesday']
   */
  preferredDay?: string[];

  /**
   * Day names to unconditionally skip.
   * e.g. ['Saturday', 'Sunday']
   */
  skipDays?: string[];

  /**
   * Maximum number of calendar dates to inspect before giving up.
   * Defaults to 60 (roughly 2 months forward).
   */
  maxDaysSearch?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selectors — adjust these to match your application's DOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All calendar date cell elements (enabled + disabled).
 * Typically a <td> or <button> inside the calendar grid.
 */
const SEL_DATE_CELL = '[data-testid="calendar-date"], .calendar-day, td.day, button.day-cell';

/**
 * The calendar container element used to wait for render.
 */
const SEL_CALENDAR = '[data-testid="calendar"], .calendar, .date-picker, .appointment-calendar';

/**
 * The "next month" navigation arrow/button.
 */
const SEL_NEXT_MONTH = '[data-testid="next-month"], button[aria-label*="next month" i], .next-month, .calendar-nav-next';

/**
 * Current month/year heading displayed in the calendar header.
 */
const SEL_MONTH_HEADING = '[data-testid="calendar-month"], .calendar-header-month, .month-year-label';

/**
 * Container that holds the time-slot buttons after a date is selected.
 */
const SEL_SLOT_CONTAINER = '[data-testid="slot-container"], .time-slots, .slot-list, .available-slots';

/**
 * All time-slot buttons (both available and unavailable).
 */
const SEL_ALL_SLOTS = `${SEL_SLOT_CONTAINER} button`;

// ─────────────────────────────────────────────────────────────────────────────
// AppointmentAvailabilityHelper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reusable utility class that dynamically finds the next available
 * appointment date + time slot in a doctor-booking calendar.
 *
 * ### Usage (inside a Walnut custom method)
 * ```ts
 * const helper = new AppointmentAvailabilityHelper(ctx);
 * const result = await helper.findNextAvailableAppointment({
 *   preferredSession: 'Morning',
 *   skipDays: ['Saturday', 'Sunday'],
 * });
 * ctx.log(`Booked: ${result.selectedDate} at ${result.selectedSlot}`);
 * ```
 *
 * ### Page Object usage (pass a Playwright Page directly)
 * ```ts
 * const helper = new AppointmentAvailabilityHelper(page);
 * ```
 */
export class AppointmentAvailabilityHelper {
  private readonly page: Page;
  private readonly logger: (msg: string) => void;

  /**
   * @param ctxOrPage  Either a WalnutContext (web) or a raw Playwright Page.
   */
  constructor(ctxOrPage: WalnutContext | Page) {
    // Support both WalnutContext and bare Playwright Page
    if ('page' in ctxOrPage && typeof (ctxOrPage as any).page?.goto === 'function') {
      // WalnutWebContext
      this.page = (ctxOrPage as any).page as Page;
      this.logger = (msg: string) => (ctxOrPage as any).log?.(msg) ?? console.log(msg);
    } else if (typeof (ctxOrPage as any).goto === 'function') {
      // Raw Playwright Page
      this.page = ctxOrPage as unknown as Page;
      this.logger = (msg: string) => console.log(`[AppointmentHelper] ${msg}`);
    } else {
      throw new Error(
        'AppointmentAvailabilityHelper: constructor argument must be a WalnutWebContext or Playwright Page.'
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scans the calendar starting from the currently visible month and returns
   * the first date + slot that satisfies the supplied filter options.
   *
   * @param options   Optional filters (session, preferred days, skip days, max search window).
   * @returns         AppointmentResult with all date/slot details captured.
   *
   * @throws          Error if no available appointment is found within the search window.
   *
   * @example
   * // Morning only
   * await helper.findNextAvailableAppointment({ preferredSession: 'Morning' });
   *
   * @example
   * // Weekdays only, max 30 days
   * await helper.findNextAvailableAppointment({
   *   skipDays: ['Saturday', 'Sunday'],
   *   maxDaysSearch: 30,
   * });
   */
  async findNextAvailableAppointment(
    options: AppointmentFilterOptions = {}
  ): Promise<AppointmentResult> {
    const {
      preferredSession,
      preferredDay,
      skipDays,
      maxDaysSearch = 60,
    } = options;

    let datesChecked = 0;
    let monthsNavigated = 0;
    const checkedMonths: string[] = [];

    this.logger('Starting appointment search…');

    while (datesChecked < maxDaysSearch) {
      // ── Capture current month label for error reporting ──────────────────
      const monthLabel = await this.safeGetText(SEL_MONTH_HEADING);
      if (monthLabel && !checkedMonths.includes(monthLabel)) {
        checkedMonths.push(monthLabel);
      }

      // ── Collect all date cells visible in this calendar month ────────────
      const dates = await this.getAvailableDates();
      this.logger(`Month "${monthLabel}": ${dates.length} date cell(s) found`);

      for (const dateLocator of dates) {
        if (datesChecked >= maxDaysSearch) break;

        // ── Step 1: Validate selectability ──────────────────────────────────
        const selectable = await this.isDateSelectable(dateLocator);
        if (!selectable) continue;

        // ── Extract day name for day-of-week filtering ──────────────────────
        const dayName = await this.extractDayName(dateLocator);

        // Filter: skipDays
        if (skipDays?.length && skipDays.includes(dayName)) {
          this.logger(`  Skipping "${dayName}" (in skipDays list)`);
          continue;
        }

        // Filter: preferredDay
        if (preferredDay?.length && !preferredDay.includes(dayName)) {
          this.logger(`  Skipping "${dayName}" (not in preferredDay list)`);
          continue;
        }

        const dateLabel = await this.extractSelectedDate(dateLocator);
        this.logger(`Checking Date: ${dateLabel} (${dayName})`);
        datesChecked++;

        // ── Step 2: Click date and wait for slot panel ───────────────────────
        await this.selectDate(dateLocator);

        // ── Step 3: Retrieve available slots ────────────────────────────────
        const availableSlots = await this.getAvailableSlots(preferredSession);
        this.logger(`  Slots Found: ${availableSlots.length}`);

        if (availableSlots.length === 0) {
          this.logger('  No available slots on this date — continuing…');
          continue;
        }

        // ── Step 4: Select the first available slot ──────────────────────────
        const slot = availableSlots[0];
        const slotText = await this.extractSlotTimes(slot);

        this.logger(`  Selected Slot: ${slotText.selectedSlot}`);
        await this.selectSlot(slot);

        const finalDate = await this.extractSelectedDate(dateLocator);
        this.logger(`Appointment Date Selected: ${finalDate}`);

        return {
          selectedDate: finalDate,
          selectedDay: dayName,
          selectedSlot: slotText.selectedSlot,
          startTime: slotText.startTime,
          endTime: slotText.endTime,
        };

        // ── Step 5: No slots → implicit continue to next date ───────────────
      }

      // ── Step 6: Month exhausted → go to next month ───────────────────────
      this.logger(`Month "${monthLabel}" exhausted — navigating to next month`);
      await this.navigateToNextMonth();
      monthsNavigated++;
    }

    // ── Error: search limit reached ──────────────────────────────────────────
    throw new Error(
      `No available appointment slots found within search range.\n` +
      `  Dates searched : ${datesChecked}\n` +
      `  Months checked : ${checkedMonths.join(', ') || 'unknown'}\n` +
      `  Max days limit : ${maxDaysSearch}`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Date Discovery
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns all date cell Locators visible in the current calendar view.
   * Does NOT filter by availability — raw list including disabled cells.
   */
  async getAvailableDates(): Promise<Locator[]> {
    await this.safeValidate(SEL_CALENDAR, 'Calendar container');
    const allCells = this.page.locator(SEL_DATE_CELL);
    const count = await allCells.count();
    const locators: Locator[] = [];
    for (let i = 0; i < count; i++) {
      locators.push(allCells.nth(i));
    }
    return locators;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Date State Validation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Determines whether a calendar date cell can be selected.
   *
   * A date is considered NOT selectable when it:
   * - has `disabled` attribute
   * - has `aria-disabled="true"`
   * - has class names: disabled | past | inactive | hidden | week-off
   * - has CSS `pointer-events: none`
   * - has CSS `opacity < 0.5` (visually greyed out)
   * - is not visible in the viewport
   *
   * @param dateLocator   Locator for the calendar date cell.
   */
  async isDateSelectable(dateLocator: Locator): Promise<boolean> {
    try {
      // Must be attached and visible first
      const isVisible = await dateLocator.isVisible();
      if (!isVisible) return false;

      const handle = await dateLocator.elementHandle();
      if (!handle) return false;

      const result = await this.page.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;

        // 1. disabled attribute
        if (htmlEl.hasAttribute('disabled')) return false;

        // 2. aria-disabled
        if (htmlEl.getAttribute('aria-disabled') === 'true') return false;

        // 3. Disqualifying CSS class names
        const cls = (htmlEl.className || '').toLowerCase();
        const disqualifyingClasses = [
          'disabled', 'past', 'inactive', 'hidden',
          'week-off', 'weekoff', 'unavailable', 'grayed', 'greyed',
          'cursor-not-allowed', 'pointer-events-none',
        ];
        if (disqualifyingClasses.some(c => cls.includes(c))) return false;

        // 4. Computed style checks
        const style = window.getComputedStyle(htmlEl);
        if (style.pointerEvents === 'none') return false;
        if (parseFloat(style.opacity) < 0.5) return false;

        return true;
      }, handle);

      return result;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Date Selection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scrolls to, validates, and clicks a calendar date cell.
   * Waits for the slot container to appear after the click.
   *
   * @param dateLocator   Locator for the calendar date cell.
   */
  async selectDate(dateLocator: Locator): Promise<void> {
    await this.safeScroll(dateLocator);
    await this.safeValidate(dateLocator, 'Date cell');
    await this.safeClick(dateLocator);

    // Wait for the slot panel to appear (or update) after the date click
    await this.page
      .locator(SEL_SLOT_CONTAINER)
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {
        // Slot container may already be visible — not a hard failure
        this.logger('  Slot container did not appear after date click — continuing');
      });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Slot Discovery
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves all time-slot Locators that are currently available
   * (i.e. not disabled by any mechanism).
   *
   * @param preferredSession   Optional session filter ('Morning' | 'Afternoon' | 'Evening').
   * @returns                  Array of available slot Locators in DOM order.
   */
  async getAvailableSlots(
    preferredSession?: 'Morning' | 'Afternoon' | 'Evening'
  ): Promise<Locator[]> {
    const allSlots = this.page.locator(SEL_ALL_SLOTS);
    const count = await allSlots.count();
    const available: Locator[] = [];

    for (let i = 0; i < count; i++) {
      const slot = allSlots.nth(i);

      const slotOk = await this.isSlotAvailable(slot);
      if (!slotOk) continue;

      if (preferredSession) {
        const slotText = (await slot.textContent() ?? '').trim();
        if (!this.slotMatchesSession(slotText, preferredSession)) continue;
      }

      available.push(slot);
    }

    return available;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Slot State Validation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the given slot button is available for booking.
   *
   * Detects ALL common disabled patterns:
   * - `disabled` attribute
   * - `aria-disabled="true"`
   * - class: disabled | booked | unavailable | cursor-not-allowed
   * - CSS `pointer-events: none`
   * - CSS `opacity < 0.5`
   *
   * @param slot   Locator for a single time-slot button.
   */
  async isSlotAvailable(slot: Locator): Promise<boolean> {
    try {
      const isVisible = await slot.isVisible();
      if (!isVisible) return false;

      const handle = await slot.elementHandle();
      if (!handle) return false;

      const result = await this.page.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;

        // 1. HTML disabled attribute
        if ((htmlEl as HTMLButtonElement).disabled) return false;
        if (htmlEl.hasAttribute('disabled')) return false;

        // 2. ARIA disabled
        if (htmlEl.getAttribute('aria-disabled') === 'true') return false;

        // 3. Class-based disabled patterns
        const cls = (htmlEl.className || '').toLowerCase();
        const disqualifyingClasses = [
          'disabled', 'booked', 'unavailable',
          'cursor-not-allowed', 'not-allowed', 'opacity-50', 'opacity-30',
          'pointer-events-none', 'slot-booked', 'slot-disabled',
        ];
        if (disqualifyingClasses.some(c => cls.includes(c))) return false;

        // 4. Computed style
        const style = window.getComputedStyle(htmlEl);
        if (style.pointerEvents === 'none') return false;
        if (parseFloat(style.opacity) < 0.5) return false;

        // 5. Slot must have non-empty text (avoids ghost elements)
        if (!(htmlEl.textContent ?? '').trim()) return false;

        return true;
      }, handle);

      return result;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Slot Selection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scrolls to, validates, and clicks a time-slot button.
   *
   * @param slot   Locator for the time-slot button.
   */
  async selectSlot(slot: Locator): Promise<void> {
    await this.safeScroll(slot);
    await this.safeValidate(slot, 'Time slot button');
    await this.safeClick(slot);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Month Navigation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Clicks the "next month" navigation arrow and waits for the calendar
   * to re-render with the new month's dates.
   */
  async navigateToNextMonth(): Promise<void> {
    const nextBtn = this.page.locator(SEL_NEXT_MONTH);
    await this.safeScroll(nextBtn);
    await this.safeValidate(nextBtn, 'Next month button');
    await this.safeClick(nextBtn);

    // Wait for calendar grid to update (stale date cells detach, new ones attach)
    await this.page.locator(SEL_DATE_CELL).first().waitFor({ state: 'attached', timeout: 8_000 });
    this.logger('Navigated to next month');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Data Extraction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Parses a slot button's text into startTime, endTime, and a combined
   * selectedSlot string.
   *
   * Handles separator variants: "–", "-", "to", "~"
   * e.g. "10:30 AM - 11:00 AM" → { startTime: "10:30 AM", endTime: "11:00 AM", selectedSlot: "10:30 AM - 11:00 AM" }
   *
   * @param slot   Locator for the time-slot button.
   */
  async extractSlotTimes(
    slot: Locator
  ): Promise<{ selectedSlot: string; startTime: string; endTime: string }> {
    const raw = (await slot.textContent() ?? '').trim();

    // Normalise various separator characters to a single dash
    const normalised = raw.replace(/\s*[–—~]\s*/g, ' - ').replace(/\s+to\s+/gi, ' - ');

    // Split on the first occurrence of " - "
    const separatorIdx = normalised.indexOf(' - ');
    if (separatorIdx === -1) {
      // Cannot parse — return the whole string as both times
      return { selectedSlot: normalised, startTime: normalised, endTime: normalised };
    }

    const startTime = normalised.slice(0, separatorIdx).trim();
    const endTime = normalised.slice(separatorIdx + 3).trim();

    return {
      selectedSlot: `${startTime} - ${endTime}`,
      startTime,
      endTime,
    };
  }

  /**
   * Reads the date label from a calendar date cell.
   *
   * Checks (in order):
   *   1. `data-date` attribute  — e.g. "2026-06-09"
   *   2. `aria-label` attribute — e.g. "June 9, 2026"
   *   3. `title` attribute
   *   4. Visible text content   — e.g. "9"
   *
   * Returns a formatted string like "09-Jun-2026" when a full date is found,
   * or the raw text when only the day number is available.
   *
   * @param dateLocator   Locator for the calendar date cell.
   */
  async extractSelectedDate(dateLocator: Locator): Promise<string> {
    const handle = await dateLocator.elementHandle();
    if (!handle) return 'unknown';

    const raw: string = await this.page.evaluate((el: Element) => {
      const htmlEl = el as HTMLElement;
      return (
        htmlEl.getAttribute('data-date') ||
        htmlEl.getAttribute('aria-label') ||
        htmlEl.getAttribute('title') ||
        (htmlEl.textContent ?? '').trim()
      );
    }, handle);

    if (!raw) return 'unknown';

    // Try to parse ISO date string (YYYY-MM-DD)
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
      return this.formatDate(d);
    }

    // Try natural language date (e.g. "June 9, 2026" or "9 June 2026")
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return this.formatDate(parsed);
    }

    return raw; // Fallback: return whatever text the element had
  }

  /**
   * Derives the day-of-week name ("Monday", "Tuesday" …) from a calendar
   * date cell.
   *
   * Checks (in order):
   *   1. `data-day` attribute         — e.g. "Monday"
   *   2. `data-date` / `aria-label`   — parsed as a full date
   *   3. DOM position inside a <tr>   — column index maps to weekday
   *
   * @param dateLocator   Locator for the calendar date cell.
   */
  async extractDayName(dateLocator: Locator): Promise<string> {
    const handle = await dateLocator.elementHandle();
    if (!handle) return 'Unknown';

    const result: string = await this.page.evaluate((el: Element) => {
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const htmlEl = el as HTMLElement;

      // 1. Explicit data-day attribute
      const dataDay = htmlEl.getAttribute('data-day');
      if (dataDay) return dataDay;

      // 2. Parse from data-date or aria-label
      const rawDate =
        htmlEl.getAttribute('data-date') ||
        htmlEl.getAttribute('aria-label') ||
        htmlEl.getAttribute('title') ||
        '';
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          return DAY_NAMES[parsed.getDay()];
        }
      }

      // 3. Derive from column position inside a table row
      const td = el.closest('td');
      if (td) {
        const row = td.parentElement;
        if (row) {
          const cells = Array.from(row.children);
          const col = cells.indexOf(td);
          if (col >= 0 && col < 7) return DAY_NAMES[col];
        }
      }

      return 'Unknown';
    }, handle);

    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Safe Wrappers — Playwright best-practice helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Scroll a locator (or CSS selector string) into the viewport.
   * Never throws — logs a warning on failure.
   */
  async safeScroll(target: Locator | string): Promise<void> {
    try {
      const locator = typeof target === 'string' ? this.page.locator(target) : target;
      await locator.scrollIntoViewIfNeeded({ timeout: 5_000 });
    } catch {
      this.logger('  [warn] safeScroll: could not scroll element into view');
    }
  }

  /**
   * Asserts that a locator (or CSS selector) is visible AND enabled.
   * Uses Playwright's `expect` so failures are retried automatically.
   *
   * @param target   Locator or CSS selector.
   * @param label    Human-readable name used in the assertion message.
   */
  async safeValidate(target: Locator | string, label: string): Promise<void> {
    const { expect } = await import('@playwright/test');
    const locator = typeof target === 'string' ? this.page.locator(target) : target;
    await expect(locator.first(), `${label} should be visible`).toBeVisible({ timeout: 8_000 });
    await expect(locator.first(), `${label} should be enabled`).toBeEnabled({ timeout: 8_000 });
  }

  /**
   * Scrolls, validates, then clicks a locator (or CSS selector).
   *
   * @param target   Locator or CSS selector.
   */
  async safeClick(target: Locator | string): Promise<void> {
    const locator = typeof target === 'string' ? this.page.locator(target).first() : target;
    await this.safeScroll(locator);
    await locator.click();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Utilities
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attempts to read text from a CSS selector; returns empty string on failure.
   */
  private async safeGetText(selector: string): Promise<string> {
    try {
      const el = this.page.locator(selector).first();
      const visible = await el.isVisible();
      if (!visible) return '';
      return (await el.textContent() ?? '').trim();
    } catch {
      return '';
    }
  }

  /**
   * Formats a Date object as "DD-Mon-YYYY", e.g. "09-Jun-2026".
   */
  private formatDate(d: Date): string {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = MONTHS[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd}-${mon}-${yyyy}`;
  }

  /**
   * Returns true when a slot's text falls within the requested session window.
   *
   * Morning   = 06:00–11:59
   * Afternoon = 12:00–16:59
   * Evening   = 17:00–23:59
   *
   * @param slotText         Raw button text, e.g. "10:30 AM - 11:00 AM".
   * @param session          Target session name.
   */
  private slotMatchesSession(
    slotText: string,
    session: 'Morning' | 'Afternoon' | 'Evening'
  ): boolean {
    // Parse the start-time hour from the slot text
    const timeMatch = slotText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) return true; // Cannot determine — include it

    let hour = parseInt(timeMatch[1], 10);
    const meridiem = timeMatch[3].toUpperCase();

    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    switch (session) {
      case 'Morning':   return hour >= 6  && hour < 12;
      case 'Afternoon': return hour >= 12 && hour < 17;
      case 'Evening':   return hour >= 17 && hour < 24;
    }
  }
}
