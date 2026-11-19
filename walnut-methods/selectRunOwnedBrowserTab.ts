import type { WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Select Run-Owned Browser Tab
 * description: Find the open tab for ${target_url}; for Temp-Mail, match this run's stored generated email
 * actionType: custom_select_run_owned_browser_tab
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function selectRunOwnedBrowserTab(ctx: WalnutWebContext) {
  const targetUrl = ctx.args[0]?.trim();
  const expectedEmail = String(ctx.getVariable('generated_email') ?? '').trim().toLowerCase();
  if (!targetUrl) throw new Error('A target URL is required to select a browser tab');

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL for browser-tab selection: ${targetUrl}`);
  }

  const pages = ctx.page.context().pages();
  const isTempMailTarget = target.hostname === 'temp-mail.io' || target.hostname.endsWith('.temp-mail.io');
  const matches: number[] = [];

  if (isTempMailTarget && !expectedEmail) {
    throw new Error('The Temp-Mail tab can only be selected when this run\'s generated email is available');
  }

  for (let index = 0; index < pages.length; index += 1) {
    const candidate = pages[index];
    let candidateUrl: URL;
    try {
      candidateUrl = new URL(candidate.url());
    } catch {
      continue;
    }

    if (isTempMailTarget) {
      if (candidateUrl.hostname !== target.hostname && !candidateUrl.hostname.endsWith(`.${target.hostname}`)) continue;
      const addressInput = candidate.locator('input[aria-label="Your temporary email"], input#email').first();
      if (await addressInput.count() === 0) continue;
      const actualEmail = (await addressInput.inputValue().catch(() => '')).trim().toLowerCase();
      if (actualEmail === expectedEmail) matches.push(index);
      continue;
    }

    if (candidateUrl.hostname !== target.hostname) continue;
    const formUrlMatch = /\/admin\/users\/add-new\/?$/.test(candidateUrl.pathname);
    const doctorFormVisible = await candidate.getByRole('button', { name: 'User Type*' }).isVisible().catch(() => false);
    if (formUrlMatch || doctorFormVisible) matches.push(index);
  }

  if (matches.length !== 1) {
    const targetName = isTempMailTarget ? `Temp-Mail inbox ${expectedEmail || '(email unavailable)'}` : `HHCS Doctor form for ${target.hostname}`;
    throw new Error(`Expected exactly one open tab for ${targetName}, found ${matches.length}; no tab was changed`);
  }

  const index = matches[0];
  ctx.setVariable(isTempMailTarget ? 'temp_mail_tab_index' : 'hhcs_tab_index', String(index));
  await ctx.switchToTab(index);
  ctx.log(`Matched ${isTempMailTarget ? 'the current-run Temp-Mail inbox' : 'the HHCS Doctor form'} tab at its live index ${index}`);
}
