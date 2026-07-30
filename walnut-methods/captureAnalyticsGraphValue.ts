import type { WalnutContext } from './walnut';

/** @walnut_method
 * name: Capture Analytics Graph Value
 * description: Capture Analytics graph value for subVital ${subVitalName} recordedBy ${recordedByType} and store in $[graphValue]
 * actionType: custom_capture_analytics_graph_value
 * context: web
 * needsLocator: false
 * category: Analytics
 */
export async function captureAnalyticsGraphValue(ctx: WalnutContext) {
  // ctx.args layout (resolved from description placeholders, in order):
  //   args[0] = value of ${subVitalName}  — e.g. "Flexor"
  //   args[1] = value of ${recordedByType} — e.g. "doctor"
  //   args[2] = "graphValue" (from $[graphValue]) — runtime variable name to store the result
  //
  // targetDate is auto-generated as today's date at runtime (no user input needed).
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
  const outputVar       = String(c.args[2] ?? '').trim();

  if (!subVitalName)   throw new Error('[CaptureAnalyticsGraphValue] subVitalName (args[0]) is required.');
  if (!recordedByType) throw new Error('[CaptureAnalyticsGraphValue] recordedByType (args[1]) is required.');
  if (!outputVar)      throw new Error('[CaptureAnalyticsGraphValue] graphValue variable name (args[2]) is required.');

  // Auto-generate today's date in multiple formats to match whatever label the API uses.
  // Candidates tried in order: "Jul 30", "Jul 30 2026", "2026-07-30", "07/30/2026"
  const _now = new Date();
  const _monthShort = _now.toLocaleString('en-US', { month: 'short' }); // "Jul"
  const _day        = _now.getDate();                                    // 30
  const _year       = _now.getFullYear();                                // 2026
  const _mm         = String(_now.getMonth() + 1).padStart(2, '0');
  const _dd         = String(_day).padStart(2, '0');
  const todayFormats: string[] = [
    `${_monthShort} ${_day}`,                          // "Jul 30"
    `${_monthShort} ${_dd}`,                           // "Jul 30" (zero-padded)
    `${_monthShort} ${_day}, ${_year}`,                // "Jul 30, 2026"
    `${_monthShort} ${_dd} ${_year}`,                  // "Jul 30 2026"
    `${_year}-${_mm}-${_dd}`,                          // "2026-07-30"
    `${_mm}/${_dd}/${_year}`,                          // "07/30/2026"
    `${_dd}/${_mm}/${_year}`,                          // "30/07/2026"
  ];
  ctx.log(`[CaptureAnalyticsGraphValue] Today's date candidates: [${todayFormats.join(', ')}]`);

  const urlPattern: string  = String(c.params?.analyticsApiUrlPattern ?? 'analytics').trim();
  const timeoutMs: number   = Number(c.params?.analyticsApiTimeout ?? 15000);

  ctx.log(`[CaptureAnalyticsGraphValue] Inputs — subVitalName: "${subVitalName}", recordedByType: "${recordedByType}", outputVar: "${outputVar}"`);
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

  // Find today's date by trying each format candidate against the date array.
  let dateIndex = -1;
  let matchedFormat = '';
  for (const fmt of todayFormats) {
    const idx = dateArray.findIndex((d) => d.toLowerCase() === fmt.toLowerCase());
    if (idx !== -1) {
      dateIndex = idx;
      matchedFormat = fmt;
      break;
    }
  }

  if (dateIndex === -1) {
    throw new Error(
      `[CaptureAnalyticsGraphValue] Today's date not found in the ${usedKey} array. ` +
      `Tried formats: [${todayFormats.join(', ')}]. ` +
      `Available dates in response: [${dateArray.join(', ')}]`
    );
  }

  ctx.log(`[CaptureAnalyticsGraphValue] Today's date matched as "${matchedFormat}" at index ${dateIndex}`);

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
      `for subVitalName="${subVitalName}", recordedByType="${recordedByType}", targetDate="${matchedFormat}" (today). ` +
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
