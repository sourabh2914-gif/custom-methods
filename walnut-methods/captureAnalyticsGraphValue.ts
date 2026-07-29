import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Analytics Graph Value
 * description: Capture Analytics graph value for subVital ${subVitalName} recordedBy ${recordedByType} on date ${targetDate} and store in $[graphValue]
 * actionType: custom_capture_analytics_graph_value
 * context: web
 * needsLocator: false
 * category: Analytics
 */
export async function captureAnalyticsGraphValue(ctx: WalnutContext) {
  // ctx.args layout (resolved from description placeholders, in order):
  //   args[0] = value of ${subVitalName}  — e.g. "Flexor"
  //   args[1] = value of ${recordedByType} — e.g. "doctor"
  //   args[2] = value of ${targetDate}    — e.g. "Jul 29"
  //   args[3] = "graphValue" (from $[graphValue]) — runtime variable name to store the result
  //
  // Optional test-data params (from ctx.params):
  //   ctx.params.analyticsApiUrlPattern — URL substring to match the Analytics API (default: "analytics")
  //   ctx.params.analyticsApiTimeout    — ms to wait for the API response (default: 15000)
  //
  // Flow:
  //   1. Register a Playwright response listener BEFORE any UI interaction triggers the request.
  //   2. Wait up to <timeout> ms for a response whose URL contains the pattern AND body has "series".
  //   3. Parse the JSON body.
  //   4. Find the series entry matching subVitalName + recordedByType.
  //   5. Locate targetDate in the response's dates/labels/categories array.
  //   6. Read data[dateIndex] from the matched series.
  //   7. Store the value in the named runtime variable.

  const c = ctx as any;

  // ── 1. Resolve inputs ──────────────────────────────────────────────────────
  const subVitalName    = String(c.args[0] ?? '').trim();
  const recordedByType  = String(c.args[1] ?? '').trim();
  const targetDate      = String(c.args[2] ?? '').trim();
  const outputVar       = String(c.args[3] ?? '').trim();

  if (!subVitalName)   throw new Error('[CaptureAnalyticsGraphValue] subVitalName (args[0]) is required.');
  if (!recordedByType) throw new Error('[CaptureAnalyticsGraphValue] recordedByType (args[1]) is required.');
  if (!targetDate)     throw new Error('[CaptureAnalyticsGraphValue] targetDate (args[2]) is required.');
  if (!outputVar)      throw new Error('[CaptureAnalyticsGraphValue] graphValue variable name (args[3]) is required.');

  const urlPattern: string  = String(c.params?.analyticsApiUrlPattern ?? 'analytics').trim();
  const timeoutMs: number   = Number(c.params?.analyticsApiTimeout ?? 15000);

  ctx.log(`[CaptureAnalyticsGraphValue] Inputs — subVitalName: "${subVitalName}", recordedByType: "${recordedByType}", targetDate: "${targetDate}", outputVar: "${outputVar}"`);
  ctx.log(`[CaptureAnalyticsGraphValue] Waiting for Analytics API response matching URL pattern: "${urlPattern}" (timeout: ${timeoutMs}ms)`);

  // ── 2. Wait for the Analytics API response ─────────────────────────────────
  // page.waitForResponse() resolves with the FIRST matching response that arrives
  // within the timeout window.  We match on:
  //   (a) URL contains the configured pattern (case-insensitive)
  //   (b) Response body is non-empty JSON containing a "series" array
  //
  // IMPORTANT: call this BEFORE the UI action that triggers the network request.
  // If the request has already been sent (e.g. the page auto-loaded), Playwright
  // still resolves against responses buffered since the last navigation — so the
  // method works both when placed before AND immediately after the triggering UI step.

  let responseBody: any = null;

  try {
    const response = await c.page.waitForResponse(
      async (resp: any) => {
        try {
          // URL must contain the analytics pattern
          if (!resp.url().toLowerCase().includes(urlPattern.toLowerCase())) return false;
          // Only consider successful HTTP responses
          if (resp.status() < 200 || resp.status() >= 300) return false;
          // Body must be valid JSON containing "series"
          const text: string = await resp.text();
          if (!text || !text.includes('"series"')) return false;
          const parsed = JSON.parse(text);
          return Array.isArray(parsed?.series);
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs }
    );

    const rawText: string = await response.text();
    responseBody = JSON.parse(rawText);
    ctx.log(`[CaptureAnalyticsGraphValue] Analytics API response received from: ${response.url()}`);
  } catch (err: any) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] Analytics API response not received within ${timeoutMs}ms. ` +
      `Ensure the URL pattern "${urlPattern}" matches the Analytics endpoint and that the ` +
      `graph has been triggered before or during this step. Original error: ${err?.message ?? err}`
    );
  }

  // ── 3. Validate top-level structure ───────────────────────────────────────
  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('[CaptureAnalyticsGraphValue] Invalid JSON response — could not parse Analytics API body.');
  }

  const series: any[] = responseBody.series;

  if (!Array.isArray(series)) {
    throw new Error(
      '[CaptureAnalyticsGraphValue] "series" array is missing from the Analytics API response. ' +
      `Response keys found: ${Object.keys(responseBody).join(', ') || '(none)'}`
    );
  }

  if (series.length === 0) {
    throw new Error('[CaptureAnalyticsGraphValue] "series" array is empty — no data returned by the Analytics API.');
  }

  // ── 4. Find the matching series entry ─────────────────────────────────────
  // Match is case-insensitive to handle minor casing inconsistencies in the API.
  const matchedSeries = series.find(
    (entry: any) =>
      typeof entry === 'object' &&
      entry !== null &&
      String(entry.subVitalName ?? '').trim().toLowerCase() === subVitalName.toLowerCase() &&
      String(entry.recordedByType ?? '').trim().toLowerCase() === recordedByType.toLowerCase()
  );

  if (!matchedSeries) {
    const available = series.map(
      (e: any) => `{ subVitalName: "${e?.subVitalName}", recordedByType: "${e?.recordedByType}" }`
    ).join('; ');
    throw new Error(
      `[CaptureAnalyticsGraphValue] No series entry found matching subVitalName="${subVitalName}" ` +
      `AND recordedByType="${recordedByType}". ` +
      `Available entries: [${available}]`
    );
  }

  ctx.log(`[CaptureAnalyticsGraphValue] Matched series entry — subVitalName: "${matchedSeries.subVitalName}", recordedByType: "${matchedSeries.recordedByType}"`);

  // ── 5. Resolve the date index ──────────────────────────────────────────────
  // The response may carry the date labels under different keys.
  // We probe common key names in priority order.
  const DATE_ARRAY_KEYS = ['dates', 'labels', 'categories', 'xAxis', 'xLabels', 'dateRange', 'timeLabels'];

  let dateArray: string[] | null = null;
  let usedKey = '';

  for (const key of DATE_ARRAY_KEYS) {
    const candidate = responseBody[key];
    if (Array.isArray(candidate) && candidate.length > 0) {
      dateArray = candidate.map((d: any) => String(d ?? '').trim());
      usedKey = key;
      break;
    }
  }

  // Fallback: check inside the matched series entry itself
  if (!dateArray) {
    for (const key of DATE_ARRAY_KEYS) {
      const candidate = matchedSeries[key];
      if (Array.isArray(candidate) && candidate.length > 0) {
        dateArray = candidate.map((d: any) => String(d ?? '').trim());
        usedKey = `series[].${key}`;
        break;
      }
    }
  }

  if (!dateArray) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] Could not find a dates/labels/categories array in the Analytics API response. ` +
      `Checked keys: ${DATE_ARRAY_KEYS.join(', ')}. ` +
      `Top-level response keys: ${Object.keys(responseBody).join(', ')}`
    );
  }

  ctx.log(`[CaptureAnalyticsGraphValue] Date array found under key "${usedKey}": [${dateArray.join(', ')}]`);

  // Find the index of targetDate (case-insensitive, trimmed)
  const dateIndex = dateArray.findIndex(
    (d) => d.toLowerCase() === targetDate.toLowerCase()
  );

  if (dateIndex === -1) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] targetDate "${targetDate}" not found in the ${usedKey} array. ` +
      `Available dates: [${dateArray.join(', ')}]`
    );
  }

  ctx.log(`[CaptureAnalyticsGraphValue] targetDate "${targetDate}" found at index ${dateIndex}`);

  // ── 6. Extract the data value ──────────────────────────────────────────────
  const dataArray: any[] = matchedSeries.data;

  if (!Array.isArray(dataArray)) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] "data" array is missing from the matched series entry ` +
      `(subVitalName="${subVitalName}", recordedByType="${recordedByType}").`
    );
  }

  if (dateIndex >= dataArray.length) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] Date index ${dateIndex} is out of bounds for the data array ` +
      `(data array length: ${dataArray.length}). ` +
      `This may indicate a mismatch between the dates array and the series data array.`
    );
  }

  const rawValue = dataArray[dateIndex];

  // ── 7. Handle null explicitly — do NOT coerce to 0 ────────────────────────
  if (rawValue === null || rawValue === undefined) {
    ctx.warn(
      `[CaptureAnalyticsGraphValue] data[${dateIndex}] is ${rawValue === null ? 'null' : 'undefined'} ` +
      `for subVitalName="${subVitalName}", recordedByType="${recordedByType}", targetDate="${targetDate}". ` +
      `Storing null in runtime variable $[${outputVar}].`
    );
    ctx.setVariable(outputVar, null);
    ctx.log(`[CaptureAnalyticsGraphValue] Stored null → $[${outputVar}]`);
    return;
  }

  // ── 8. Store the captured value ────────────────────────────────────────────
  const capturedValue = String(rawValue);
  ctx.setVariable(outputVar, capturedValue);
  ctx.log(`[CaptureAnalyticsGraphValue] Captured value: ${capturedValue} → $[${outputVar}]`);
}
