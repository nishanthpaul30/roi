# GitHub Copilot Usage & ROI Enterprise Dashboard

A production-ready enterprise analytics dashboard and metric engine built for consuming, normalizing, and visualizing **GitHub Copilot Usage Metrics APIs** (including 1-day, 28-day, NDJSON reports, repository pull requests, user activity, CLI, Copilot App, and 3rd-party agent telemetry).

---

## 🌟 Key Features

* **Complete GitHub Copilot API Coverage**: Captures all API fields, including `totals_by_cli`, `totals_by_copilot_app`, `totals_by_3rd_party_agent`, `pull_requests` (TTM, authoring, reviewing), language features, and IDE breakdowns.
* **Generic Metric & Delta Engine**: Calculates aggregate metrics with period-over-period trend analysis (`DoD`, `WoW`, `MoM`, `rolling7d`, `rolling28d`), absolute deltas, percentage deltas, percentage-point deltas (`pp` for rates), and trend badges (↑ / ↓ / →).
* **17 Dedicated Dashboard Pages**:
  1. Executive Overview (`/`)
  2. Adoption & Engagement (`/dashboard/adoption`)
  3. Code Completion (`/dashboard/completion`)
  4. Chat (`/dashboard/chat`)
  5. Agents (`/dashboard/agents`)
  6. AI Code Generation (`/dashboard/code-gen`)
  7. Models (`/dashboard/models`)
  8. Languages (`/dashboard/languages`)
  9. IDE (`/dashboard/ide`)
  10. CLI (`/dashboard/cli`)
  11. Copilot App (`/dashboard/app`)
  12. Teams (`/dashboard/teams`)
  13. Users (`/dashboard/users`)
  14. Repositories & PRs (`/dashboard/repos`)
  15. Engineering Impact (`/dashboard/impact`)
  16. ROI (`/dashboard/roi`)
  17. Data Quality (`/dashboard/data-quality`)
* **Configurable ROI Financial Model**: Dynamic calculator with configurable developer hourly rates, seat costs, and time saved multipliers. Explicitly labeled as assumption-based estimates.
* **Raw Payload Preservation**: Stores original unparsed API JSON and NDJSON responses in PostgreSQL/SQLite `RawPayload` table for auditability and reprocessing.
* **Multidimensional Filtering**: Date range picker, organization, team, user, repository, feature, model, language, IDE, agent filters.
* **Enterprise UI**: Built with Next.js App Router, Tailwind CSS, Recharts, Lucide Icons, and CSV data export handlers.

---

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install
```

### 2. Database & Seed

```bash
# Push Prisma schema to local SQLite (or PostgreSQL)
npx prisma db push

# Seed 90 days of realistic Copilot metrics data
npx tsx prisma/seed.ts
```

### 3. Run Development Server

```bash
npm run dev
```

Navigate to `http://localhost:3000` to view the Executive Overview dashboard.

---

## 🐳 Docker Deployment

```bash
# Start PostgreSQL database and Next.js web application
docker-compose up -d --build
```

---

## 📄 Documentation Links

- [METRIC_CATALOG.md](./METRIC_CATALOG.md): Full documentation of every Copilot API metric field, type, aggregation, and delta calculation support.
