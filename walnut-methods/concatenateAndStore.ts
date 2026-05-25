import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Concatenate and Store
 * description: Concatenate ${param1} and ${param2} and store in $[result]
 * actionType: custom_concatenate_and_store
 * context: shared
 * needsLocator: false
 * category: Data Processing
 */
export async function concatenateAndStore(ctx: WalnutContext) {
  // ctx.args layout:
  //   args[0] .. args[n-2] — values to concatenate.
  //                          Each arg can be:
  //                            - a runtime variable name  → resolved via ctx.getVariable()
  //                            - a literal string value   → used as-is (including spaces/separators)
  //   args[n-1]            — output variable name (from $[result])
  //
  // Example description:
  //   "Concatenate ${firstName} and ${lastName} and store in $[fullName]"
  //   → args = ["John", "Doe", "fullName"]  → stores "JohnDoe"
  //
  //   "Concatenate ${firstName} and ${separator} and ${lastName} and store in $[fullName]"
  //   where separator = " "
  //   → args = ["John", " ", "Doe", "fullName"]  → stores "John Doe"
  //
  //   "Concatenate $[firstName] and $[lastName] and store in $[fullName]"
  //   → args = ["firstName", "lastName", "fullName"]
  //   → reads ctx.getVariable("firstName") and ctx.getVariable("lastName") → stores combined value

  const allArgs: string[] = (ctx as any).args ?? [];

  if (allArgs.length < 2) {
    throw new Error(
      'concatenateAndStore requires at least one value argument and one output variable argument.'
    );
  }

  const outputVar = allArgs[allArgs.length - 1];          // last arg = $[result]
  const valueArgs = allArgs.slice(0, allArgs.length - 1); // all preceding args = values

  const resolvedParts: string[] = valueArgs.map((arg, i) => {
    // First, try to resolve as a runtime variable
    const fromVar = ctx.getVariable(arg);
    if (fromVar !== undefined && fromVar !== null) {
      ctx.log(`arg[${i}] "${arg}" → resolved from runtime variable: "${fromVar}"`);
      return String(fromVar);
    }
    // Otherwise use the raw value as-is (handles literals, spaces, separators, etc.)
    ctx.log(`arg[${i}] "${arg}" → used as literal value`);
    return String(arg);
  });

  // Join all parts directly — spaces/separators are already part of the resolved values
  const concatenated = resolvedParts.join('');
  ctx.log(`Final concatenated value: "${concatenated}"`);
  ctx.setVariable(outputVar, concatenated);
}
