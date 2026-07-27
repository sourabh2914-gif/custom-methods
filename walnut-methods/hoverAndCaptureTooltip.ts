import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Hover And Capture Tooltip
 * description: Hover on ${selector} and capture tooltip value and store in $[tooltipValue]
 * actionType: custom_hover_and_capture_tooltip
 * context: web
 * needsLocator: false
 * category: Query
 */
export async function hoverAndCaptureTooltip(ctx: WalnutContext) {
  // ctx.args[0] = value of ${selector}      — CSS/XPath selector of the element to hover on (e.g. chart bar)
  // ctx.args[1] = "tooltipValue" (from $[tooltipValue]) — runtime variable name to store the captured text

  const selector      = String(ctx.args[0]);
  const outputVar     = String(ctx.args[1]);
  const c             = ctx as any;

  ctx.log(`[HoverAndCaptureTooltip] Hovering on: "${selector}"`);

  // 1. Scroll element into view and move the mouse over it
  await ctx.hover(selector);

  // 2. Hold the cursor in place for 3.5 s — enough for chart tooltips to fully render
  await ctx.wait(3500);

  // 3. Attempt to read the tooltip text using a multi-strategy DOM scan.
  //    Tooltip libraries vary widely — we try common patterns in priority order:
  //      a) role="tooltip"
  //      b) [class*="tooltip"] / [class*="Tooltip"]
  //      c) [data-testid*="tooltip"] / [data-tip] / title attribute on hovered element
  //      d) Recharts / Victory / Chart.js floating <div> overlays
  //      e) Aria-described-by target of the hovered element
  const tooltipText: string = await c.page.evaluate((sel: string) => {
    // ── Helper: pick the most specific non-empty text from an element ────────
    function extractText(el: Element | null): string {
      if (!el) return '';
      return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    }

    // ── Helper: is the element currently visible (has size & not hidden)? ────
    function isVisible(el: Element): boolean {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const style = window.getComputedStyle(el as HTMLElement);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    // ── Strategy A: role="tooltip" ───────────────────────────────────────────
    const roleTooltips = Array.from(document.querySelectorAll('[role="tooltip"]'))
      .filter(isVisible);
    if (roleTooltips.length > 0) return extractText(roleTooltips[0]);

    // ── Strategy B: common tooltip class names ───────────────────────────────
    const classSelectors = [
      '[class*="tooltip"]',
      '[class*="Tooltip"]',
      '[class*="chart-tooltip"]',
      '[class*="recharts-tooltip"]',
      '[class*="apexcharts-tooltip"]',
      '[class*="highcharts-tooltip"]',
      '[class*="chartjs-tooltip"]',
      '[class*="victory-tooltip"]',
      '[class*="popover"]',
    ];
    for (const cs of classSelectors) {
      const els = Array.from(document.querySelectorAll(cs)).filter(isVisible);
      if (els.length > 0) return extractText(els[0]);
    }

    // ── Strategy C: aria-describedby on the hovered element ─────────────────
    const hovered = document.querySelector(sel);
    if (hovered) {
      const describedById = hovered.getAttribute('aria-describedby');
      if (describedById) {
        const desc = document.getElementById(describedById);
        if (desc && isVisible(desc)) return extractText(desc);
      }

      // data-tip attribute (tippy.js, etc.)
      const dataTip = hovered.getAttribute('data-tip') ?? hovered.getAttribute('title');
      if (dataTip) return dataTip.trim();
    }

    // ── Strategy D: any newly visible floating div with position:absolute/fixed
    //    that contains numeric content (common for chart tooltip overlays) ────
    const floaters = Array.from(document.querySelectorAll('div, span, ul'))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const pos = window.getComputedStyle(el as HTMLElement).position;
        if (pos !== 'absolute' && pos !== 'fixed') return false;
        const text = (el.textContent ?? '').trim();
        // Must have at least one digit (tooltip values are numeric or contain numbers)
        return /\d/.test(text) && text.length < 300;
      })
      // prefer smaller, more specific containers
      .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));

    if (floaters.length > 0) return extractText(floaters[0]);

    return '';
  }, selector);

  if (tooltipText) {
    ctx.log(`[HoverAndCaptureTooltip] Captured tooltip: "${tooltipText}"`);
  } else {
    ctx.log('[HoverAndCaptureTooltip] No tooltip text found after hover — storing empty string');
  }

  ctx.setVariable(outputVar, tooltipText);
}
