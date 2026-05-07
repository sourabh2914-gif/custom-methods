import type { WalnutContext, WalnutWebContext } from './walnut';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** @walnut_method
 * name: Upload Latest Downloaded File
 * description: Upload the latest downloaded file to ${selector}
 * actionType: custom_upload_latest_downloaded_file
 * context: web
 * needsLocator: false
 * category: File Handling
 */
export async function uploadLatestDownloadedFile(ctx: WalnutContext) {
  // args[0] = file input selector (from ${selector})
  const selector = ctx.args[0];

  // Resolve the downloads folder (cross-platform)
  const downloadsDir = path.join(os.homedir(), 'Downloads');

  if (!fs.existsSync(downloadsDir)) {
    throw new Error('Downloads folder not found at: ' + downloadsDir);
  }

  // Read all files in the downloads folder, ignoring sub-directories
  const entries = fs.readdirSync(downloadsDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => {
      const fullPath = path.join(downloadsDir, e.name);
      const stat = fs.statSync(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    })
    .filter((f) => !f.fullPath.endsWith('.crdownload') && !f.fullPath.endsWith('.part')); // skip incomplete downloads

  if (files.length === 0) {
    throw new Error('No files found in Downloads folder: ' + downloadsDir);
  }

  // Sort descending by modification time — first entry is the latest file
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latestFile = files[0].fullPath;

  ctx.log('Latest downloaded file: ' + latestFile);

  // Upload the file to the specified input element
  const webCtx = ctx as WalnutWebContext;
  await webCtx.fileUpload(selector, latestFile);

  ctx.log('File uploaded successfully to selector: ' + selector);
}
