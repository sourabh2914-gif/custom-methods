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

  const min = Math.pow(10, count - 1);
  const max = Math.pow(10, count) - 1;
  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

  const result = `${prefix}${randomNum}${suffix}`;
  ctx.log(`Generated random numeric: "${result}" (count: ${count}, prefix: "${prefix}", suffix: "${suffix}")`);

  ctx.setVariable(outputVar, result);
}
