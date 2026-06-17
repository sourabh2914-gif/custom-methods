import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Concatenate and Store
 * description: Concatenate ${param1} and ${param2} with separator ${separator} and store in $[result]
 * actionType: custom_concatenate_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function concatenateAndStore(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0]              — first value (literal or runtime variable)
  //   args[1]              — second value (literal or runtime variable)
  //   args[2]              — separator string (e.g. " ", "-", ", ")
  //                          Use " " for a space between names
  //   args[3]              — output variable name (from $[result])
  //
  // Example descriptions:
  //   "Concatenate ${firstName} and ${lastName} with separator ${separator} and store in $[fullName]"
  //   test data: { firstName: "John", lastName: "Doe", separator: " " }
  //   → stores "John Doe"
  //
  //   "Concatenate ${firstName} and ${lastName} with separator ${separator} and store in $[fullName]"
  //   test data: { firstName: "John", lastName: "Doe", separator: "-" }
  //   → stores "John-Doe"
  //
  //   "Concatenate $[firstName] and $[lastName] with separator ${separator} and store in $[fullName]"
  //   → reads runtime variables firstName and lastName, joins with separator

  const allArgs: string[] = (ctx as any).args ?? [];

  if (allArgs.length < 4) {
    throw new Error(
      'concatenateAndStore requires: param1, param2, separator, and output variable ($[result]).'
    );
  }

  const outputVar  = allArgs[allArgs.length - 1];               // last arg  = $[result]
  const separator  = allArgs[allArgs.length - 2];               // second-to-last = separator
  const valueArgs  = allArgs.slice(0, allArgs.length - 2);      // all before separator = values

  const resolvedParts: string[] = valueArgs.map((arg, i) => {
    const fromVar = ctx.getVariable(arg);
    if (fromVar !== undefined && fromVar !== null) {
      ctx.log(`arg[${i}] "${arg}" → resolved from runtime variable: "${fromVar}"`);
      return String(fromVar);
    }
    ctx.log(`arg[${i}] "${arg}" → used as literal value`);
    return String(arg);
  });

  const concatenated = resolvedParts.join(separator);
  ctx.log(`Separator: "${separator}" | Final value: "${concatenated}"`);
  ctx.setVariable(outputVar, concatenated);
}
