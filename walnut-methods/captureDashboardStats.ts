import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Dashboard Stats
 * description: Capture admin dashboard stat card values and store in runtime variables $[Appointments confirmed], $[appointments booked], $[New Patient regestration today], $[Patients active], $[total patients], $[Active Doctors], $[Total doctors], $[Active Nurse Navigators], $[Total Nurse Navigators], $[Active Integrative Care Providers], $[Total Integrative Care Providers], $[Total Active Trials], $[Active Clinical Research Coordinators], $[Total Clinical Research Coordinators], $[Failed Logins]
 * actionType: custom_capture_dashboard_stats
 * context: web
 * needsLocator: false
 * category: Query
 */
export async function captureDashboardStats(ctx: WalnutContext) {
  // ctx.args layout (resolved from the $[...] placeholders in the description, in order):
  //   args[0]  = "Appointments confirmed"
  //   args[1]  = "appointments booked"
  //   args[2]  = "New Patient regestration today"
  //   args[3]  = "Patients active"
  //   args[4]  = "total patients"
  //   args[5]  = "Active Doctors"
  //   args[6]  = "Total doctors"
  //   args[7]  = "Active Nurse Navigators"
  //   args[8]  = "Total Nurse Navigators"
  //   args[9]  = "Active Integrative Care Providers"
  //   args[10] = "Total Integrative Care Providers"
  //   args[11] = "Total Active Trials"
  //   args[12] = "Active Clinical Research Coordinators"
  //   args[13] = "Total Clinical Research Coordinators"
  //   args[14] = "Failed Logins"
  //
  // Dashboard DOM (per card):
  //   <div class="bg-white rounded-xl border ... relative min-h-[110px]">
  //     <p class="text-[10px] font-semibold uppercase ...">Appointments</p>   ← card title
  //     <div class="mt-4 pl-1">
  //       <div class="flex items-baseline gap-1">
  //         <span class="text-[26px] font-bold text-gray-900 ...">124</span>  ← primary value
  //         <span class="text-gray-300 text-lg ...">/</span>
  //         <span class="text-xl font-bold text-gray-400">132</span>          ← secondary value (dual cards only)
  //       </div>
  //       <div class="flex items-center gap-1 mt-1">
  //         <span ...>Confirmed</span><span ...>·</span><span ...>Booked</span>
  //       </div>
  //     </div>
  //   </div>
  // Single-value cards (New Patients Today / Active Trials / Security Alerts)
  // have only the primary span plus a <p class="mt-1 text-xs ..."> label.

  const c = ctx as any;

  // Fixed fallback names (used only if the platform did not resolve the $[...] args)
  const FALLBACK_NAMES = [
    'Appointments confirmed',
    'appointments booked',
    'New Patient regestration today',
    'Patients active',
    'total patients',
    'Active Doctors',
    'Total doctors',
    'Active Nurse Navigators',
    'Total Nurse Navigators',
    'Active Integrative Care Providers',
    'Total Integrative Care Providers',
    'Total Active Trials',
    'Active Clinical Research Coordinators',
    'Total Clinical Research Coordinators',
    'Failed Logins',
  ];

  const varName = (idx: number): string => {
    const fromArgs = String(c.args?.[idx] ?? '').trim();
    return fromArgs || FALLBACK_NAMES[idx];
  };

  // title → [primaryVarIdx, secondaryVarIdx?] — indexes into ctx.args / FALLBACK_NAMES
  const CARD_MAP: Array<{ title: string; primary: number; secondary?: number }> = [
    { title: 'Appointments',                   primary: 0,  secondary: 1  },
    { title: 'New Patients Today',             primary: 2  },
    { title: 'Patients',                       primary: 3,  secondary: 4  },
    { title: 'Doctors',                        primary: 5,  secondary: 6  },
    { title: 'Nurse Navigators',               primary: 7,  secondary: 8  },
    { title: 'Integrative Care Providers',     primary: 9,  secondary: 10 },
    { title: 'Active Trials',                  primary: 11 },
    { title: 'Clinical Research Coordinators', primary: 12, secondary: 13 },
    { title: 'Security Alerts',                primary: 14 },
  ];

  // Wait for at least one card title to render before scraping
  try {
    await c.page.waitForSelector('p.uppercase', { state: 'visible', timeout: 10000 });
  } catch (_) { /* scrape anyway — the error below will list what was found */ }

  // ── Scrape all cards in a single browser pass ──────────────────────────────
  const scraped: Record<string, string> = await c.page.evaluate((titles: string[]) => {
    const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const out: Record<string, string> = {};

    // Card titles are the small uppercase labels (e.g. "APPOINTMENTS")
    const titleEls = Array.from(document.querySelectorAll('p'))
      .filter((p) => p.className.includes('uppercase') && p.className.includes('text-[10px]'));

    for (const titleEl of titleEls) {
      const titleText = norm(titleEl.textContent ?? '');
      if (!titles.some((t) => norm(t) === titleText)) continue;

      const card = titleEl.parentElement;
      if (!card) continue;

      // Primary value — large bold figure (text-[26px])
      const primaryEl = Array.from(card.querySelectorAll('span'))
        .find((s) => s.className.includes('text-[26px]'));
      // Secondary value — the figure after the "/" (text-xl font-bold text-gray-400)
      const secondaryEl = Array.from(card.querySelectorAll('span'))
        .find((s) => s.className.includes('text-xl') && s.className.includes('font-bold'));

      out[titleText] = [
        (primaryEl?.textContent ?? '').trim(),
        (secondaryEl?.textContent ?? '').trim(),
      ].join('|');
    }
    return out;
  }, CARD_MAP.map((m) => m.title));

  // ── Store each value into its runtime variable ────────────────────────────
  const missing: string[] = [];

  for (const entry of CARD_MAP) {
    const key = entry.title.replace(/\s+/g, ' ').trim().toLowerCase();
    const raw = scraped[key];

    if (raw === undefined) {
      missing.push(entry.title);
      continue;
    }

    const [primaryVal, secondaryVal] = raw.split('|');

    if (primaryVal === '') {
      missing.push(`${entry.title} (primary value)`);
    } else {
      const primaryVar = varName(entry.primary);
      ctx.setVariable(primaryVar, primaryVal);
      ctx.log(`[CaptureDashboardStats] ${entry.title} → $[${primaryVar}] = "${primaryVal}"`);
    }

    if (entry.secondary !== undefined) {
      if (secondaryVal === '') {
        missing.push(`${entry.title} (secondary value)`);
      } else {
        const secondaryVar = varName(entry.secondary);
        ctx.setVariable(secondaryVar, secondaryVal);
        ctx.log(`[CaptureDashboardStats] ${entry.title} → $[${secondaryVar}] = "${secondaryVal}"`);
      }
    }
  }

  if (missing.length > 0) {
    const found = Object.keys(scraped);
    throw new Error(
      `[CaptureDashboardStats] Could not capture: ${missing.join(', ')}. ` +
      `Card titles found on page: [${found.length > 0 ? found.join(', ') : '(none)'}]. ` +
      `Ensure the admin dashboard is loaded before this step runs.`
    );
  }
}
