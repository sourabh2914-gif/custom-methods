import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Comparison Operator
 * description: Compare $[actualValue] using ${operator} against $[expectedValue]
 * actionType: custom_comparison_operator
 * context: shared
 * needsLocator: false
 * category: Verification
 */
export async function comparisonOperator(ctx: WalnutContext) {
  const c = ctx as any;
  // Description: Compare $[actualValue] using ${operator} against $[expectedValue]
  // ctx.args[0] = "actualValue"  — variable NAME from $[actualValue] → read via getVariable()
  // ctx.args[1] = operator value — literal string from ${operator}
  // ctx.args[2] = "expectedValue" — variable NAME from $[expectedValue] → read via getVariable()

  const actualVarName: string | undefined = c.args?.[0];
  const operator: string | undefined = c.args?.[1];
  const expectedVarName: string | undefined = c.args?.[2];

  if (!actualVarName) throw new Error('actualValue argument is missing');
  if (!operator) throw new Error('operator argument is missing');
  if (!expectedVarName) throw new Error('expectedValue argument is missing');

  // Read the runtime variable values
  const actualStr: string = (() => {
    const v = c.getVariable(actualVarName);
    if (v == null) throw new Error(`Runtime variable "$[${actualVarName}]" is not set`);
    return String(v);
  })();

  const expectedStr: string = (() => {
    const v = c.getVariable(expectedVarName);
    if (v == null) throw new Error(`Runtime variable "$[${expectedVarName}]" is not set`);
    return String(v);
  })();

  // Normalize: trim leading/trailing whitespace and collapse internal whitespace.
  // UI-captured text often contains extra spaces, newlines, or non-breaking spaces.
  const normalize = (s: string): string =>
    s.replace(/[\u00a0\u200b\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  const actualNorm   = normalize(actualStr);
  const expectedNorm = normalize(expectedStr);

  c.log(`actualValue  : "${actualNorm}"`);
  c.log(`operator     : "${operator}"`);
  c.log(`expectedValue: "${expectedNorm}"`);

  // Attempt numeric comparison when both sides are numeric
  const actualNum = parseFloat(actualNorm);
  const expectedNum = parseFloat(expectedNorm);
  const bothNumeric = !isNaN(actualNum) && !isNaN(expectedNum);

  let result: boolean;

  switch (operator.trim().toLowerCase()) {
    case 'equals':
      // Case-insensitive, whitespace-normalized equality
      result = actualNorm.toLowerCase() === expectedNorm.toLowerCase();
      break;

    case 'not_equals':
      result = actualNorm.toLowerCase() !== expectedNorm.toLowerCase();
      break;

    case 'equals_exact':
      // Strict exact match (case-sensitive, no normalization beyond trim)
      result = actualNorm === expectedNorm;
      break;

    case 'greater_than':
      if (!bothNumeric) throw new Error(`operator "greater_than" requires numeric values, got "${actualNorm}" and "${expectedNorm}"`);
      result = actualNum > expectedNum;
      break;

    case 'greater_than_or_equal_to':
      if (!bothNumeric) throw new Error(`operator "greater_than_or_equal_to" requires numeric values, got "${actualNorm}" and "${expectedNorm}"`);
      result = actualNum >= expectedNum;
      break;

    case 'lesser_than':
      if (!bothNumeric) throw new Error(`operator "lesser_than" requires numeric values, got "${actualNorm}" and "${expectedNorm}"`);
      result = actualNum < expectedNum;
      break;

    case 'lesser_than_or_equal_to':
      if (!bothNumeric) throw new Error(`operator "lesser_than_or_equal_to" requires numeric values, got "${actualNorm}" and "${expectedNorm}"`);
      result = actualNum <= expectedNum;
      break;

    case 'contains':
      result = actualNorm.toLowerCase().includes(expectedNorm.toLowerCase());
      break;

    case 'does_not_contain':
      result = !actualNorm.toLowerCase().includes(expectedNorm.toLowerCase());
      break;

    default:
      throw new Error(
        `Unknown operator "${operator}". Valid operators: equals, not_equals, equals_exact, greater_than, greater_than_or_equal_to, lesser_than, lesser_than_or_equal_to, contains, does_not_contain`
      );
  }

  c.log(`Comparison result: ${result}`);

  if (!result) {
    throw new Error(
      `Comparison failed: "${actualNorm}" ${operator} "${expectedNorm}" evaluated to false`
    );
  }

  c.log(`Comparison passed: "${actualNorm}" ${operator} "${expectedNorm}"`);
}
