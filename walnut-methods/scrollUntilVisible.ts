import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Element Visible
 * description: Scroll page up to ${maxScrolls} times until element is visible
 * actionType: custom_scroll_until_visible
 * context: web
 * needsLocator: true
 * category: Navigation
 */
export async function scrollUntilVisible(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;

  // ── Resolve all variable syntaxes in a string ─────────────────────────────
  // Handles every placeholder format Walnut supports:
  //   {{name}}  — mustache variables
  //   ${name}   — test data / local params
  //   $(name)   — global variables
  //   $[name]   — runtime variables set by previous steps
  const resolveAll = (text: string): string => {
    let result: string = c.replacePlaceholders(text);

    // ${param} — test data values
    result = result.replace(/\$\{([^}]+)\}/g, (_: string, name: string) => {
      const trimmed = name.trim();
      const testData: Record<string, any> = c.testDataValues ?? {};
      const val = testData[trimmed] ?? testData[trimmed.toLowerCase()];
      return (val !== undefined && val !== null) ? String(val) : _;
    });

    // $(global) — global variables
    result = result.replace(/\$\(([^)]+)\)/g, (_: string, name: string) => {
      const trimmed = name.trim();
      const globals: Record<string, any> = c.globalVarContext ?? {};
      const val = globals[trimmed] ?? globals[trimmed.toLowerCase()];
      return (val !== undefined && val !== null) ? String(val) : _;
    });

    // $[runtime] — runtime variables stored by previous steps
    result = result.replace(/\$\[([^\]]+)\]/g, (_: string, name: string) => {
      const val = c.getVariable(name.trim());
      return (val !== undefined && val !== null) ? String(val) : _;
    });

    return result;
  };

  // ── Read maxScrolls from step arg ─────────────────────────────────────────
  const maxScrolls: number = c.args[0] ? parseInt(resolveAll(c.args[0]), 10) : 50;

  // ── Read and resolve the locator from the attached object ─────────────────
  // ctx.locator contains the raw selector string attached to the step.
  // It can be XPath, CSS, or a Playwright selector — resolved through all
  // variable syntaxes so it can embed runtime values like $[surveyName].
  const rawLocator: string = c.locator;
  if (!rawLocator) throw new Error('[scroll_until_visible] No locator attached to this step');

  const resolvedLocator: string = resolveAll(rawLocator);

  c.log(`[scroll_until_visible] maxScrolls=${maxScrolls}`);
  c.log(`[scroll_until_visible] locator=${resolvedLocator}`);

  const page = c.page;

  // ── Build Playwright locator — supports XPath, CSS, and Playwright selectors
  // XPath   : starts with //  or  /   or  (//
  // Playwright selector: contains >> or role= or text= etc.
  // CSS     : everything else
  const buildLocator = (selector: string) => {
    const trimmed = selector.trim();
    const isXPath = trimmed.startsWith('//') ||
                    trimmed.startsWith('/') ||
                    trimmed.startsWith('(//');
    const isPlaywright = /^(text=|role=|label=|placeholder=|alt=|title=|testid=|data-testid=|nth=|\.\.)/.test(trimmed) ||
                         trimmed.includes(' >> ');

    if (isXPath)        return page.locator(`xpath=${trimmed}`);
    if (isPlaywright)   return page.locator(trimmed);
    return               page.locator(trimmed); // CSS
  };

  const targetLocator = buildLocator(resolvedLocator);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isPresent = async (): Promise<boolean> => {
    try { return (await targetLocator.count()) > 0; } catch { return false; }
  };

  const scrollIntoView = async (): Promise<void> => {
    try { await targetLocator.first().scrollIntoViewIfNeeded(); } catch { /* ignore */ }
  };

  // ── Short-circuit if already in DOM ───────────────────────────────────────
  if (await isPresent()) {
    c.log(`[scroll_until_visible] Element already present — scrolling into view`);
    await scrollIntoView();
    return;
  }

  let prevRowCount = -1;
  let prevWindowY  = -1;

  for (let i = 0; i < maxScrolls; i++) {

    // 1. Scroll last <tr> into view — triggers table infinite-scroll
    const lastRow = page.locator('tbody tr').last();
    if (await lastRow.count() > 0) {
      await lastRow.scrollIntoViewIfNeeded();
    }

    // 2. Push window down — triggers window-level infinite-scroll
    const windowY: number = await page.evaluate(() => {
      window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll', { bubbles: true }));
      return window.scrollY;
    });

    // Wait for React / virtual list to render new items
    await page.waitForTimeout(500);

    const rowCount = await page.locator('tbody tr').count();
    c.log(`[scroll_until_visible] iteration=${i + 1} rows=${rowCount} windowY=${windowY}px`);

    // Check for target
    if (await isPresent()) {
      c.log(`[scroll_until_visible] Element found — scrolling into view`);
      await scrollIntoView();
      return;
    }

    // Bottom detection: neither rows increased nor window moved
    if (rowCount === prevRowCount && windowY === prevWindowY) {
      throw new Error(
        `[scroll_until_visible] Reached bottom after ${i + 1} scroll(s) — element not found.\n` +
        `Locator: "${resolvedLocator}"`,
      );
    }

    prevRowCount = rowCount;
    prevWindowY  = windowY;
  }

  throw new Error(
    `[scroll_until_visible] Exceeded max scroll limit (${maxScrolls}) — element not found.\n` +
    `Locator: "${resolvedLocator}"`,
  );
}
