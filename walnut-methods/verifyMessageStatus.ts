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
  // args[1] = messageText (optional — scope the tick check to a specific message bubble)
  const statusType = (ctx.args?.[0] ?? '').toString().trim().toLowerCase().replace(/\s+/g, '_');
  const messageText = ctx.args?.[1];

  // --- Selector map ---
  // Double tick icons use lucide-check-check, single tick uses lucide-check
  // Color is controlled by a Tailwind text-* class on the svg
  // Online/offline status dot uses a span with bg-* class inside the avatar
  const SELECTORS: Record<string, string> = {
    blue_double_tick:  'svg.lucide-check-check.text-blue-500',
    gray_double_tick:  'svg.lucide-check-check.text-gray-400',
    gray_single_tick:  'svg.lucide-check.text-gray-400',
    green_online:      'span.bg-green-400.rounded-full',
    gray_offline:      'span.rounded-full[class*="bg-[#dcdcdc]"]',
  };

  // Fallback selectors for cases where the class is set slightly differently
  const FALLBACK_SELECTORS: Record<string, string[]> = {
    blue_double_tick:  [
      'svg.lucide.lucide-check-check.text-blue-500',
      'svg[class*="lucide-check-check"][class*="text-blue"]',
    ],
    gray_double_tick:  [
      'svg.lucide.lucide-check-check.text-gray-400',
      'svg[class*="lucide-check-check"][class*="text-gray-400"]',
    ],
    gray_single_tick:  [
      'svg.lucide.lucide-check.text-gray-400',
      'svg[class*="lucide-check"][class*="text-gray-400"]:not([class*="lucide-check-check"])',
    ],
    green_online:      [
      'span.absolute.bottom-0.right-0.bg-green-400',
      'span[class*="bg-green-400"][class*="rounded-full"]',
    ],
    gray_offline:      [
      'span.absolute.bottom-0.right-0[class*="dcdcdc"]',
      'span[class*="dcdcdc"][class*="rounded-full"]',
      'span[class*="bg-[#dcdcdc]"]',
    ],
  };

  if (!SELECTORS[statusType]) {
    throw new Error(
      `Unknown statusType "${statusType}". Valid values: blue_double_tick, gray_double_tick, gray_single_tick, green_online, gray_offline`
    );
  }

  // Helper: try a list of selectors and return the first one that finds a visible element
  async function findVisible(selectors: string[], scope?: any): Promise<boolean> {
    const root = scope ?? page;
    for (const sel of selectors) {
      try {
        const el = root.locator(sel).first();
        if (await el.isVisible({ timeout: 3000 })) {
          return true;
        }
      } catch (_) {
        // try next selector
      }
    }
    return false;
  }

  // If a message text is provided, scope the tick check to that message bubble
  let scope: any = undefined;
  if (messageText && (statusType === 'blue_double_tick' || statusType === 'gray_double_tick' || statusType === 'gray_single_tick')) {
    try {
      // Find the message bubble that contains the given text
      scope = page.locator('div[class*="relative"][class*="max-w"]').filter({ hasText: messageText });
      const count = await scope.count();
      if (count === 0) {
        // Fall back to no scope
        scope = undefined;
        c.warn(`Message bubble containing "${messageText}" not found — checking page-wide`);
      }
    } catch (_) {
      scope = undefined;
    }
  }

  const primarySelector = SELECTORS[statusType];
  const fallbacks = FALLBACK_SELECTORS[statusType] ?? [];
  const allSelectors = [primarySelector, ...fallbacks];

  const found = await findVisible(allSelectors, scope);

  if (found) {
    c.log(`Status icon "${statusType}" is visible${messageText ? ` for message "${messageText}"` : ''} — step passed`);
  } else {
    throw new Error(
      `Status icon "${statusType}" is NOT visible${messageText ? ` for message "${messageText}"` : ''}. ` +
      `Tried selectors: ${allSelectors.join(', ')}`
    );
  }
}
