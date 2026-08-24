import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Play Displayed Video
 * description: Find the currently displayed video and start playing it
 * actionType: custom_play_displayed_video
 * context: web
 * needsLocator: false
 * category: Interaction
 */
export async function playDisplayedVideo(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  const page = ctx.page;
  const LOG = '[PlayDisplayedVideo]';

  // Play-button selectors inside a player frame, in priority order.
  // Covers YouTube mobile embed (ytmCuedOverlayPlayButton), YouTube desktop
  // embed (ytp-large-play-button), Video.js, Vimeo and generic HTML5 players.
  const PLAY_BUTTON_SELECTORS = [
    'button[aria-label="Play video"]',
    '.ytp-large-play-button',
    '.vjs-big-play-button',
    'button[aria-label^="Play" i]',
    '[class*="playButton" i]',
  ];

  // True once a <video> in the given frame has actually started playing.
  // This only detects playback START — it does not wait for completion.
  const hasPlaybackStarted = async (frame: any): Promise<boolean> => {
    try {
      return await frame.evaluate(() => {
        const v = document.querySelector('video');
        return !!v && !v.paused && !v.ended && v.currentTime > 0;
      });
    } catch {
      return false;
    }
  };

  // Poll until playback starts (max ~8s). Short timeout by design — the
  // method's job is only to START the video, not to watch it through.
  const waitForPlaybackStart = async (frame: any): Promise<boolean> => {
    for (let i = 0; i < 16; i++) {
      if (await hasPlaybackStarted(frame)) return true;
      await ctx.wait(500);
    }
    return false;
  };

  const clickPlayInFrame = async (frame: any): Promise<boolean> => {
    for (const sel of PLAY_BUTTON_SELECTORS) {
      try {
        const btn = await frame.$(sel);
        if (btn && (await btn.isVisible())) {
          await btn.click({ timeout: 3000 });
          ctx.log(`${LOG} Clicked play button: ${sel}`);
          return true;
        }
      } catch {
        // selector not present/clickable in this player — try the next one
      }
    }
    return false;
  };

  const forcePlayViaJs = async (frame: any): Promise<void> => {
    try {
      await frame.evaluate(() => {
        const v = document.querySelector('video') as any;
        if (v && typeof v.play === 'function') {
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      });
    } catch {
      // ignore — final verification will report failure if this did not help
    }
  };

  // --- 1. Locate the currently displayed video -----------------------------
  // Prefer visible iframes whose src points at a known video provider; the
  // embed URL changes with each user selection, so match the provider only.
  const iframeHandles = await page.$$('iframe');
  let targetFrame: any = null;
  let targetIframeHandle: any = null;

  for (const handle of iframeHandles) {
    const box = await handle.boundingBox();
    if (!box) continue; // hidden iframe — not the displayed video
    const src = ((await handle.getAttribute('src')) || '').toLowerCase();
    if (/youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com|video/.test(src)) {
      const frame = await handle.contentFrame();
      if (frame) {
        targetFrame = frame;
        targetIframeHandle = handle;
        break;
      }
    }
  }

  // Fallback: first visible iframe that actually contains a <video> element
  if (!targetFrame) {
    for (const handle of iframeHandles) {
      const box = await handle.boundingBox();
      if (!box) continue;
      const frame = await handle.contentFrame();
      if (!frame) continue;
      const containsVideo = await frame
        .evaluate(() => !!document.querySelector('video'))
        .catch(() => false);
      if (containsVideo) {
        targetFrame = frame;
        targetIframeHandle = handle;
        break;
      }
    }
  }

  if (targetFrame) {
    ctx.log(`${LOG} Found displayed video inside an iframe — starting playback...`);
  } else {
    // No video iframe — check for a native <video> element on the main page
    const hasNativeVideo = await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return false;
      const r = v.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!hasNativeVideo) {
      throw new Error(`${LOG} No video found on the page (no video iframe and no native <video> element)`);
    }
    targetFrame = page; // operate on the main frame
    ctx.log(`${LOG} Found native <video> element on the page — starting playback...`);
  }

  // --- 2. Start playback ----------------------------------------------------
  if (await hasPlaybackStarted(targetFrame)) {
    ctx.log(`${LOG} Video is already playing — nothing to do.`);
    return;
  }

  let clicked = await clickPlayInFrame(targetFrame);

  // Fallback: click the centre of the player surface (some players only
  // respond to a click on the video/thumbnail overlay itself)
  if (!clicked && targetIframeHandle) {
    try {
      const box = await targetIframeHandle.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        ctx.log(`${LOG} No play button found — clicked centre of the player`);
        clicked = true;
      }
    } catch {
      // ignore
    }
  }

  // Give the player a moment; if playback has not started, force it via JS
  await ctx.wait(1000);
  if (!(await hasPlaybackStarted(targetFrame))) {
    ctx.log(`${LOG} Playback not started after click — forcing play via video.play()`);
    await forcePlayViaJs(targetFrame);
  }

  // --- 3. Confirm the video STARTED playing (not completion) ----------------
  if (!(await waitForPlaybackStart(targetFrame))) {
    throw new Error(`${LOG} Video did not start playing after clicking Play`);
  }

  ctx.log(`${LOG} Video started playing successfully.`);
}
