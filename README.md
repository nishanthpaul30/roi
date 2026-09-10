# AI Usage Analytics Dashboard

A centralised dashboard that transforms raw AI tool usage logs into strategic intelligence — helping leadership understand ROI, adoption, and efficiency across the entire organisation.

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install dependencies
```bash
npm install
```

### Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Login credentials:**
- Username: `admin`
- Password: `admin123`

---

## Data Source

The application uses a single CSV file as its data source:

```
ai_usage_data.csv
```

### CSV Column Structure

| Column | Description |
|---|---|
| `AI Tool Flag` | `chatgpt` / `copilot` / `claude` |
| `User Mail` | User email address |
| `Display Name` | User full name |
| `Activity Date` | `YYYY-MM-DD` |
| `Month_Year` | e.g. `March_2026` |
| `Month Id` | e.g. `202603` |
| `Period Start Date` | `DD/MM/YYYY` |
| `Period End Date` | `DD/MM/YYYY` |
| `Token Consumption` | Raw token count per activity |
| `Daily Billable Tokens` | Tokens counted against billing quota |
| `Cost in USD` | Actual billed cost |
| `Org Service Line` | e.g. `Consulting`, `Technology`, `Power` |
| `Org Sub Service Line` | e.g. `Banking`, `Strategy` |
| `Country` | Country name |
| `Region` | e.g. `Middle East`, `ANZ` |
| `Management Region` | `EMEA` / `APAC` / `Americas` |
| `Project Investment Code` | e.g. `PRJ-PWR-5533` |

---

## Updating the Data

When you receive a new AI usage export, follow these three steps:

### Step 1 — Replace the CSV file

Replace `ai_usage_data.csv` in the project root with your new export.  
Keep the **same filename** and **same column structure**.

### Step 2 — Regenerate the embedded fallback

The app uses an embedded TypeScript copy of the CSV (`src/lib/data/rawCsvData.ts`) as a fallback for Cloudflare Pages (which cannot read the filesystem at runtime).

Run this command to keep it in sync:

```bash
npm run embed-csv
```

You should see output like:
```
✅ rawCsvData.ts updated successfully.
   Source : ai_usage_data.csv
   Rows   : 1001
   Output : src/lib/data/rawCsvData.ts
   Size   : 191.2 KB
```

### Step 3 — Commit both files

Always commit `ai_usage_data.csv` and `src/lib/data/rawCsvData.ts` together:

```bash
git add ai_usage_data.csv src/lib/data/rawCsvData.ts
git commit -m "chore: update AI usage dataset"
git push
```

> **Why two files?**  
> `ai_usage_data.csv` is used in local/Node.js environments via the filesystem.  
> `rawCsvData.ts` is the Cloudflare Pages edge runtime fallback (no filesystem access on edge).  
> `npm run embed-csv` keeps them in sync.

---

## Deployment

### Cloudflare Pages

1. Connect the repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `.next`
4. No environment variables required

The app automatically uses the embedded `rawCsvData.ts` on the Cloudflare edge runtime.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server (Node.js) |
| `npm run embed-csv` | Re-embed `ai_usage_data.csv` into `rawCsvData.ts` for deployment |

---

## Project Structure

```
roi/
├── ai_usage_data.csv              # Primary data source — replace to update data
├── scripts/
│   └── embedCsv.js               # Script to embed CSV into TypeScript for deployment
├── src/
│   ├── app/                       # Next.js pages
│   │   ├── page.tsx               # Executive Overview
│   │   └── dashboard/
│   │       ├── roi/               # Token & Spend ROI
│   │       ├── teams/             # Org & Regional Analytics
│   │       ├── users/             # User Usage & Spend
│   │       └── metrics-derivation/ # Metrics Reference Guide
│   ├── components/
│   │   ├── layout/                # AppShell, Sidebar, GlobalFilterBar
│   │   └── ui/                    # KpiCard, MetricChart, DataTable, etc.
│   ├── context/
│   │   └── AuthContext.tsx        # Authentication state
│   ├── hooks/
│   │   └── useMetricsData.ts      # Data fetching hook
│   └── lib/
│       ├── data/
│       │   ├── csvLoader.ts       # CSV parser & in-memory cache
│       │   └── rawCsvData.ts      # Embedded CSV fallback (auto-generated)
│       └── metrics/               # Calculation engine
```
