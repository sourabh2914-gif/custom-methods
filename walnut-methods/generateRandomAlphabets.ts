import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Generate Random Alphabets
 * description: Generate random alphabets with count ${count} prefix ${prefix} suffix ${suffix} and store in $[result]
 * actionType: custom_generate_random_alphabets
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function generateRandomAlphabets(ctx: WalnutContext) {
  // ctx.args[0] = value of ${count} — number of random alphabet characters to generate
  // ctx.args[1] = value of ${prefix} — string to prepend
  // ctx.args[2] = value of ${suffix} — string to append
  // ctx.args[3] = "result" (from $[result]) — runtime variable name to store into
  const count = parseInt(ctx.args[0], 10);
  const prefix = ctx.args[1] || '';
  const suffix = ctx.args[2] || '';
  const outputVar = ctx.args[3];

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let randomStr = '';
  for (let i = 0; i < count; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const result = `${prefix}${randomStr}${suffix}`;
  ctx.log(`Generated random alphabets: "${result}" (count: ${count}, prefix: "${prefix}", suffix: "${suffix}")`);

  ctx.setVariable(outputVar, result);
}
