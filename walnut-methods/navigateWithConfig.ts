import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Navigate With Config
 * description: Navigate to ${url} with browser configuration ${config}
 * actionType: custom_navigate_with_config
 * context: web
 * needsLocator: false
 * category: Navigation
 */
export async function navigateWithConfig(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const url = ctx.args[0];
  const configRaw = ctx.args[1] || '';

  if (!url) throw new Error('[NavigateWithConfig] No URL provided — set the first argument to the target URL.');

  // Parse config string: "lang=en-US,width=1280,height=720,timezone=America/New_York"
  // Supports both comma-separated and space-separated pairs.
  const config: Record<string, string> = {};
  if (configRaw.trim()) {
    const pairs = configRaw.split(/[\s,]+/);
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) {
        ctx.warn(`[NavigateWithConfig] Ignoring malformed config entry (no "="): "${pair}"`);
        continue;
      }
      const key = pair.slice(0, eqIdx).trim().toLowerCase();
      const value = pair.slice(eqIdx + 1).trim();
      config[key] = value;
    }
  }

  const page = ctx.page;
  const browserContext = page.context();

  // --- 1. Language / Accept-Language header ---
  if (config['lang']) {
    await page.setExtraHTTPHeaders({ 'Accept-Language': config['lang'] });
    // Override navigator.language so JS code on the page also sees the correct locale.
    await browserContext.addInitScript(`
      Object.defineProperty(navigator, 'language', { get: () => '${config['lang']}' });
      Object.defineProperty(navigator, 'languages', { get: () => ['${config['lang']}'] });
    `);
    ctx.log(`[NavigateWithConfig] Language set to: ${config['lang']}`);
  }

  // --- 2. Viewport / Resolution ---
  const width = config['width'] ? parseInt(config['width'], 10) : null;
  const height = config['height'] ? parseInt(config['height'], 10) : null;
  if (width && height) {
    await ctx.setViewportSize(width, height);
    ctx.log(`[NavigateWithConfig] Viewport set to: ${width}x${height}`);
  } else if (width || height) {
    ctx.warn('[NavigateWithConfig] Both "width" and "height" are required to set viewport — skipping.');
  }

  // --- 3. Timezone ---
  if (config['timezone']) {
    await browserContext.addInitScript(`
      Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
        construct(Target, args) {
          if (args[1] && args[1].timeZone === undefined) {
            args[1] = { ...args[1], timeZone: '${config['timezone']}' };
          } else if (!args[1]) {
            args[1] = { timeZone: '${config['timezone']}' };
          }
          return new Target(...args);
        }
      });
    `);
    ctx.log(`[NavigateWithConfig] Timezone override set to: ${config['timezone']}`);
  }

  // --- 4. Geolocation  (lat=<value>,lon=<value>) ---
  const lat = config['lat'] ? parseFloat(config['lat']) : null;
  const lon = config['lon'] ? parseFloat(config['lon']) : null;
  if (lat !== null && lon !== null) {
    await browserContext.setGeolocation({ latitude: lat, longitude: lon });
    await browserContext.grantPermissions(['geolocation']);
    ctx.log(`[NavigateWithConfig] Geolocation set to: lat=${lat}, lon=${lon}`);
  }

  // --- 5. Color scheme  (colorscheme=dark|light|no-preference) ---
  const colorSchemeRaw = config['colorscheme'] || config['color-scheme'] || config['colorscheme'];
  if (colorSchemeRaw) {
    const allowed = ['dark', 'light', 'no-preference'];
    const scheme = colorSchemeRaw.toLowerCase();
    if (allowed.includes(scheme)) {
      await page.emulateMedia({ colorScheme: scheme as 'dark' | 'light' | 'no-preference' });
      ctx.log(`[NavigateWithConfig] Color scheme set to: ${scheme}`);
    } else {
      ctx.warn(`[NavigateWithConfig] Unknown colorScheme value "${colorSchemeRaw}" — valid values: dark, light, no-preference`);
    }
  }

  // --- 6. Reduced motion  (reducedmotion=reduce|no-preference) ---
  const reducedMotion = config['reducedmotion'] || config['reduced-motion'];
  if (reducedMotion) {
    const allowed = ['reduce', 'no-preference'];
    const motion = reducedMotion.toLowerCase();
    if (allowed.includes(motion)) {
      await page.emulateMedia({ reducedMotion: motion as 'reduce' | 'no-preference' });
      ctx.log(`[NavigateWithConfig] Reduced motion set to: ${motion}`);
    } else {
      ctx.warn(`[NavigateWithConfig] Unknown reducedMotion value "${reducedMotion}" — valid: reduce, no-preference`);
    }
  }

  // --- Navigate ---
  await ctx.navigate(url);
  ctx.log(`[NavigateWithConfig] Navigated to: ${url}`);
}
