import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Comparison Operator
 * description: Compare ${actualValue} using ${operator} against ${expectedValue}
 * actionType: custom_comparison_operator
 * context: shared
 * needsLocator: false
 * category: Verification
 */
export async function comparisonOperator(ctx: WalnutContext) {
  const c = ctx as any;
  // ctx.args[0] = actualValue  — the actual value to be validated
  // ctx.args[1] = operator     — comparison operator string
  // ctx.args[2] = expectedValue — the value to validate against

  const rawActual: string | undefined = c.args?.[0];
  const operator: string | undefined = c.args?.[1];
  const rawExpected: string | undefined = c.args?.[2];

  if (rawActual == null) throw new Error('actualValue argument is missing');
  if (!operator) throw new Error('operator argument is missing');
  if (rawExpected == null) throw new Error('expectedValue argument is missing');

  // Resolve $[varName] runtime variable placeholders in actualValue and expectedValue
  const resolve = (val: string): string =>
    val.replace(/\$\[([^\]]+)\]/g, (_match, varName) => {
      const stored = c.getVariable(varName);
      if (stored == null) throw new Error(`Runtime variable "$[${varName}]" is not set`);
      return stored;
    });

  const actualStr = resolve(rawActual);
  const expectedStr = resolve(rawExpected);

  c.log(`actualValue  : "${actualStr}"`);
  c.log(`operator     : "${operator}"`);
  c.log(`expectedValue: "${expectedStr}"`);

  // Attempt numeric comparison when both sides are numeric
  const actualNum = parseFloat(actualStr);
  const expectedNum = parseFloat(expectedStr);
  const bothNumeric = !isNaN(actualNum) && !isNaN(expectedNum);

  let result: boolean;

  switch (operator.trim().toLowerCase()) {
    case 'equals':
      result = actualStr === expectedStr;
      break;

    case 'not_equals':
      result = actualStr !== expectedStr;
      break;

    case 'greater_than':
      if (!bothNumeric) throw new Error(`operator "greater_than" requires numeric values, got "${actualStr}" and "${expectedStr}"`);
      result = actualNum > expectedNum;
      break;

    case 'greater_than_or_equal_to':
      if (!bothNumeric) throw new Error(`operator "greater_than_or_equal_to" requires numeric values, got "${actualStr}" and "${expectedStr}"`);
      result = actualNum >= expectedNum;
      break;

    case 'lesser_than':
      if (!bothNumeric) throw new Error(`operator "lesser_than" requires numeric values, got "${actualStr}" and "${expectedStr}"`);
      result = actualNum < expectedNum;
      break;

    case 'lesser_than_or_equal_to':
      if (!bothNumeric) throw new Error(`operator "lesser_than_or_equal_to" requires numeric values, got "${actualStr}" and "${expectedStr}"`);
      result = actualNum <= expectedNum;
      break;

    case 'contains':
      result = actualStr.includes(expectedStr);
      break;

    case 'does_not_contain':
      result = !actualStr.includes(expectedStr);
      break;

    default:
      throw new Error(
        `Unknown operator "${operator}". Valid operators: equals, not_equals, greater_than, greater_than_or_equal_to, lesser_than, lesser_than_or_equal_to, contains, does_not_contain`
      );
  }

  c.log(`Comparison result: ${result}`);

  if (!result) {
    throw new Error(
      `Comparison failed: "${actualStr}" ${operator} "${expectedStr}" evaluated to false`
    );
  }

  c.log(`Comparison passed: "${actualStr}" ${operator} "${expectedStr}"`);
}
