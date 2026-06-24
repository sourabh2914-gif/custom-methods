import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Verify Message Status Icon
 * description: Verify message status ${statusType} for message ${messageText}
 * actionType: custom_verify_message_status
 * context: web
 * needsLocator: false
 * category: Verification
 */
export async function verifyMessageStatus(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const c = ctx as any;
  const page = c.page;

  // args[0] = statusType: "blue_double_tick" | "gray_double_tick" | "gray_single_tick" | "green_online" | "gray_offline"
  // args[1] = messageText (optional — scope tick check to a specific message bubble)
  const statusType = (ctx.args?.[0] ?? '').toString().trim().toLowerCase().replace(/\s+/g, '_');
  const messageText = ctx.args?.[1];

  // DOM class signatures observed from the application:
  //   Gray double tick : svg with classes "lucide lucide-check-check text-gray-400"
  //   Blue double tick : svg with classes "lucide lucide-check-check text-blue-500"
  //   Gray single tick : svg with classes "lucide lucide-check text-gray-400"   (NOT lucide-check-check)
  //   Green online dot : span with class containing "bg-green-400" and "rounded-full"
  //   Gray offline dot : span with class containing "bg-[#dcdcdc]" and "rounded-full"

  // CSS selectors — using attribute contains (*=) to be resilient to extra classes
  const SELECTORS: Record<string, string[]> = {
    blue_double_tick: [
      'svg[class*="lucide-check-check"][class*="text-blue-500"]',
      'svg[class*="check-check"][class*="blue"]',
    ],
    gray_double_tick: [
      'svg[class*="lucide-check-check"][class*="text-gray-400"]',
      'svg[class*="check-check"][class*="gray-400"]',
    ],
    gray_single_tick: [
      // Must match check but NOT check-check
      'svg[class*="lucide-check"][class*="text-gray-400"]:not([class*="check-check"])',
      'svg[class*="lucide-check "][class*="text-gray-400"]',
    ],
    green_online: [
      'span[class*="bg-green-400"][class*="rounded-full"]',
      'span.bg-green-400',
    ],
    gray_offline: [
      'span[class*="dcdcdc"][class*="rounded-full"]',
      'span[class*="bg-[#dcdcdc]"]',
    ],
  };

  if (!SELECTORS[statusType]) {
    throw new Error(
      `Unknown statusType "${statusType}". Valid values: blue_double_tick, gray_double_tick, gray_single_tick, green_online, gray_offline`
    );
  }

  const selectors = SELECTORS[statusType];

  // Strategy: use page.evaluate (querySelectorAll) which finds elements regardless of scroll position.
  // This is more reliable than Playwright's isVisible() which can return false for off-screen elements
  // inside overflow:hidden scroll containers.

  async function countBySelector(sel: string, scopeText?: string): Promise<number> {
    try {
      return await page.evaluate(
        ({ selector, text }: { selector: string; text?: string }) => {
          let elements = Array.from(document.querySelectorAll(selector));
          if (text) {
            // Scope to elements whose closest message bubble ancestor contains the text
            elements = elements.filter(el => {
              const bubble = el.closest('div[class*="max-w"]') ?? el.closest('div[class*="relative"]');
              return bubble ? bubble.textContent?.includes(text) : false;
            });
          }
          return elements.length;
        },
        { selector: sel, text: scopeText }
      );
    } catch (_) {
      return 0;
    }
  }

  let found = false;
  let matchedSelector = '';

  for (const sel of selectors) {
    const count = await countBySelector(sel, messageText || undefined);
    if (count > 0) {
      found = true;
      matchedSelector = sel;
      break;
    }
  }

  if (found) {
    c.log(
      `Status icon "${statusType}" found (selector: "${matchedSelector}")` +
      (messageText ? ` for message "${messageText}"` : '') +
      ' — step passed'
    );
  } else {
    throw new Error(
      `Status icon "${statusType}" is NOT present in the DOM` +
      (messageText ? ` for message "${messageText}"` : '') +
      `. Tried selectors: ${selectors.join(', ')}`
    );
  }
}
