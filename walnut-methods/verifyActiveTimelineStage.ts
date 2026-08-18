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

  // Step 3: Auto-detect the active stage from the UI.
  // Scan every SVG on the page; the red, visible ones are active location pins.
  // For each pin, walk up the DOM to the stage container (smallest ancestor that
  // wraps both the pin and some text content) and read its label — no XPath or
  // class-name assumptions needed; the status is fetched live from the UI.
  const uiState: { pinCount: number; activeStageNames: string[] } = await page.evaluate((activeRed: string) => {
    const pins = Array.from(document.querySelectorAll('svg')).filter((svg) => {
      const style = window.getComputedStyle(svg);
      const isRed = style.color === activeRed || style.fill === activeRed;
      const isVisible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0;
      return isRed && isVisible;
    });

    const activeStageNames = pins.map((pin) => {
      let container = pin.parentElement;
      // Walk up until the ancestor's full text is larger than the pin's own text
      // (pins have no text, so the first ancestor with text is the stage block)
      while (container && container.parentElement) {
        const text = (container.textContent || '').trim();
        if (text.length > 0) {
          // Keep climbing while the parent adds little new text — stay within the
          // stage block rather than the whole journey map
          const parentText = (container.parentElement.textContent || '').trim();
          if (parentText !== text) break;
        }
        container = container.parentElement;
      }
      return (container ? container.textContent || '' : '').trim();
    });

    return { pinCount: pins.length, activeStageNames };
  }, ACTIVE_RED);

  ctx.log(`UI reports ${uiState.pinCount} active pin(s): ${JSON.stringify(uiState.activeStageNames)}`);

  // Step 4: Strictly one active red pin across the entire journey map
  if (uiState.pinCount !== 1) {
    throw new Error(
      `Expected exactly 1 active red location pin across the journey map, but found ${uiState.pinCount}. ` +
      `Active stages detected: ${JSON.stringify(uiState.activeStageNames)}`
    );
  }

  // Step 5: The UI-derived active stage must contain the expected stage name
  const activeStageText = uiState.activeStageNames[0] || '';
  if (!activeStageText.includes(stageName)) {
    throw new Error(
      `Expected stage "${stageName}" to be active, but the UI shows "${activeStageText}" as the active stage.`
    );
  }

  // Step 6: Assert the expected stage's own container is fully visible (opacity-100),
  // confirming the label the pin sits next to is rendered at full opacity.
  const stageLabel = page.getByText(stageName, { exact: true }).first();
  if ((await stageLabel.count()) === 0) {
    throw new Error(`Timeline stage "${stageName}" was not found on the page.`);
  }
  const stageContainer = stageLabel.locator('xpath=./ancestor::*[contains(@class,"opacity-")][1]');
  await stageContainer.waitFor({ state: 'visible', timeout: 10000 });

  const containerClass = (await stageContainer.getAttribute('class')) || '';
  if (!/(^|\s)opacity-100(\s|$)/.test(containerClass)) {
    throw new Error(
      `Timeline stage "${stageName}" is not fully visible. ` +
      `Expected class "opacity-100" but container class is: "${containerClass}".`
    );
  }

  ctx.log(`Verified: "${stageName}" is the active stage (opacity-100, red pin, exactly 1 active pin on the map)`);
}
