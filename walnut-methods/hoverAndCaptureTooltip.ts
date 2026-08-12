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

  // 1. Hover the target.
  //    ApexCharts bar paths with val="0" render as zero-height shapes
  //    (barHeight="0") — an empty bounding box that Playwright's hover()
  //    cannot target. For those SVG shapes, move the raw mouse to the
  //    path's cx/cy point instead so the shared tooltip still triggers.
  //    Example DOM:
  //      <g class="apexcharts-series" seriesName="Nurse" data:realIndex="3">
  //        <path class="apexcharts-bar-area" j="1" val="0" barHeight="0"
  //              cx="298.37" cy="214.86" .../>
  //      </g>
  const svgHoverPoint: { x: number; y: number } | null = await c.page.evaluate((sel: string) => {
    // Strip explicit "xpath=" engine prefix so every XPath form is detected
    const t = sel.trim();
    const q = t.startsWith('xpath=') ? t.slice(6) : t;
    const isXPath = q.startsWith('//') || q.startsWith('(') || q.startsWith('/');
    let el: Element | null = null;
    try {
      if (isXPath) {
        el = document.evaluate(q, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
          .singleNodeValue as Element | null;
      } else {
        el = document.querySelector(q);
      }
    } catch (_) {
      return null;
    }
    if (!el) return null;
    const svgEl = el as SVGGraphicsElement;
    const svgRoot = svgEl.ownerSVGElement;
    if (!svgRoot) return null;                       // not SVG → normal hover
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) return null;  // hittable → normal hover
    const cx = parseFloat(el.getAttribute('cx') ?? '');
    const cy = parseFloat(el.getAttribute('cy') ?? '');
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      const m = svgEl.getScreenCTM();
      if (!m) return null;
      const pt = svgRoot.createSVGPoint();
      pt.x = cx;
      pt.y = cy;
      const screen = pt.matrixTransform(m);
      // Nudge a few px above the baseline so the point sits inside the plot area
      return { x: screen.x, y: screen.y - 5 };
    }
    return { x: r.x + r.width / 2, y: r.y - 5 };
  }, selector);

  if (svgHoverPoint) {
    ctx.log(`[HoverAndCaptureTooltip] Zero-size SVG target — hovering at (${svgHoverPoint.x.toFixed(1)}, ${svgHoverPoint.y.toFixed(1)})`);
    await c.mouseMove(svgHoverPoint.x, svgHoverPoint.y);
  } else {
    // Playwright hover. Force the xpath engine for XPath strings — Playwright
    // only auto-detects selectors starting with "//", so wrapped forms like
    // "(//path)[1]" or absolute "/html/..." need the explicit "xpath=" prefix.
    const t = selector.trim();
    const isXpathForm = !t.startsWith('xpath=')
      && (t.startsWith('//') || t.startsWith('(') || t.startsWith('/'));
    await c.hover(isXpathForm ? 'xpath=' + t : selector);
  }

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
      // Strip explicit "xpath=" engine prefix — document.evaluate needs the raw XPath
      const t = s.trim();
      const q = t.startsWith('xpath=') ? t.slice(6) : t;
      const isXPath = q.startsWith('//') || q.startsWith('(') || q.startsWith('/');
      if (isXPath) {
        try {
          const result = document.evaluate(
            q, document, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          return (result.singleNodeValue as Element | null) ?? null;
        } catch (_) {
          return null;
        }
      }
      try {
        return document.querySelector(q);
      } catch (_) {
        return null;
      }
    }

    // ── Strategy A: SVG <title> on the hovered element (e.g. chart bars) ─────
    // Charts like this one embed tooltip text as a <title> child inside the
    // hovered <rect>/<path>/<circle>. This must be checked FIRST because the
    // <title> is never "visible" in the CSS sense, so visibility-based checks
    // would skip it. Example DOM:
    //   <rect class="hover:opacity-80 ...">
    //     <title>Systolic (patient): 210 mmHg</title>
    //   </rect>
    const hoveredEl = resolveSelector(sel);
    if (hoveredEl) {
      // Direct <title> child
      const svgTitle = hoveredEl.querySelector('title');
      if (svgTitle) {
        const titleText = (svgTitle.textContent ?? '').trim();
        if (titleText) return titleText;
      }
      // Also check every element that matches the selector (multi-match XPath)
    }
    // Broader fallback: XPath may match multiple nodes — scan all of them for a <title>
    // Only do this when the selector is XPath (starts with "//" or "(")
    const selT = sel.trim();
    const selQ = selT.startsWith('xpath=') ? selT.slice(6) : selT;
    if (selQ.startsWith('//') || selQ.startsWith('(') || selQ.startsWith('/')) {
      try {
        const xpathResult = document.evaluate(
          selQ, document, null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );
        for (let i = 0; i < xpathResult.snapshotLength; i++) {
          const node = xpathResult.snapshotItem(i) as Element | null;
          if (!node) continue;
          const t = node.querySelector('title');
          if (t) {
            const text = (t.textContent ?? '').trim();
            if (text) return text;
          }
        }
      } catch (_) { /* ignore XPath errors */ }
    }

    // ── Strategy B: role="tooltip" (most reliable across libraries) ──────────
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

    // ── Strategy D: ApexCharts SVG series reconstruction ─────────────────────
    // Handles this chart DOM when no rendered tooltip element is found:
    //   <g class="apexcharts-bar-series apexcharts-plot-series">
    //     <g class="apexcharts-series" rel="1" seriesName="Patient" data:realIndex="0">
    //     <g class="apexcharts-series" rel="4" seriesName="Nurse" data:realIndex="3">
    //       <path class="apexcharts-bar-area" index="3" j="0" val="1"
    //             barHeight="21.48" barWidth="16.88" cx="185.78" cy="193.37"/>
    // Rebuilds the tooltip text from seriesName + j + val attributes, e.g.:
    //   "AUG 12 Patient: 0 Family member: 10 Doctor: 1 Nurse: 1"
    if (hovered) {
      const apexDataEl = hovered.hasAttribute('val')
        ? hovered
        : hovered.querySelector('[val]');
      if (apexDataEl) {
        const j = apexDataEl.getAttribute('j');
        const chartScope: ParentNode =
          hovered.closest('.apexcharts-canvas') ??
          hovered.closest('.apexcharts-svg') ??
          document;
        const parts: string[] = [];
        // X-axis category label from the active x-axis tooltip, if rendered
        const xTip = chartScope.querySelector('.apexcharts-xaxistooltip.apexcharts-active');
        if (xTip && isVisible(xTip)) {
          const xText = extractText(xTip);
          if (xText) parts.push(xText);
        }
        const seriesGroups = Array.from(
          chartScope.querySelectorAll('.apexcharts-series[seriesName]')
        );
        for (const g of seriesGroups) {
          const name = g.getAttribute('seriesName');
          const pathEl = j !== null
            ? g.querySelector(`[j="${j}"][val]`)
            : g.querySelector('[val]');
          const val = pathEl ? pathEl.getAttribute('val') : null;
          if (name && val !== null) parts.push(`${name}: ${val}`);
        }
        if (parts.length > 0) return parts.join(' ');
      }
    }

    // ── Strategy E: visible floating div/span containing a number ────────────
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
