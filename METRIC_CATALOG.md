# GitHub Copilot Usage & ROI Metric Catalog

This document defines all metrics, dimensions, aggregations, and support for delta/trend calculations derived from the official GitHub Copilot Usage Metrics API responses (including 1-day, 28-day, repo-level, user-level, user-teams NDJSON reports, and **Enterprise Billing Usage Reports API** endpoints).

---

## 1. Core Usage & Adoption Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `DAU` | Daily Active Users | `daily_active_users` | integer | Distinct users active on Copilot on a given day | `SUM` / `MAX` | Org, Team, User | Absolute, %, DoD, WoW, MoM |
| `WAU` | Weekly Active Users | `weekly_active_users` | integer | Distinct users active in rolling 7-day window | `MAX` / `LAST` | Org, Team | Absolute, %, WoW |
| `MAU` | Monthly Active Users | `monthly_active_users` | integer | Distinct users active in rolling 28-day window | `MAX` / `LAST` | Org, Team | Absolute, %, MoM |
| `ADOPTION_RATE` | Active Adoption Rate | `daily_active_users` / `assigned_licenses` | percentage | % of assigned seat licenses actively using Copilot | `AVG` | Org, Team | Absolute, %, pp, DoD, WoW, MoM |
| `ENGAGEMENT_RATIO` | DAU / MAU Ratio | `daily_active_users` / `monthly_active_users` | percentage | Ratio of daily engagement relative to monthly active user base | `AVG` | Org, Team | Absolute, %, pp, DoD, WoW, MoM |
| `AI_ADOPTION_PHASE` | AI Adoption Phase | `ai_adoption_phase.phase`, `phase_number` | string / int | Organization/User maturity phase (e.g. Phase 1, Phase 2) | `MODE` / `DISTRIBUTION` | Org, Team, User | Phase distribution shift |

---

## 2. Feature-Specific Active Users

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `DAU_CLI` | Daily Active CLI Users | `daily_active_cli_users`, `used_cli` | integer / bool | Users active on Copilot CLI | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `DAU_APP` | Daily Active Copilot App Users | `daily_active_copilot_app_users`, `used_copilot_app` | integer / bool | Users active in Copilot standalone app/web | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `DAU_AGENT` | Daily Active Cloud Agent Users | `daily_active_copilot_cloud_agent_users`, `used_copilot_cloud_agent` | integer / bool | Users active with Copilot Cloud / Coding Agent | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `DAU_CODE_REVIEW` | Daily Active Code Review Users | `daily_active_copilot_code_review_users`, `used_copilot_code_review_active` | integer / bool | Users receiving or giving Copilot AI code reviews | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `MAU_AGENT` | Monthly Active Agent Users | `monthly_active_agent_users` | integer | 28-day active agent users | `MAX` / `LAST` | Org, Team | Absolute, %, MoM |
| `MAU_CHAT` | Monthly Active Chat Users | `monthly_active_chat_users` | integer | 28-day active Copilot chat users | `MAX` / `LAST` | Org, Team | Absolute, %, MoM |

---

## 3. Enterprise Billing Usage Reports API Schema (`/settings/billing/reports`)

> Endpoint: `GET/POST /enterprises/{enterprise}/settings/billing/reports` (API Version `2026-03-10`)

| Metric ID | Report Type | API Enum Field | Type | Description | Aggregation | Supported Dimensions |
|-----------|-------------|----------------|------|-------------|-------------|----------------------|
| `BILLING_AI_CREDIT` | `ai_credit` | `ai_credit` | float / JSON | AI credits consumed per request, user, or model execution | `SUM` | Enterprise, Org, User, Model |
| `BILLING_PREMIUM_REQ` | `premium_request` | `premium_request` | integer | Premium request counts for advanced AI model invocations (e.g. o1/o3 reasoning models) | `SUM` | Enterprise, User, Model |
| `BILLING_SUMMARIZED` | `summarized` | `summarized` | JSON | High-level aggregated billing summary across seat licenses & credits | `SUM` | Enterprise, Org |
| `BILLING_DETAILED` | `detailed` | `detailed` | CSV / NDJSON | Granular raw audit trail of all billable developer AI requests | `SUM` | Enterprise, Org, User, Repo |

---

## 4. Code Completion & Generation Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `GEN_SUGGESTIONS` | Suggestions Count | `code_generation_activity_count` | integer | Total code completion suggestions generated | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `GEN_ACCEPTANCES` | Acceptances Count | `code_acceptance_activity_count` | integer | Total code completion suggestions accepted | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `ACCEPTANCE_RATE` | Completion Acceptance Rate | `code_acceptance_activity_count` / `code_generation_activity_count` | percentage | Acceptance rate of code completion suggestions | `RATIO` | Org, Team, User, Feature, Language, IDE | Absolute, %, pp, DoD, WoW, MoM |

---

## 5. Lines of Code (LOC) Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `LOC_SUGGESTED_ADD` | LOC Suggested to Add | `loc_suggested_to_add_sum` | integer | Total lines of code suggested to add | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `LOC_SUGGESTED_DEL` | LOC Suggested to Delete | `loc_suggested_to_delete_sum` | integer | Total lines of code suggested to delete | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `LOC_ADDED` | LOC Accepted / Added | `loc_added_sum` | integer | Total lines of code accepted and added to codebases | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `LOC_DELETED` | LOC Accepted / Deleted | `loc_deleted_sum` | integer | Total lines of code deleted via suggestions | `SUM` | Org, Team, User, Feature, Language, IDE | Absolute, %, DoD, WoW, MoM |
| `LOC_ACCEPTANCE_RATE` | LOC Acceptance Rate | `loc_added_sum` / `loc_suggested_to_add_sum` | percentage | Ratio of accepted LOC to suggested LOC | `RATIO` | Org, Team, User, Feature, Language, IDE | Absolute, %, pp, DoD, WoW, MoM |

---

## 6. Interaction & Engagement Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `USER_INTERACTIONS` | User-Initiated Interactions | `user_initiated_interaction_count` | integer | Total manual interactions (prompts, queries, triggers) | `SUM` | Org, Team, User, Feature, IDE | Absolute, %, DoD, WoW, MoM |
| `AI_CREDITS` | AI Credits Used | `ai_credits_used` | float | Enterprise credits consumed for high-tier models/features | `SUM` | Org, Team, User | Absolute, %, DoD, WoW, MoM |

---

## 7. CLI & Standalone Copilot App Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `CLI_PROMPTS` | CLI Prompt Count | `totals_by_cli.prompt_count` | integer | Total prompts sent via Copilot CLI | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `CLI_REQUESTS` | CLI Request Count | `totals_by_cli.request_count` | integer | Total API requests generated by CLI | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `CLI_SESSIONS` | CLI Session Count | `totals_by_cli.session_count` | integer | Active Copilot CLI sessions | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `CLI_TOKENS_PROMPT` | CLI Prompt Tokens | `totals_by_cli.token_usage.prompt_tokens_sum` | integer | Total input tokens in CLI requests | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `CLI_TOKENS_OUTPUT` | CLI Output Tokens | `totals_by_cli.token_usage.output_tokens_sum` | integer | Total output tokens from CLI responses | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `CLI_AVG_TOKENS` | CLI Avg Tokens / Req | `totals_by_cli.token_usage.avg_tokens_per_request` | float | Average tokens consumed per CLI request | `AVG` | Org, Team, User | Absolute, %, DoD |
| `APP_PROMPTS` | Copilot App Prompts | `totals_by_copilot_app.prompt_count` | integer | Total prompts in Copilot App | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `APP_REQUESTS` | Copilot App Requests | `totals_by_copilot_app.request_count` | integer | Total requests from Copilot App | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `APP_SESSIONS` | Copilot App Sessions | `totals_by_copilot_app.session_count` | integer | Active sessions in Copilot App | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `APP_TOKENS_PROMPT` | App Prompt Tokens | `totals_by_copilot_app.token_usage.prompt_tokens_sum` | integer | Total input tokens in Copilot App | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |
| `APP_TOKENS_OUTPUT` | App Output Tokens | `totals_by_copilot_app.token_usage.output_tokens_sum` | integer | Total output tokens from Copilot App | `SUM` | Org, Team, User | Absolute, %, DoD, WoW |

---

## 8. 3rd-Party & Specialized Agent Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `AGENT_INTERACTIONS` | Agent Interaction Count | `totals_by_3rd_party_agent[].user_initiated_interaction_count` | integer | User-initiated interactions with agents | `SUM` | Agent Name, Agent ID, Org, Team, User | Absolute, %, DoD, WoW |
| `AGENT_SESSIONS` | Agent Session Count | `totals_by_3rd_party_agent[].session_count` | integer | Total sessions with 3rd-party/custom agents | `SUM` | Agent Name, Agent ID, Org, Team | Absolute, %, DoD, WoW |

---

## 9. Repositories & Pull Request Activity Metrics

| Metric ID | Metric Name | API Field(s) | Type | Definition | Aggregation | Dimensions | Delta Support |
|-----------|-------------|--------------|------|------------|-------------|------------|---------------|
| `PR_TOTAL_CREATED` | Total PRs Created | `pull_requests.total_created` | integer | Total PRs opened across repositories | `SUM` | Org, Repo, Repo Visibility | Absolute, %, DoD, WoW, MoM |
| `PR_COPILOT_CREATED` | Copilot-Authored PRs | `pull_requests.total_created_by_copilot` | integer | PRs created automatically by Copilot Coding Agent | `SUM` | Org, Repo, Repo Visibility | Absolute, %, DoD, WoW, MoM |
| `PR_COPILOT_SHARE` | Copilot PR Creation Share | `total_created_by_copilot` / `total_created` | percentage | % of all PRs created by Copilot | `RATIO` | Org, Repo | Absolute, %, pp, DoD, WoW |
| `PR_TOTAL_REVIEWED` | PRs Reviewed | `pull_requests.total_reviewed` | integer | Total PRs that received code reviews | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_REVIEWED` | PRs Reviewed by Copilot | `pull_requests.total_reviewed_by_copilot` | integer | PRs reviewed by Copilot Code Review | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_TOTAL_MERGED` | Total PRs Merged | `pull_requests.total_merged` | integer | Total PRs successfully merged | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_AUTH_MERGED` | Copilot-Authored PRs Merged | `pull_requests.total_merged_created_by_copilot` | integer | Merged PRs created by Copilot | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_REV_MERGED` | Copilot-Reviewed PRs Merged | `pull_requests.total_merged_reviewed_by_copilot` | integer | Merged PRs reviewed by Copilot | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_MEDIAN_TTM` | Overall Median Minutes to Merge | `pull_requests.median_minutes_to_merge` | float (mins) | Median duration from PR creation to merge | `MEDIAN` / `AVG` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_TTM` | Copilot-Authored Median TTM | `pull_requests.median_minutes_to_merge_copilot_authored` | float (mins) | Median minutes to merge for Copilot-created PRs | `MEDIAN` / `AVG` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_REV_COPILOT_TTM` | Copilot-Reviewed Median TTM | `pull_requests.median_minutes_to_merge_copilot_reviewed` | float (mins) | Median minutes to merge for Copilot-reviewed PRs | `MEDIAN` / `AVG` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_SUGGESTIONS` | Total PR Review Suggestions | `pull_requests.total_suggestions` | integer | Total review inline suggestions offered | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_SUGGESTIONS` | Copilot PR Suggestions | `pull_requests.total_copilot_suggestions` | integer | Inline suggestions created by Copilot Code Review | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_COPILOT_APPLIED_SUGG` | Applied Copilot Suggestions | `pull_requests.total_copilot_applied_suggestions` | integer | Copilot PR suggestions accepted & committed by devs | `SUM` | Org, Repo | Absolute, %, DoD, WoW |
| `PR_SUGGESTION_TYPE_BREAKDOWN` | PR Suggestions by Comment Type | `pull_requests.copilot_suggestions_by_comment_type` | array object | Suggestions categorized by comment type (e.g. spelling, doc, security) | `SUM` | Comment Type, Org, Repo | Absolute, % |

---

## 10. Configurable Financial & Engineering Impact ROI Metrics

| Metric ID | Metric Name | Formula / Derivation | Type | Definition |
|-----------|-------------|----------------------|------|------------|
| `HOURS_SAVED` | Estimated Developer Hours Saved | `(LOC_ADDED * mins_per_loc / 60) + (USER_INTERACTIONS * mins_per_chat / 60) + (PR_COPILOT_CREATED * mins_per_pr_agent / 60)` | float | Total hours saved based on active usage |
| `FINANCIAL_VALUE` | Estimated Financial Value Generated | `HOURS_SAVED * developer_hourly_rate` | currency ($) | Gross monetary value created by Copilot productivity |
| `TOTAL_COST` | Copilot Seat Licensing Cost | `active_users * monthly_license_cost` | currency ($) | Total cost of active licenses |
| `NET_ROI_DOLLARS` | Net Financial Return | `FINANCIAL_VALUE - TOTAL_COST` | currency ($) | Net financial return after license expenses |
| `ROI_PERCENTAGE` | ROI % | `((FINANCIAL_VALUE - TOTAL_COST) / TOTAL_COST) * 100` | percentage | Relative percentage return on investment |
| `COST_PER_ACTIVE_USER` | Cost Per Active User | `TOTAL_COST / DAU` | currency ($) | Effective cost per active daily developer |
| `VALUE_PER_USER` | Value Delivered Per Active User | `FINANCIAL_VALUE / DAU` | currency ($) | Gross productivity value delivered per active developer |

*Note: All ROI metrics are explicitly flagged as **assumption-based estimates**, configurable in the dashboard ROI Settings control panel.*
