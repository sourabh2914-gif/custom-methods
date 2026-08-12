import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Close Symptom Check Reminder
 * description: Close the Symptom Check Reminder popup if it appears on the page
 * actionType: custom_close_symptom_check_reminder
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function closeSymptomCheckReminder(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const titleSelector = 'text="Symptom Check Reminder"';

  // The reminder appears conditionally — poll briefly and skip silently if absent
  let appeared = false;
  for (let i = 0; i < 10; i++) {
    if (await ctx.isVisible(titleSelector)) {
      appeared = true;
      break;
    }
    await ctx.wait(500);
  }

  if (!appeared) {
    ctx.log('Symptom Check Reminder did not appear — nothing to close.');
    return;
  }

  ctx.log('Symptom Check Reminder detected — closing it...');

  // Locate the popup container via its title, then click the icon-only close
  // button nearest the container's top-right corner (the "X").
  const clicked = await ctx.page.evaluate(() => {
    const TITLE = 'Symptom Check Reminder';
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    const titleEl = all.find(
      (el) => el.children.length === 0 && (el.textContent || '').trim() === TITLE
    );
    if (!titleEl) return false;

    // Walk up to the popup container — an ancestor that also holds the UPDATE NOW action
    let container: HTMLElement | null = titleEl;
    while (container) {
      const hasUpdateNow = Array.from(
        container.querySelectorAll('button, a, [role="button"]')
      ).some((b) => (b.textContent || '').trim().toUpperCase() === 'UPDATE NOW');
      if (hasUpdateNow) break;
      container = container.parentElement;
    }
    if (!container) return false;

    const cRect = container.getBoundingClientRect();

    // Close-button candidates: interactive/icon elements with no visible text
    const candidates = Array.from(
      container.querySelectorAll('button, [role="button"], [aria-label], svg')
    ) as HTMLElement[];

    const resolveClickTarget = (el: HTMLElement): HTMLElement =>
      el.tagName.toLowerCase() === 'svg'
        ? ((el.closest('button, [role="button"], span, a') as HTMLElement) || el)
        : el;

    const iconOnly = candidates.filter((el) => {
      const target = resolveClickTarget(el);
      const text = (target.textContent || '').trim();
      const label = (target.getAttribute('aria-label') || '').toLowerCase();
      return text === '' || label.includes('close');
    });
    if (iconOnly.length === 0) return false;

    // Pick the candidate closest to the container's top-right corner
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of iconOnly) {
      const target = resolveClickTarget(el);
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const score = Math.hypot(
        cRect.right - (r.left + r.width / 2),
        r.top + r.height / 2 - cRect.top
      );
      if (score < bestScore) {
        bestScore = score;
        best = target;
      }
    }
    if (!best) return false;
    best.click();
    return true;
  });

  if (!clicked) {
    ctx.warn('Close button not found via DOM scan — falling back to Escape key...');
    await ctx.pressKey('Escape');
  }

  await ctx.wait(500);

  // Verify the popup is gone; retry with Escape once, then fail
  if (await ctx.isVisible(titleSelector)) {
    ctx.warn('Reminder still visible — retrying with Escape key...');
    await ctx.pressKey('Escape');
    await ctx.wait(500);
    if (await ctx.isVisible(titleSelector)) {
      throw new Error('Symptom Check Reminder is still visible after close attempts');
    }
  }

  ctx.log('Symptom Check Reminder closed successfully.');
}
