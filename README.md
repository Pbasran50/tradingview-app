# tradingview-app

Automate TradingView chart indicators from the command line using Chrome DevTools Protocol.

## Setup (run once)

Requires **Node.js 18+** and **Google Chrome** installed locally.

```bash
git clone https://github.com/Pbasran50/tradingview-app
cd tradingview-app
```

## Usage

### Step 1 — Launch the browser (keep this running)

```bash
npm run launch
```

- Opens Chrome and navigates to TradingView
- **Log in to your TradingView account** in the browser window
- Open the chart you want to work with
- Wait for the terminal to print `TradingViewApi is available`

### Step 2 — Add indicators (new terminal tab)

Add EMA 8 (blue), 21 (orange), 50 (red) and switch symbol to FLEX:

```bash
npm run insert-emas
```

Add EMA 9, 21, 50, 200 (default set):

```bash
npm run add-emas
```

Add custom EMA periods:

```bash
node scripts/add-emas.mjs 10 20 100
```

### Step 3 — Read off exact price levels

Once indicators are on the chart, print the current price and every
EMA/SMA value, with % distance from price — useful for setting alerts
before a stock reaches a target level:

```bash
npm run levels
```

Levels within 2% of the current price are flagged with 🎯. Pass a
different threshold as an argument, e.g. `node scripts/levels.mjs 3` for 3%.

## Scripts

| Script | What it does |
|--------|-------------|
| `npm run launch` | Opens Chrome with TradingView, waits for API |
| `npm run setup-flex` | **Full setup**: daily candles, EMA 8/21/50/200, SMA 50/200, RSI, MACD, Volume, Pivot Points + price data & news |
| `npm run insert-emas` | Adds EMA 8/21/50 with colors, sets symbol to FLEX |
| `npm run add-emas` | Adds EMA 9/21/50/200, accepts custom periods as args |
| `npm run levels` | Prints current price + every MA value with % distance, flags levels near price |
| `npm run screenshot` | Saves a PNG of the chart to your Desktop |

## Chart design notes

- **EMAs are solid lines** (8/21/50/200) — fast-reacting trend levels.
- **SMAs are dashed lines** (50/200) — classic institutional support/resistance
  used for IBD/Minervini-style buy points; visually distinct from the EMAs.
- Every moving average shows its **current value on the price scale** (right
  edge of the chart), so exact levels are readable at a glance.
- **Volume gets its own pane** below price instead of being overlaid on
  candles, so price action stays uncluttered.

## Notes

- Keep `npm run launch` running in one terminal while using other scripts
- Chrome profile is saved in `.chrome-profile/` so you stay logged in between sessions
- On Mac/Windows, Chrome is detected automatically. Set `CHROME_BIN` env var to override
