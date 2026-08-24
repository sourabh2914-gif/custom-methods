import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Verify Large Location Pin Absent
 * description: Verify the large location pin symbol is not displayed on the Journey Map initially
 * actionType: custom_verify_large_location_pin_absent
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function verifyLargeLocationPinAbsent(ctx: WalnutContext) {
  ctx.log('Verifying the large location pin is NOT displayed on the Journey Map');

  // Step 1: Get the raw Playwright Page instance from the web context
  const page = (ctx as WalnutWebContext).page;

  // The expected red of the large active location pin (Tailwind red-500).
  // Small circular stage markers use other colors (teal, blue, green, pink,
  // purple, yellow) — none matches this exact red, so they are excluded.
  const ACTIVE_RED = 'rgb(239, 68, 68)';

  // The large location pin renders ~2x bigger than the small stage markers
  // (~40px+ vs ~20px). The size threshold guarantees that even if a small
  // stage marker were ever styled reddish, it can never be mistaken for the
  // large location symbol.
  const MIN_PIN_SIZE = 30;

  // Step 2: Scan every SVG on the page for a LARGE red visible pin
  const largePins: { cx: number; cy: number; width: number; height: number }[] =
    await page.evaluate(
      ({ activeRed, minSize }: { activeRed: string; minSize: number }) => {
        const found: { cx: number; cy: number; width: number; height: number }[] = [];
        const svgs = Array.from(document.querySelectorAll('svg'));
        for (const svg of svgs) {
          const style = window.getComputedStyle(svg);
          const rect = svg.getBoundingClientRect();

          const isRed = style.color === activeRed || style.fill === activeRed;
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0;
          const isLarge = rect.width >= minSize || rect.height >= minSize;

          if (isRed && isVisible && isLarge) {
            found.push({
              cx: rect.left + rect.width / 2,
              cy: rect.top + rect.height / 2,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
          }
        }
        return found;
      },
      { activeRed: ACTIVE_RED, minSize: MIN_PIN_SIZE }
    );

  // Step 3: Pass when no large pin is rendered; fail otherwise
  if (largePins.length === 0) {
    ctx.log(
      'No large red location pin found on the Journey Map — only the small ' +
        'journey-stage markers are displayed. Step passed.'
    );
    return;
  }

  const details = largePins
    .map((p) => `(x=${Math.round(p.cx)}, y=${Math.round(p.cy)}, ${p.width}x${p.height}px)`)
    .join(', ');
  throw new Error(
    `The large location pin IS displayed on the Journey Map on initial load — expected it to be absent. ` +
      `Found ${largePins.length} large red pin(s) at: ${details}`
  );
}
