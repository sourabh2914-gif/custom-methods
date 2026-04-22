import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Split Text and Store
 * description: Split ${text} by delimiter ${delimiter} and store in $[result]
 * actionType: custom_split_text
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function splitText(ctx: WalnutContext) {
  // ctx.args[0] = value of ${text}
  // ctx.args[1] = value of ${delimiter}
  // ctx.args[2] = "result" (from $[result]) — the runtime variable name to store into
  const text = ctx.args[0];
  const delimiter = ctx.args[1];
  const outputVar = ctx.args[2];

  const parts = text.split(delimiter);
  ctx.log(`Split "${text}" by "${delimiter}" → ${parts.length} part(s): ${JSON.stringify(parts)}`);

  ctx.setVariable(outputVar, parts[1]);
}
