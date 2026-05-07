import type { WalnutContext } from './walnut';
import * as path from 'path';
import * as os from 'os';

/** @walnut_method
 * name: Click and Capture Download
 * description: Click ${downloadTriggerSelector} to trigger download and store file path in $[downloadedFilePath]
 * actionType: custom_click_and_capture_download
 * context: web
 * needsLocator: false
 * category: File Handling
 */
export async function clickAndCaptureDownload(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  // ctx.args[0] = selector that triggers the download (from ${downloadTriggerSelector})
  // ctx.args[1] = "downloadedFilePath" (from $[downloadedFilePath]) - variable name to store path
  const triggerSelector = ctx.args[0];
  const outputVar = ctx.args[1];

  ctx.log('Waiting for download triggered by: ' + triggerSelector);

  // Listen for download BEFORE clicking to avoid race condition
  const [download] = await Promise.all([
    ctx.page.waitForEvent('download'),
    ctx.page.click(triggerSelector),
  ]);

  const fileName = download.suggestedFilename();
  const savePath = path.join(os.tmpdir(), 'walnut_dl_' + Date.now() + '_' + fileName);
  await download.saveAs(savePath);

  ctx.log('Downloaded file saved to: ' + savePath);
  ctx.setVariable(outputVar, savePath);
}

/** @walnut_method
 * name: Upload Downloaded File
 * description: Upload file from $[downloadedFilePath] to ${uploadInputSelector}
 * actionType: custom_upload_downloaded_file
 * context: web
 * needsLocator: false
 * category: File Handling
 */
export async function uploadDownloadedFile(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;

  // ctx.args[0] = "downloadedFilePath" (from $[downloadedFilePath]) - read stored path
  // ctx.args[1] = selector of the file input element (from ${uploadInputSelector})
  const filePath = ctx.getVariable(ctx.args[0]);
  const uploadSelector = ctx.args[1];

  if (!filePath) {
    throw new Error(
      'No downloaded file path in variable "' + ctx.args[0] + '". Run "Click and Capture Download" first.'
    );
  }

  ctx.log('Uploading ' + filePath + ' to ' + uploadSelector);
  await ctx.fileUpload(uploadSelector, filePath);
  ctx.log('File uploaded successfully.');
}
