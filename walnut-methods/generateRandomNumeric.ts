import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Generate Random Numeric
 * description: Generate random numeric with count ${count} prefix ${prefix} suffix ${suffix} and store in $[result]
 * actionType: custom_generate_random_numeric
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function generateRandomNumeric(ctx: WalnutContext) {
  // ctx.args[0] = value of ${count} — number of random digits to generate
  // ctx.args[1] = value of ${prefix} — string to prepend
  // ctx.args[2] = value of ${suffix} — string to append
  // ctx.args[3] = "result" (from $[result]) — runtime variable name to store into
  const count = parseInt(ctx.args[0], 10);
  const prefix = ctx.args[1] || '';
  const suffix = ctx.args[2] || '';
  const outputVar = ctx.args[3];

  // Generate exactly `count` random digits (first digit is 1-9 to avoid leading zero)
  let randomNum = '';
  for (let i = 0; i < count; i++) {
    const digit = i === 0
      ? Math.floor(Math.random() * 9) + 1   // 1–9 for first digit
      : Math.floor(Math.random() * 10);      // 0–9 for remaining digits
    randomNum += digit;
  }

  const result = `${prefix}${randomNum}${suffix}`;
  ctx.log(`Generated random numeric: "${result}" (count: ${count}, prefix: "${prefix}", suffix: "${suffix}")`);

  ctx.setVariable(outputVar, result);
}
