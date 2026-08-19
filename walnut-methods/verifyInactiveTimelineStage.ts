import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Inactive Timeline Stage
 * description: Verify timeline stage ${stageName} is not the currently active stage
 * actionType: custom_verify_inactive_timeline_stage
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function verifyInactiveTimelineStage(ctx: WalnutContext) {
  // Step 1: Read the stage name argument (from ${stageName} in the description)
  const stageName = ctx.args[0];
  if (!stageName || stageName.trim() === '') {
    throw new Error('Stage name is empty. Provide a value for ${stageName} (e.g. "Joined", "Initial Consultation").');
  }
  ctx.log(`Verifying inactive timeline stage: "${stageName}"`);

  // Step 2: Get the raw Playwright Page instance from the web context
  const page = (ctx as WalnutWebContext).page;

  // Step 3: Confirm the stage exists on the page at all
  const stageLabel = page.getByText(stageName, { exact: true }).first();
  if ((await stageLabel.count()) === 0) {
    throw new Error(`Timeline stage "${stageName}" was not found on the page.`);
  }

  // Step 4: Auto-detect the currently active stage from the UI (red pin location).
  // No XPath/class assumptions — the active stage is wherever the red pin is rendered.
  const ACTIVE_RED = 'rgb(239, 68, 68)';
  const activeStageNames: string[] = await page.evaluate((activeRed: string) => {
    // Collapse ALL whitespace (incl. non-breaking/zero-width) — text from the
    // pin's SVG layers can differ only by invisible chars and defeat dedupe.
    const normalize = (s: string) => s.replace(/[\s\u00a0\u200b]+/g, ' ').trim();

    const redVisibleSvgs = Array.from(document.querySelectorAll('svg')).filter((svg) => {
      const style = window.getComputedStyle(svg);
      const rect = svg.getBoundingClientRect();
      const isRed = style.color === activeRed || style.fill === activeRed;
      const isVisible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        rect.width > 0 && rect.height > 0;
      return isRed && isVisible;
    });

    // Cluster by screen position: the layers of ONE visual pin are stacked at
    // the same coordinates, so each position cluster = one pin = one stage.
    const clusters: { cx: number; cy: number; text: string }[] = [];
    for (const svg of redVisibleSvgs) {
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (clusters.some((c) => Math.abs(c.cx - cx) < 8 && Math.abs(c.cy - cy) < 8)) continue;

      let container = svg.parentElement;
      while (container && container.parentElement) {
        const text = normalize(container.textContent || '');
        if (text.length > 0) {
          const parentText = normalize(container.parentElement.textContent || '');
          if (parentText !== text) break;
        }
        container = container.parentElement;
      }
      clusters.push({ cx, cy, text: normalize(container ? container.textContent || '' : '') });
    }

    return clusters.map((c) => c.text);
  }, ACTIVE_RED);

  ctx.log(`UI reports active stage(s): ${JSON.stringify(activeStageNames)}`);

  // Step 5: The expected stage must NOT be among the UI-detected active stages
  const isActive = activeStageNames.some((text) => text.includes(stageName));
  if (isActive) {
    throw new Error(
      `Timeline stage "${stageName}" is already active before selection. ` +
      `UI shows it carrying the red location pin: ${JSON.stringify(activeStageNames)}`
    );
  }

  ctx.log(`Stage "${stageName}" is inactive as expected (active stage: ${JSON.stringify(activeStageNames)})`);
}
