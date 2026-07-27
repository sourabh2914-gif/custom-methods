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
  // ctx.args[0] = value of ${selector}     — CSS or XPath selector of the element to hover (e.g. a chart bar)
  //                                           c.hover() is Playwright-native and handles both CSS and XPath.
  // ctx.args[1] = "tooltipValue" (from $[tooltipValue]) — runtime variable name to store captured text

  const selector  = String(ctx.args[0]);
  const outputVar = String(ctx.args[1]);
  const c         = ctx as any;

  ctx.log(`[HoverAndCaptureTooltip] Hovering on: "${selector}"`);

  // 1. Playwright hover — supports both CSS selectors and XPath expressions natively
  await c.hover(selector);

  // 2. Hold cursor in place for 3.5 s — enough for chart tooltip to fully render
  await c.wait(3500);

  // 3. Scan the DOM for tooltip text using multiple strategies.
  //    NOTE: page.evaluate runs inside the browser — document.querySelector only accepts CSS.
  //    We pass the selector as a string so Strategy C can use the correct browser API
  //    (XPath via document.evaluate, or CSS via document.querySelector).
  const tooltipText: string = await c.page.evaluate((sel: string) => {

    // ── Helper: extract trimmed text from an element ─────────────────────────
    function extractText(el: Element | null): string {
      if (!el) return '';
      return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    }

    // ── Helper: check element is visually rendered ───────────────────────────
    function isVisible(el: Element): boolean {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const style = window.getComputedStyle(el as HTMLElement);
      return style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0';
    }

    // ── Helper: resolve a CSS or XPath selector to an Element (browser-safe) ─
    // document.querySelector() only accepts CSS — XPath strings starting with
    // "//" or "(" must use document.evaluate() instead.
    function resolveSelector(s: string): Element | null {
      const isXPath = s.trimStart().startsWith('//') || s.trimStart().startsWith('(');
      if (isXPath) {
        try {
          const result = document.evaluate(
            s, document, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          return (result.singleNodeValue as Element | null) ?? null;
        } catch (_) {
          return null;
        }
      }
      try {
        return document.querySelector(s);
      } catch (_) {
        return null;
      }
    }

    // ── Strategy A: role="tooltip" (most reliable across libraries) ──────────
    const roleTooltips = Array.from(document.querySelectorAll('[role="tooltip"]'))
      .filter(isVisible);
    if (roleTooltips.length > 0) return extractText(roleTooltips[0]);

    // ── Strategy B: common tooltip/chart class names ─────────────────────────
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

    // ── Strategy C: attributes on the hovered element itself ─────────────────
    // Uses resolveSelector() so XPath strings are handled via document.evaluate
    // instead of the CSS-only document.querySelector — this was the crash source.
    const hovered = resolveSelector(sel);
    if (hovered) {
      const describedById = hovered.getAttribute('aria-describedby');
      if (describedById) {
        const desc = document.getElementById(describedById);
        if (desc && isVisible(desc)) return extractText(desc);
      }
      // data-tip (tippy.js) or plain title attribute
      const dataTip = hovered.getAttribute('data-tip') ?? hovered.getAttribute('title');
      if (dataTip) return dataTip.trim();
    }

    // ── Strategy D: visible floating div/span containing a number ────────────
    // Fallback for custom chart overlays (position: absolute/fixed, has digits)
    const floaters = Array.from(document.querySelectorAll('div, span, ul'))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const pos = window.getComputedStyle(el as HTMLElement).position;
        if (pos !== 'absolute' && pos !== 'fixed') return false;
        const text = (el.textContent ?? '').trim();
        return /\d/.test(text) && text.length < 300;
      })
      // prefer the smallest/most-specific container
      .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));

    if (floaters.length > 0) return extractText(floaters[0]);

    return '';
  }, selector);

  if (tooltipText) {
    ctx.log(`[HoverAndCaptureTooltip] Captured tooltip: "${tooltipText}"`);
  } else {
    ctx.log('[HoverAndCaptureTooltip] No tooltip text found — storing empty string');
  }

  ctx.setVariable(outputVar, tooltipText);
}
