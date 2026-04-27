import type { WalnutContext, WalnutWebContext } from './walnut';

/** @walnut_method
 * name: Enter OTP Fields
 * description: Enter OTP $[otp_code] into sequential input fields
 * actionType: custom_enter_otp_fields
 * context: web
 * needsLocator: false
 * category: Authentication
 */
export async function enterOtpFields(ctx: WalnutContext) {
  // ctx.args[0] = "otp_code" (from $[otp_code]) — runtime variable name holding the OTP string
  const otp = String(ctx.getVariable(ctx.args[0]));

  ctx.log(`OTP in enter OTP method ###############: "${otp}"`);

  const xPath = ctx.getVariable(ctx.args[1]);

  if (!otp || otp.trim() === '') {
    throw new Error(`OTP value is empty. Check that $[${ctx.args[0]}] was set by a previous step.`);
  }

  if (!/^\d{4,8}$/.test(otp)) {
    throw new Error(`Invalid OTP "${otp}". Expected a 4–8 digit numeric string.`);
  }

  ctx.log(`Entering OTP "${otp}" into ${otp.length} sequential input fields`);

  // Cast to WalnutWebContext to access ctx.page (Playwright Page instance)
  const webCtx = ctx as WalnutWebContext;

  // Use Playwright's locator API to get all matching input fields at once
  // Equivalent to Java's By.xpath("(//input[@type='text'])[i+1]")
  // const inputFields = webCtx.page.locator('input[type="text"]');
  // const fieldCount = await inputFields.count();

  // ctx.log(`Found ${fieldCount} input field(s) on the page`);

  // if (fieldCount < otp.length) {
  //   throw new Error(`Not enough input fields: found ${fieldCount} but OTP has ${otp.length} digits.`);
  // }

  // Iterate over each digit and enter it into the nth input field (0-indexed)
  // Equivalent to Java's (//input[@type='text'])[i+1]
  for (let i = 0; i < otp.length; i++) {
    const digit = otp.charAt(i);

    ctx.log(`BEFORE FINDING ELEMENT`);
    // Get the nth input field by index
    const field = webCtx.page.locator(xPath+'['+(i+1)+']');
    ctx.log(`EACH OTP FIELD IS: "${field}"`);
    

    // Click to focus, then fill with the single digit
    await field.click();
    await field.fill(digit);

    ctx.log(`Field [${i + 1}]: entered "${digit}"`);
  }

  ctx.log(`OTP entry complete`);
}
