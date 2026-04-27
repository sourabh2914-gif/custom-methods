import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Read OTP From Text Message
 * description: Read OTP from text message $[textMessage] and store in $[otp_code]
 * actionType: custom_read_otp_from_text
 * context: shared
 * needsLocator: false
 * category: Authentication
 */
export async function readOtpFromText(ctx: WalnutContext) {
  // ctx.args[0] = "textMessage" (from $[textMessage]) — runtime variable holding the full email/SMS content
  // ctx.args[1] = "otp_code" (from $[otp_code]) — runtime variable name to store the extracted OTP
  const textMessage = String(ctx.getVariable(ctx.args[0]));
  const outputVar = ctx.args[1];

  ctx.log(`Extracting OTP from text message`);

  // Extract the number that comes immediately after "Your password reset code is "
  const match = textMessage.match(/Your password reset code is (\d+)/i);

  if (!match || !match[1]) {
    throw new Error(`Could not find OTP after "Your password reset code is " in the text message.`);
  }

  const otp = match[1];
  ctx.log(`Extracted OTP=======================================================: "${otp}"`);
  ctx.setVariable(outputVar, otp);
}
