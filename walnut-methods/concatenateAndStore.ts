import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Concatenate and Store
 * description: Concatenates the data of the specified parameters and stores in runtime parameter $[result] - n number of parameters can be added parameter n-1 - The last parameter would be the runtime parameter to store the final value
 * actionType: custom_concatenate_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function concatenateAndStore(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] .. args[n-2] — values to concatenate (resolved from ${paramN} or $[varN])
  //   args[n-1]            — output variable name (from $[result])
  //
  // Each arg is checked: if it looks like a runtime variable name (i.e. getVariable returns
  // a non-undefined value), the stored value is used; otherwise the raw arg string is used.

  const allArgs: string[] = (ctx as any).args ?? [];

  if (allArgs.length < 2) {
    throw new Error(
      'concatenateAndStore requires at least one value argument and one output variable argument.'
    );
  }

  const outputVar = allArgs[allArgs.length - 1];          // last arg = $[result]
  const valueArgs = allArgs.slice(0, allArgs.length - 1); // all but last

  const resolvedParts: string[] = valueArgs.map((arg, i) => {
    // Try to read as a runtime variable first; fall back to the raw string value
    const fromVar = ctx.getVariable(arg);
    if (fromVar !== undefined && fromVar !== null) {
      ctx.log(`arg[${i}] "${arg}" resolved from runtime variable → "${fromVar}"`);
      return String(fromVar);
    }
    ctx.log(`arg[${i}] used as literal value → "${arg}"`);
    return String(arg);
  });

  const concatenated = resolvedParts.join('');
  ctx.log(`Concatenated result: "${concatenated}"`);
  ctx.setVariable(outputVar, concatenated);
}
