# Pine Script Indicators

Custom pattern detection scripts for TradingView.

## How to add to TradingView (one-time setup)

1. Open TradingView with your chart loaded (`npm run launch`)
2. Click **Pine Editor** at the bottom of the screen
3. Click **Open** → paste the contents of the `.pine` file
4. Click **Add to chart**
5. Repeat for each script

Once added, they stay on your chart and auto-run on any symbol.

---

## Scripts

### `cup-and-handle.pine`
Detects **Cup & Handle** breakouts based on William O'Neil / IBD criteria:
- Cup: U-shaped base, 12–35% depth, 15–200 bars
- Handle: tight pullback ≤ 12%, forms in upper half of cup
- **Green triangle** = breakout on volume surge
- **Yellow dot** = setup currently forming

### `high-tight-flag.pine`
Detects **High Tight Flag** patterns (rarest, most powerful IBD pattern):
- Pole: stock advances 90%+ in prior 35 bars
- Flag: tight consolidation ≤ 25% over 20 bars in upper half of pole
- **Orange flag** = breakout confirmed
- Shows pole gain % on breakout label

### `mini-coil.pine`
Detects **Mini Coil / tight consolidation** (Mark Minervini SEPA style):
- Price contracts into a tight range (≤ 6% wide) with shrinking volatility
- Must be in a confirmed stage 2 uptrend (above rising 50-day MA)
- **Blue shading** = coil zone forming
- **Aqua triangle** = breakout from coil

### `trendline-touches.pine`
Highlights **3-touch trendline** levels:
- Marks pivot highs/lows with small triangles
- **Red squares** = confirmed 3-touch resistance level
- **Green squares** = confirmed 3-touch support level
- **Large green/red triangles** = breakout or breakdown from confirmed level
- Set alerts to be notified when a 3-touch level breaks

---

## Setting Alerts

For any script, right-click the indicator name on the chart → **Add alert** → select the condition (e.g. "Cup & Handle Breakout") → set notification method.
