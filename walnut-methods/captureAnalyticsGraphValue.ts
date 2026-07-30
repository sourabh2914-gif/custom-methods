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

  const timeoutMs: number = Number(c.params?.analyticsApiTimeout ?? 15000);

  ctx.log(`[CaptureAnalyticsGraphValue] Inputs — subVitalName: "${subVitalName}", recordedByType: "${recordedByType}", outputVar: "${outputVar}"`);
  ctx.log(`[CaptureAnalyticsGraphValue] Reloading page and waiting for a JSON response with "series" array (timeout: ${timeoutMs}ms)`);

  // ── 2. Wait for the Analytics API response ─────────────────────────────────
  // Use page.on('response') to collect ALL responses during the reload.
  // waitForResponse with an async body-reading predicate is unreliable because
  // Playwright may already have consumed the body stream before the predicate runs.
  // Instead: attach a listener, reload, then inspect collected bodies.

  let responseBody: any = null;

  await new Promise<void>((resolve, reject) => {
    const collected: Array<{ url: string; body: any }> = [];
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      c.page.off('response', onResponse);
      if (collected.length === 0) {
        reject(new Error(
          `[CaptureAnalyticsGraphValue] No JSON responses were captured within ${timeoutMs}ms after page reload. ` +
          `Ensure the Analytics graph page is open before this step runs.`
        ));
      } else {
        reject(new Error(
          `[CaptureAnalyticsGraphValue] ${collected.length} JSON response(s) were captured but none contained a "series" array. ` +
          `URLs seen: [${collected.map(r => r.url).join(', ')}]`
        ));
      }
    }, timeoutMs);

    const onResponse = async (resp: any) => {
      try {
        if (resp.status() < 200 || resp.status() >= 300) return;
        const ct: string = resp.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        const text: string = await resp.text();
        if (!text || !text.includes('"series"')) return;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed?.series) || parsed.series.length === 0) {
          collected.push({ url: resp.url(), body: parsed });
          return;
        }
        // Found it — clean up and resolve
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        c.page.off('response', onResponse);
        responseBody = parsed;
        ctx.log(`[CaptureAnalyticsGraphValue] Analytics API response captured from: ${resp.url()}`);
        resolve();
      } catch {
        // Ignore parse errors on individual responses
      }
    };

    c.page.on('response', onResponse);
    // Reload AFTER the listener is attached
    c.page.reload({ waitUntil: 'domcontentloaded' }).catch((err: any) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutHandle);
        c.page.off('response', onResponse);
        reject(new Error(`[CaptureAnalyticsGraphValue] Page reload failed: ${err?.message ?? err}`));
      }
    });
  });

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
