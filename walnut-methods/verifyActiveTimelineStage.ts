import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Active Timeline Stage
 * description: Verify timeline stage ${stageName} is the active stage with the red location pin
 * actionType: custom_verify_active_timeline_stage
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function verifyActiveTimelineStage(ctx: WalnutContext) {
  // Step 1: Read the stage name argument (from ${stageName} in the description)
  const stageName = ctx.args[0];
  if (!stageName || stageName.trim() === '') {
    throw new Error('Stage name is empty. Provide a value for ${stageName} (e.g. "Joined", "Initial Consultation").');
  }
  ctx.log(`Verifying active timeline stage: "${stageName}"`);

  // Step 2: Get the raw Playwright Page instance from the web context
  const page = (ctx as WalnutWebContext).page;

  // The expected red of the active location pin (Tailwind red-500)
  const ACTIVE_RED = 'rgb(239, 68, 68)';

  // Step 3: Find the red location symbol on the journey map and get its screen
  // position. The pin sits on the timeline track, vertically level with the
  // active stage card. If the pin renders as stacked SVG layers, they share
  // the same position — taking the first is enough.
  const pin = await page.evaluate((activeRed: string) => {
    const svgs = Array.from(document.querySelectorAll('svg'));
    for (const svg of svgs) {
      const style = window.getComputedStyle(svg);
      const rect = svg.getBoundingClientRect();
      const isRed = style.color === activeRed || style.fill === activeRed;
      const isVisible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        rect.width > 0 && rect.height > 0;
      if (isRed && isVisible) {
        return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, ACTIVE_RED);

  if (!pin) {
    throw new Error(
      `No red location pin (${ACTIVE_RED}) is visible on the journey map — no stage is currently marked active.`
    );
  }
  ctx.log(`Red location pin found at (x=${Math.round(pin.cx)}, y=${Math.round(pin.cy)})`);

  // Step 4: The stage name appears multiple times in the DOM — find the copy
  // that is vertically level with the pin (that copy belongs to the card the
  // pin points at). Stages are spaced ~85px apart; 60px threshold safely binds
  // the pin to its own stage without matching neighbours.
  const stageSpans = page.locator(`xpath=//span[normalize-space(text())=${xpathLiteral(stageName)}]`);
  const spanCount = await stageSpans.count();
  ctx.log(`Found ${spanCount} span(s) for stage name "${stageName}"`);

  if (spanCount === 0) {
    throw new Error(`Timeline stage "${stageName}" was not found on the page.`);
  }

  let bestSpan = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < spanCount; i++) {
    const candidate = stageSpans.nth(i);
    const box = await candidate.boundingBox();
    if (!box) continue; // hidden copy — no screen box
    const cy = box.y + box.height / 2;
    const distance = Math.abs(cy - pin.cy);
    ctx.log(`Span [${i}]: center y=${Math.round(cy)}, distance to pin=${Math.round(distance)}px`);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSpan = candidate;
    }
  }

  if (!bestSpan) {
    throw new Error(
      `Timeline stage "${stageName}" matched ${spanCount} span(s) in the DOM, but none is visible in the UI.`
    );
  }

  if (bestDistance > 60) {
    throw new Error(
      `The red location pin is NOT next to stage "${stageName}" — its nearest visible copy is ` +
      `${Math.round(bestDistance)}px away vertically. Another stage is currently active.`
    );
  }

  // Step 5: Assert the matched stage block is fully opaque (active = opacity-100).
  // Inactive stages render dimmed, as seen on the journey map.
  const stageBlock = bestSpan.locator('xpath=./ancestor::*[contains(@class,"opacity-")][1]');
  const blockClass = (await stageBlock.getAttribute('class')) || '';
  if (!/(^|\s)opacity-100(\s|$)/.test(blockClass)) {
    throw new Error(
      `Timeline stage "${stageName}" is next to the red pin but its block is not fully visible. ` +
      `Expected class "opacity-100" but block class is: "${blockClass}".`
    );
  }

  ctx.log(`Verified: "${stageName}" is the active stage — red pin adjacent (${Math.round(bestDistance)}px), block at opacity-100`);
}

// Escape a string for use inside an XPath string literal
function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  // Contains both quote types — build concat('a', "'", 'b', ...)
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(`, "'", `)})`;
}
