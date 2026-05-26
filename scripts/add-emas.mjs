/**
 * Adds EMA indicators to the active TradingView chart via the TradingViewApi.
 *
 * Usage:
 *   node scripts/add-emas.mjs            # adds default EMA set (9, 21, 50, 200)
 *   node scripts/add-emas.mjs 9 21 50    # adds specific EMA periods
 *
 * Requires launch-browser.mjs to be running first.
 */

import { getTradingViewTarget, createCDPSession } from './cdp.mjs';

const periods = process.argv.slice(2).map(Number).filter(Boolean);
const EMA_PERIODS = periods.length ? periods : [9, 21, 50, 200];

console.log(`Adding EMAs: ${EMA_PERIODS.join(', ')}`);

const target = await getTradingViewTarget();
console.log(`Connected to: ${target.url.slice(0, 80)}`);

const cdp = createCDPSession(target.id);

// Check TradingViewApi availability
const apiCheck = await cdp.evaluate(`(function() {
  const ac = typeof TradingViewApi !== 'undefined' && TradingViewApi.activeChart && TradingViewApi.activeChart();
  if (!ac) return JSON.stringify({ error: 'TradingViewApi or activeChart() not available' });
  const proto = Object.getPrototypeOf(ac);
  const methods = proto ? Object.getOwnPropertyNames(proto).filter(k => typeof ac[k] === 'function') : [];
  const studyMethods = methods.filter(k =>
    k.toLowerCase().includes('study') ||
    k.toLowerCase().includes('create') ||
    k.toLowerCase().includes('add') ||
    k.toLowerCase().includes('indicator')
  );
  return JSON.stringify({
    hasCreateStudy: typeof ac.createStudy === 'function',
    studyRelatedMethods: studyMethods,
  });
})()`);

console.log('\nActiveChart inspection:', apiCheck);

let info;
try { info = JSON.parse(apiCheck); } catch { info = {}; }

if (info.error) {
  console.error('\nError:', info.error);
  console.error('Make sure TradingView chart is loaded and you are logged in.');
  cdp.close();
  process.exit(1);
}

if (!info.hasCreateStudy) {
  console.error('\ncreateStudy() not found. Available study-related methods:', info.studyRelatedMethods);
  cdp.close();
  process.exit(1);
}

// Add each EMA
for (const period of EMA_PERIODS) {
  const result = await cdp.evaluate(`(function() {
    try {
      const ac = TradingViewApi.activeChart();
      // createStudy(name, forceOverlay, lock, inputs, overrides, options)
      const study = ac.createStudy('Moving Average Exponential', false, false, [${period}]);
      return JSON.stringify({ ok: true, period: ${period}, id: String(study) });
    } catch(e) {
      return JSON.stringify({ ok: false, period: ${period}, error: e.message });
    }
  })()`);

  let r;
  try { r = JSON.parse(result); } catch { r = { raw: result }; }

  if (r.ok) {
    console.log(`  EMA(${period}) added — study id: ${r.id}`);
  } else {
    console.error(`  EMA(${period}) failed: ${r.error || JSON.stringify(r)}`);
  }
}

cdp.close();
console.log('\nDone.');
