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

## Scripts

| Script | What it does |
|--------|-------------|
| `npm run launch` | Opens Chrome with TradingView, waits for API |
| `npm run insert-emas` | Adds EMA 8/21/50 with colors, sets symbol to FLEX |
| `npm run add-emas` | Adds EMA 9/21/50/200, accepts custom periods as args |
| `npm run screenshot` | Saves a PNG of the chart to your Desktop |

## Notes

- Keep `npm run launch` running in one terminal while using other scripts
- Chrome profile is saved in `.chrome-profile/` so you stay logged in between sessions
- On Mac/Windows, Chrome is detected automatically. Set `CHROME_BIN` env var to override
