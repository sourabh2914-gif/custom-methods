import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Split Date and Store
 * description: Split $[date] by delimiter ${delimiter} at index ${index} and store in $[result]
 * actionType: custom_split_date
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function splitDate(ctx: WalnutContext) {
  // ctx.args[0] = "date"      (from $[date])      — runtime variable name; read via getVariable
  // ctx.args[1] = value of ${delimiter}           — e.g. "-", "/", " ", "."
  // ctx.args[2] = value of ${index}               — 0-based index of the part to extract
  // ctx.args[3] = "result"    (from $[result])    — runtime variable name to store the extracted part

  const dateValue = ctx.getVariable(ctx.args[0]);
  const delimiter = ctx.args[1];
  const index     = parseInt(ctx.args[2], 10);
  const outputVar = ctx.args[3];

  if (!dateValue) {
    throw new Error(`[SplitDate] Runtime variable "${ctx.args[0]}" is empty or not set.`);
  }

  if (isNaN(index)) {
    throw new Error(`[SplitDate] Index "${ctx.args[2]}" is not a valid number.`);
  }

  const parts = dateValue.split(delimiter);
  ctx.log(`[SplitDate] "${dateValue}" split by "${delimiter}" → ${parts.length} part(s): ${JSON.stringify(parts)}`);

  if (index < 0 || index >= parts.length) {
    throw new Error(
      `[SplitDate] Index ${index} is out of range — "${dateValue}" split by "${delimiter}" yields only ${parts.length} part(s) (indices 0–${parts.length - 1}).`
    );
  }

  const extracted = parts[index];
  ctx.log(`[SplitDate] Extracted index ${index}: "${extracted}" → $[${outputVar}]`);
  ctx.setVariable(outputVar, extracted);
}
