import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Validate Date From Object
 * description: Validate date field matches $[expectedDate]
 * actionType: custom_validate_date_from_object
 * context: web
 * needsLocator: true
 * category: Verification
 */
export async function validateDateFromObject(ctx: WalnutContext) {
  const c = ctx as any;
  const locator = c.locator;

  // ctx.args[0] = "dob" (from $[dob]) — runtime variable holding the stored date
  const storedDate = String(c.getVariable(c.args[0])).trim();

  if (!storedDate || storedDate === 'undefined') {
    throw new Error(`Runtime variable "$[${c.args[0]}]" is empty — capture the date in a prior step first.`);
  }

  c.log(`Stored date value: "${storedDate}"`);

  // Normalise stored date to DD-MM-YYYY regardless of input format:
  // Handles "05/15/1990" (MM/DD/YYYY) and "1990-05-15" (YYYY-MM-DD)
  let expectedFormatted: string;
  if (storedDate.includes('/')) {
    // MM/DD/YYYY → DD-MM-YYYY
    const [mm, dd, yyyy] = storedDate.split('/');
    expectedFormatted = `${dd}-${mm}-${yyyy}`;
  } else if (storedDate.includes('-') && storedDate.indexOf('-') === 4) {
    // YYYY-MM-DD → DD-MM-YYYY
    const [yyyy, mm, dd] = storedDate.split('-');
    expectedFormatted = `${dd}-${mm}-${yyyy}`;
  } else {
    // Already in DD-MM-YYYY or unknown — use as-is
    expectedFormatted = storedDate;
  }

  c.log(`Expected date (formatted): "${expectedFormatted}"`);

  // Read actual value from the date field.
  // The field may be a read-only wrapper — use evaluate() to extract
  // value or innerText from the element or its first input/div descendant.
  let actualText: string = '';

  const extractDate = async (el: any): Promise<string> => {
    return el.evaluate((node: Element) => {
      // 1. If it's an input, return its value
      if ((node as HTMLInputElement).value !== undefined && (node as HTMLInputElement).tagName === 'INPUT') {
        return (node as HTMLInputElement).value;
      }
      // 2. Check for a nested input
      const input = node.querySelector('input');
      if (input && input.value) return input.value;
      // 3. Fall back to innerText / textContent
      return (node as HTMLElement).innerText?.trim() || node.textContent?.trim() || '';
    });
  };

  if (typeof locator === 'string') {
    // Use Playwright page to get the element handle
    const el = c.page.locator(locator).first();
    actualText = (await extractDate(el)).trim();
  } else {
    actualText = (await extractDate(locator)).trim();
  }

  c.log(`Actual date on screen: "${actualText}"`);

  // Normalise actual text the same way for fair comparison
  let actualFormatted: string;
  if (actualText.includes('/')) {
    const [mm, dd, yyyy] = actualText.split('/');
    actualFormatted = `${dd}-${mm}-${yyyy}`;
  } else if (actualText.includes('-') && actualText.indexOf('-') === 4) {
    const [yyyy, mm, dd] = actualText.split('-');
    actualFormatted = `${dd}-${mm}-${yyyy}`;
  } else {
    actualFormatted = actualText;
  }

  c.log(`Actual date (formatted): "${actualFormatted}"`);

  if (actualFormatted !== expectedFormatted) {
    throw new Error(`Date mismatch — expected "${expectedFormatted}" but found "${actualFormatted}"`);
  }

  c.log(`Date validation passed: "${actualFormatted}"`);
}
