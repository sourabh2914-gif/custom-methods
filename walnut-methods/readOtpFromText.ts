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
  // ctx.args[0] = "textMessage" (from $[textMessage]) — runtime variable name holding the full email/SMS content
  // ctx.args[1] = "otp_code" (from $[otp_code]) — runtime variable name to store the extracted OTP
  const textMessage = ctx.getVariable(ctx.args[0]);
  ctx.log(`TEXT MESSAGE=======================: '${String(textMessage)}`);
  const outputVar = ctx.args[1];

  if (!textMessage) {
    throw new Error(`Runtime variable "$[${ctx.args[0]}]" is empty or not set. Make sure a previous step stores the email/SMS content.`);
  }

  ctx.log(`Extracting OTP from text (length: ${String(textMessage).length} chars)`);

  // Step 1: Find all numeric sequences in the text message
  const allNumbers = String(textMessage).match(/\d+/g) || [];
  ctx.log(`All numeric sequences found: ${JSON.stringify(allNumbers)}`);

  // Step 2: Filter to only sequences that are 4–8 digits long (typical OTP length)
  const otpCandidates = allNumbers.filter(n => n.length >= 4 && n.length <= 8);
  ctx.log(`OTP candidates (4–8 digits): ${JSON.stringify(otpCandidates)}`);

  // Step 3: If no candidates found, throw a descriptive error
  if (otpCandidates.length === 0) {
    throw new Error(`No OTP found. All numbers found: ${JSON.stringify(allNumbers)}. Expected a 4–8 digit numeric code.`);
  }

  // Step 4: Pick the most likely OTP using keyword proximity heuristics
  // Priority: closest number to OTP-related keywords in the text
  const otpKeywords = ['otp', 'code', 'reset', 'verification', 'verify', 'pin', 'password', 'one-time', 'token', 'passcode'];
  const lowerText = String(textMessage).toLowerCase();

  let bestCandidate = otpCandidates[0];

  for (const keyword of otpKeywords) {
    const keywordIndex = lowerText.indexOf(keyword);
    if (keywordIndex === -1) continue;

    // Find the candidate closest (within 50 chars) to the keyword
    for (const candidate of otpCandidates) {
      const candidateIndex = String(textMessage).indexOf(candidate);
      if (candidateIndex !== -1 && Math.abs(candidateIndex - keywordIndex) <= 50) {
        bestCandidate = candidate;
        ctx.log(`Matched OTP "${candidate}" near keyword "${keyword}"`);
        break;
      }
    }
  }

  // Step 5: Store the extracted OTP into the runtime variable
  ctx.log(`Extracted OTP: "${bestCandidate}"`);
  ctx.setVariable(outputVar, bestCandidate);
}
