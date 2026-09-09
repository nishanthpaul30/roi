# GitHub Copilot Metrics Derivation Guide

How every metric shown in the dashboard is derived from the **GitHub Copilot Usage Metrics API** and **Enterprise Billing Reports API**.

---

## API Endpoints & Report Types

| Report Type | Endpoint | Cadence | Scope |
|:---|:---|:---|:---|
| `organization-1-day` | `GET /orgs/{org}/copilot/usage` | Daily | Per-organization aggregate |
| `enterprise-1-day` | `GET /enterprises/{enterprise}/copilot/usage` | Daily | Cross-org enterprise aggregate |
| `repos-1-day` | `GET /enterprises/{enterprise}/copilot/usage` (repos NDJSON) | Daily | Per-repository PR metrics |
| `users-1-day` | `GET /orgs/{org}/copilot/usage` (users NDJSON) | Daily | Per-user feature usage |
| `user-teams-1-day` | `GET /orgs/{org}/team/{team_slug}/copilot/usage` | Daily | Team-level breakdown |
| `billing-detailed` | `POST /enterprises/{enterprise}/settings/billing/reports` (`detailed`) | On-demand | Raw audit trail |
| `billing-summarized` | `POST /enterprises/{enterprise}/settings/billing/reports` (`summarized`) | On-demand | High-level cost summary |
| `billing-premium-request` | `POST /enterprises/{enterprise}/settings/billing/reports` (`premium_request`) | On-demand | Advanced model invocations |
| `billing-ai-credit` | `POST /enterprises/{enterprise}/settings/billing/reports` (`ai_credit`) | On-demand | AI credit consumption |

> **API Version**: `2022-11-28` for usage endpoints · `2026-03-10` for billing reports

---

## Part 1 — Adoption & Active Users

These metrics come from the top-level `day_totals[]` array returned by the usage API.

### API Response Shape (`organization-1-day`)

```json
{
  "organization_id": "my-org",
  "day_totals": [
    {
      "day": "2025-06-01",
      "assigned_licenses": 120,
      "daily_active_users": 87,
      "weekly_active_users": 102,
      "monthly_active_users": 110,
      "daily_active_cli_users": 12,
      "daily_active_copilot_app_users": 34,
      "daily_active_cloud_agent_users": 8,
      "daily_active_code_review_users": 21,
      "daily_passive_code_review_users": 15,
      "monthly_active_agent_users": 22,
      "monthly_active_chat_users": 68
    }
  ]
}
```

### Field → Metric Mapping

| Dashboard Metric | API Field | Formula | Notes |
|:---|:---|:---|:---|
| **Daily Active Users (DAU)** | `daily_active_users` | Direct | Users who triggered ≥1 Copilot event on that day |
| **Weekly Active Users (WAU)** | `weekly_active_users` | Direct | Rolling 7-day unique users |
| **Monthly Active Users (MAU)** | `monthly_active_users` | Direct | Rolling 28-day unique users |
| **Assigned Licenses** | `assigned_licenses` | Direct | Seats currently provisioned |
| **Adoption Rate** | `daily_active_users` ÷ `assigned_licenses` | `DAU / assigned_licenses × 100` | % of seats actively used |
| **DAU/MAU Engagement Ratio** | `daily_active_users` ÷ `monthly_active_users` | `DAU / MAU × 100` | Stickiness — higher = more habit-forming |
| **Daily Active CLI Users** | `daily_active_cli_users` | Direct | Used `gh copilot` CLI commands |
| **Daily Active Copilot App Users** | `daily_active_copilot_app_users` | Direct | Used Copilot standalone web/desktop app |
| **Daily Active Cloud Agent Users** | `daily_active_cloud_agent_users` | Direct | Used Copilot Coding Agent (autonomous tasks) |
| **Daily Active Code Review Users** | `daily_active_code_review_users` | Direct | Received/requested Copilot AI review |
| **Daily Passive Code Review Users** | `daily_passive_code_review_users` | Direct | PRs had Copilot review but user didn't request it |
| **Monthly Active Agent Users** | `monthly_active_agent_users` | Direct | 28-day rolling agent users |
| **Monthly Active Chat Users** | `monthly_active_chat_users` | Direct | 28-day rolling Copilot Chat users |

---

## Part 2 — Code Completions & LOC

These fields come from the same `day_totals[]` array.

### API Fields

```json
{
  "code_generation_activity_count": 4820,
  "code_acceptance_activity_count": 2734,
  "loc_suggested_to_add_sum": 18400,
  "loc_suggested_to_delete_sum": 3200,
  "loc_added_sum": 11200,
  "loc_deleted_sum": 1400
}
```

### Field → Metric Mapping

| Dashboard Metric | API Field | Formula | Notes |
|:---|:---|:---|:---|
| **Suggestions Shown** | `code_generation_activity_count` | Direct | Inline completions displayed to developers |
| **Suggestions Accepted** | `code_acceptance_activity_count` | Direct | Completions accepted (Tab key) |
| **Completion Acceptance Rate** | `code_acceptance_activity_count` ÷ `code_generation_activity_count` | `accepted / shown × 100` | Industry benchmark: 25–35% is healthy |
| **LOC Suggested to Add** | `loc_suggested_to_add_sum` | Direct | Total lines in all suggestions shown |
| **LOC Suggested to Delete** | `loc_suggested_to_delete_sum` | Direct | Total deletion lines in suggestions |
| **LOC Accepted (Added)** | `loc_added_sum` | Direct | Lines actually accepted and written to files |
| **LOC Accepted (Deleted)** | `loc_deleted_sum` | Direct | Deletion lines accepted into files |
| **LOC Acceptance Rate** | `loc_added_sum` ÷ `loc_suggested_to_add_sum` | `added / suggested × 100` | Measures quality of suggestions |

---

## Part 3 — Interactions & AI Credits

```json
{
  "user_initiated_interaction_count": 1540,
  "ai_credits_used": 342.5
}
```

| Dashboard Metric | API Field | Formula | Notes |
|:---|:---|:---|:---|
| **User Interactions** | `user_initiated_interaction_count` | Direct | Explicit prompts: chat messages, agent tasks, slash commands |
| **AI Credits Used** | `ai_credits_used` | Direct | Enterprise credits consumed for premium models (o1, o3, Claude, etc.) |

---

## Part 4 — Pull Request Metrics (Repos Report)

These come from the **`repos-1-day`** report (per-repository NDJSON).

### API Record Shape

```json
{
  "repo_id": 123456,
  "repo_name": "my-service",
  "repo_owner_name": "my-org",
  "repo_visibility": "PRIVATE",
  "organization_id": "my-org",
  "day": "2025-06-01",
  "pull_requests": {
    "total_created": 45,
    "total_created_by_copilot": 8,
    "total_reviewed": 38,
    "total_reviewed_by_copilot": 22,
    "total_merged": 41,
    "total_merged_created_by_copilot": 7,
    "total_merged_reviewed_by_copilot": 19,
    "median_minutes_to_merge": 240,
    "median_minutes_to_merge_copilot_authored": 185,
    "median_minutes_to_merge_copilot_reviewed": 195,
    "total_suggestions": 180,
    "total_copilot_suggestions": 95,
    "total_copilot_applied_suggestions": 61
  }
}
```

### Field → Metric Mapping

| Dashboard Metric | API Field Path | Formula | Notes |
|:---|:---|:---|:---|
| **Total PRs Created** | `pull_requests.total_created` | Direct | All PRs opened in the period |
| **Copilot-Authored PRs** | `pull_requests.total_created_by_copilot` | Direct | PRs autonomously created by Copilot Coding Agent |
| **Copilot PR Share** | `total_created_by_copilot` ÷ `total_created` | `× 100` | % of all PRs created by Copilot |
| **Total PRs Reviewed** | `pull_requests.total_reviewed` | Direct | PRs that received any review activity |
| **Copilot-Reviewed PRs** | `pull_requests.total_reviewed_by_copilot` | Direct | PRs that received a Copilot Code Review |
| **Total PRs Merged** | `pull_requests.total_merged` | Direct | Successfully merged PRs |
| **Copilot-Authored PRs Merged** | `pull_requests.total_merged_created_by_copilot` | Direct | Agent-created PRs that were merged |
| **Copilot-Reviewed PRs Merged** | `pull_requests.total_merged_reviewed_by_copilot` | Direct | PRs merged after Copilot review |
| **Median Time to Merge (All)** | `pull_requests.median_minutes_to_merge` | Direct (minutes) | Median PR lifecycle duration |
| **Median TTM — Copilot Authored** | `pull_requests.median_minutes_to_merge_copilot_authored` | Direct (minutes) | TTM for Agent-created PRs — usually faster |
| **Median TTM — Copilot Reviewed** | `pull_requests.median_minutes_to_merge_copilot_reviewed` | Direct (minutes) | TTM for AI-reviewed PRs |
| **Total Review Suggestions** | `pull_requests.total_suggestions` | Direct | All inline review comments (human + AI) |
| **Copilot Review Suggestions** | `pull_requests.total_copilot_suggestions` | Direct | Inline suggestions specifically from Copilot |
| **Applied Copilot Suggestions** | `pull_requests.total_copilot_applied_suggestions` | Direct | Copilot suggestions committed by developers |

---

## Part 5 — Per-User Metrics (Users Report)

These come from the **`users-1-day`** NDJSON report. One record per user per day.

### API Record Shape

```json
{
  "user_id": 78901,
  "user_login": "alice",
  "organization_id": "my-org",
  "ai_adoption_phase": { "phase": "Phase 2", "phase_number": 2 },
  "ai_credits_used": 12.5,
  "code_generation_activity_count": 340,
  "code_acceptance_activity_count": 112,
  "loc_suggested_to_add_sum": 1400,
  "loc_added_sum": 820,
  "user_initiated_interaction_count": 55,
  "used_cli": false,
  "used_copilot_app": true,
  "used_agent": false,
  "used_chat": true,
  "used_cloud_agent": false
}
```

### Field → Metric Mapping

| Dashboard Metric | API Field | Notes |
|:---|:---|:---|
| **AI Adoption Phase** | `ai_adoption_phase.phase` / `phase_number` | GitHub-assigned maturity level (Phase 1–4+) |
| **Per-user Acceptance Rate** | `code_acceptance_activity_count` ÷ `code_generation_activity_count` | Individual completion acceptance |
| **Per-user LOC Added** | `loc_added_sum` | Lines accepted by this developer |
| **Per-user Interactions** | `user_initiated_interaction_count` | Chat prompts, agent tasks by this user |
| **Used CLI** | `used_cli` | Boolean — triggered any CLI commands this day |
| **Used Copilot App** | `used_copilot_app` | Boolean — used standalone app |
| **Used Agent** | `used_agent` | Boolean — used any Copilot agent |
| **Used Chat** | `used_chat` | Boolean — used Copilot Chat |
| **Used Cloud Agent** | `used_cloud_agent` | Boolean — used Copilot Coding Agent |

---

## Part 6 — CLI & Copilot App Detailed Metrics

Available in the `day_totals[]` as nested objects:

```json
{
  "totals_by_cli": {
    "prompt_count": 430,
    "request_count": 510,
    "session_count": 88,
    "token_usage": {
      "prompt_tokens_sum": 312000,
      "output_tokens_sum": 89000,
      "avg_tokens_per_request": 787
    }
  },
  "totals_by_copilot_app": {
    "prompt_count": 920,
    "request_count": 1040,
    "session_count": 210
  }
}
```

| Dashboard Metric | API Field Path | Notes |
|:---|:---|:---|
| **CLI Prompts** | `totals_by_cli.prompt_count` | User-sent CLI queries |
| **CLI Requests** | `totals_by_cli.request_count` | API calls generated (may exceed prompts due to retries) |
| **CLI Sessions** | `totals_by_cli.session_count` | Active CLI terminal sessions |
| **CLI Prompt Tokens** | `totals_by_cli.token_usage.prompt_tokens_sum` | Input context sent to model |
| **CLI Output Tokens** | `totals_by_cli.token_usage.output_tokens_sum` | Tokens in model responses |
| **CLI Avg Tokens/Request** | `totals_by_cli.token_usage.avg_tokens_per_request` | Efficiency indicator |
| **App Prompts** | `totals_by_copilot_app.prompt_count` | Prompts via standalone Copilot App |
| **App Requests** | `totals_by_copilot_app.request_count` | API requests from App |
| **App Sessions** | `totals_by_copilot_app.session_count` | Active App sessions |

---

## Part 7 — ROI & Financial Metrics

These are **calculated metrics** — not directly from the API. They combine usage data with configurable cost assumptions.

### Input Fields (from API)

| Variable | Source | API Field |
|:---|:---|:---|
| `locAdded` | `dailyMetrics[]` | `loc_added_sum` summed over date range |
| `userInteractions` | `dailyMetrics[]` | `user_initiated_interaction_count` summed |
| `copilotPrsCreated` | `repoMetrics[]` | `pull_requests.total_created_by_copilot` summed |
| `activeUsers` | `dailyMetrics[]` | `daily_active_users` averaged over date range |

### Configurable Assumptions (ROI Settings Panel)

| Assumption | Default | Description |
|:---|:---|:---|
| `monthlyLicenseCost` | **$19.00** | Cost per active Copilot seat per month |
| `developerHourlyRate` | **$75.00** | Fully-loaded hourly cost of one developer |
| `minsSavedPerAcceptedLoc` | **1.5 min** | Minutes a developer would have taken to write each accepted line manually |
| `minsSavedPerChat` | **5.0 min** | Minutes saved per Copilot Chat interaction vs. manual search/docs |
| `minsSavedPerPrAgent` | **45.0 min** | Minutes saved per Copilot-authored PR vs. manual PR creation |

### ROI Formulas

```
locHours       = locAdded         × minsSavedPerAcceptedLoc / 60
chatHours      = userInteractions × minsSavedPerChat        / 60
prAgentHours   = copilotPrsCreated × minsSavedPerPrAgent    / 60

hoursSaved     = locHours + chatHours + prAgentHours
financialValue = hoursSaved × developerHourlyRate
licenseCost    = activeUsers × monthlyLicenseCost

netValue          = financialValue − licenseCost
roiPercentage     = (financialValue − licenseCost) / licenseCost × 100
costPerActiveUser = licenseCost    / activeUsers
valuePerUser      = financialValue / activeUsers
```

### Metric Reference

| Dashboard Metric | Formula | What it Answers |
|:---|:---|:---|
| **Hours Saved** | `locHours + chatHours + prAgentHours` | How much engineering time did Copilot reclaim? |
| **Estimated Financial Value** | `hoursSaved × $75/hr` | What is that saved time worth in dollars? |
| **Total License Cost** | `activeUsers × $19/month` | What are we paying for active seats? |
| **Net Financial Return** | `financialValue − licenseCost` | Profit after paying for Copilot |
| **ROI %** | `(value − cost) / cost × 100` | Return per dollar invested |
| **Cost Per Active User** | `licenseCost / activeUsers` | Effective cost per daily developer |
| **Value Per Active User** | `financialValue / activeUsers` | Gross value delivered per developer |

> **All ROI figures are estimates.** The formulas are intentionally transparent and assumption-driven. Adjust the defaults in the **ROI Settings** panel to match your organization's actual rates.

---

## Part 8 — Enterprise Billing Reports API

> Endpoint: `POST /enterprises/{enterprise}/settings/billing/reports`
> API Version: `2026-03-10`

### Report Types

| `reportType` | Format | Use Case |
|:---|:---|:---|
| `ai_credit` | JSON | AI credits consumed per request, user, or model |
| `premium_request` | JSON | Advanced model invocations (o1, o3, Claude) |
| `summarized` | JSON | High-level seat and credit cost summary |
| `detailed` | CSV / NDJSON | Full audit trail of every billable request |

### Key Fields (Billing)

| Dashboard Metric | Billing Field | Notes |
|:---|:---|:---|
| **AI Credits Consumed** | `ai_credit` sum | Normalized credit units across all model tiers |
| **Premium Requests** | `premium_request` count | High-cost model calls billed separately |
| **Seat Cost** | From `summarized.seats` × license price | Active seat billing total |

---

## Data Flow Summary

```
GitHub API (daily pull)
        |
        v
  ingest.ts  ──── parses NDJSON / JSON
        |
        |── dailyMetrics[]   <- org/enterprise day_totals
        |── repoMetrics[]    <- repos-1-day PR data
        |── userMetrics[]    <- users-1-day per-user data
        |── rawPayloads[]    <- original payloads preserved
        |
        v
  API Routes (/api/metrics/*)
        |
        |── /overview   -> adoption, completion, LOC, interaction metrics
        |── /roi        -> financial ROI calculations (roi.ts)
        |── /export     -> raw data download
        |
        v
  Dashboard Pages (17 views)
```

---

## Useful References

- [GitHub Copilot Usage API Docs](https://docs.github.com/en/rest/copilot/copilot-usage)
- [Enterprise Copilot Usage](https://docs.github.com/en/rest/copilot/copilot-usage#get-a-summary-of-copilot-usage-for-enterprise-members)
- [Billing Reports API](https://docs.github.com/en/rest/billing/billing)
- [Copilot Metrics API](https://docs.github.com/en/rest/copilot/copilot-metrics)
