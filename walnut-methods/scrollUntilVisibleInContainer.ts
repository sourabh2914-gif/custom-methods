import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Scroll Until Visible In Container
 * description: Scroll container until the $[survey_name] is found, with max ${maxScrolls} scroll attempts
 * actionType: custom_scroll_until_visible_in_container
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function scrollUntilVisibleInContainer(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  // args[0] = "survey_name"  (the variable name, from $[survey_name])
  // args[1] = "50"           (maxScrolls value, from ${maxScrolls})
  const surveyNameVarName = ctx.args[0];                          // "survey_name"
  const maxScrolls        = parseInt(ctx.args[1], 10) || 50;

  const page = ctx.page;

  // Resolve the runtime variable value — e.g. "P_Survey Name_Validation"
  const surveyNameValue = ctx.getVariable(surveyNameVarName);
  if (!surveyNameValue) {
    throw new Error(
      `[ScrollUntilVisibleInContainer] Runtime variable "$[${surveyNameVarName}]" is not set. ` +
      `Make sure a previous step stores the survey name into this variable.`
    );
  }

  ctx.log(`[ScrollUntilVisibleInContainer] Looking for survey: "${surveyNameValue}"`);

  // Build the resolved XPath — same pattern as your object XPath but with real value
  const resolvedXPath = `(//span[contains(normalize-space(), '${surveyNameValue}')])[1]`;

  // Fresh DOM check using the fully resolved XPath each call — never stale
  const isPresent = async (): Promise<boolean> => {
    try { return (await page.locator(`xpath=${resolvedXPath}`).count()) > 0; } catch { return false; }
  };

  // Short-circuit: already in DOM before any scrolling
  if (await isPresent()) {
    ctx.log('[ScrollUntilVisibleInContainer] Element already in DOM — done');
    return;
  }

  let prevScrollTop = -1;
  let prevRowCount  = -1;

  for (let i = 0; i < maxScrolls; i++) {

    // Scroll the overflow-auto container via evaluate — zero DOM references held
    const scrollInfo: { scrollTop: number; scrollHeight: number; containerFound: boolean } =
      await page.evaluate(() => {
        // Pick the overflow-auto container with the most scrollable content (the table wrapper)
        const candidates = Array.from(
          document.querySelectorAll('div[class*="overflow-auto"], div[class*="custom-scrollbar"]')
        ) as HTMLElement[];

        candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
        const container = candidates[0] ?? null;

        if (container && container.scrollHeight > container.clientHeight) {
          container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
          return {
            scrollTop:      container.scrollTop,
            scrollHeight:   container.scrollHeight,
            containerFound: true,
          };
        }

        // Fallback: window scroll
        window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        return {
          scrollTop:      window.scrollY,
          scrollHeight:   document.body.scrollHeight,
          containerFound: false,
        };
      });

    // Wait for lazy-loaded rows to render after scroll
    await ctx.wait(600);

    const rowCount: number = await page.locator('tbody tr').count();
    const scrollTop = scrollInfo.scrollTop;

    ctx.log(
      `[ScrollUntilVisibleInContainer] iteration=${i + 1} rows=${rowCount} ` +
      `scrollTop=${scrollTop}px scrollHeight=${scrollInfo.scrollHeight}px containerFound=${scrollInfo.containerFound}`
    );

    // Check for target after scroll + render
    if (await isPresent()) {
      ctx.log(`[ScrollUntilVisibleInContainer] Element "${surveyNameValue}" found — stopping scroll`);
      return;
    }

    // Stagnation: container didn't move AND no new rows loaded
    if (scrollTop === prevScrollTop && rowCount === prevRowCount) {
      ctx.log(`[ScrollUntilVisibleInContainer] Stagnation at iteration=${i + 1} — waiting 3s for lazy load...`);
      await ctx.wait(3000);

      // Retry scroll after grace period
      const retryInfo: { scrollTop: number; scrollHeight: number; containerFound: boolean } =
        await page.evaluate(() => {
          const candidates = Array.from(
            document.querySelectorAll('div[class*="overflow-auto"], div[class*="custom-scrollbar"]')
          ) as HTMLElement[];
          candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
          const container = candidates[0] ?? null;

          if (container && container.scrollHeight > container.clientHeight) {
            container.scrollBy({ top: container.clientHeight, behavior: 'instant' });
            container.dispatchEvent(new Event('scroll', { bubbles: true }));
            return { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight, containerFound: true };
          }
          window.scrollBy({ top: window.innerHeight, behavior: 'instant' });
          window.dispatchEvent(new Event('scroll', { bubbles: true }));
          return { scrollTop: window.scrollY, scrollHeight: document.body.scrollHeight, containerFound: false };
        });

      await ctx.wait(600);

      const rowCountRetry: number = await page.locator('tbody tr').count();
      ctx.log(
        `[ScrollUntilVisibleInContainer] Post-grace: rows=${rowCountRetry} scrollTop=${retryInfo.scrollTop}px`
      );

      if (await isPresent()) {
        ctx.log(`[ScrollUntilVisibleInContainer] Element "${surveyNameValue}" found after grace period — stopping scroll`);
        return;
      }

      // Truly at bottom — no movement at all after retry
      if (rowCountRetry === rowCount && retryInfo.scrollTop === scrollTop) {
        throw new Error(
          `[ScrollUntilVisibleInContainer] Reached bottom after ${i + 1} scroll(s) — ` +
          `element "${surveyNameValue}" not found.`
        );
      }

      prevScrollTop = retryInfo.scrollTop;
      prevRowCount  = rowCountRetry;
      continue;
    }

    prevScrollTop = scrollTop;
    prevRowCount  = rowCount;
  }

  throw new Error(
    `[ScrollUntilVisibleInContainer] Exceeded max scroll limit (${maxScrolls}) — ` +
    `element "${surveyNameValue}" not found.`
  );
}
