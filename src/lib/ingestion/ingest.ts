import { DbStore } from '../types';

const memoryStore: DbStore = {
  dailyMetrics: [],
  repoMetrics: [],
  userMetrics: [],
  featureMetrics: [],
  ideMetrics: [],
  languageMetrics: [],
  cliAppMetrics: [],
  agentMetrics: [],
  userTeamMetrics: [],
  rawPayloads: [],
  roiSettings: {
    monthlyLicenseCost: 19.0,
    developerHourlyRate: 75.0,
    minsSavedPerAcceptedLoc: 1.5,
    minsSavedPerChat: 5.0,
    minsSavedPerPrAgent: 45.0,
  },
};

export interface IngestRequest {
  reportType:
    | 'organization-1-day'
    | 'enterprise-1-day'
    | 'repos-1-day'
    | 'users-1-day'
    | 'user-teams-1-day'
    | 'billing-detailed'
    | 'billing-summarized'
    | 'billing-premium-request'
    | 'billing-ai-credit';
  entityType: 'organization' | 'enterprise';
  entityId: string;
  day: string;
  rawNdjsonOrJson: string;
}

export async function ingestGitHubReport(req: IngestRequest) {
  const { reportType, entityType, entityId, day, rawNdjsonOrJson } = req;
  const store = memoryStore;

  const rawId = `raw_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // 1. Store raw unparsed payload
  store.rawPayloads.push({
    id: rawId,
    entityType,
    entityId,
    reportType,
    day,
    payloadJson: typeof rawNdjsonOrJson === 'string' ? rawNdjsonOrJson : JSON.stringify(rawNdjsonOrJson),
    createdAt: new Date().toISOString()
  });

  // 2. Parse payload objects (NDJSON or JSON array)
  let records: any[] = [];
  if (typeof rawNdjsonOrJson === 'string') {
    const lines = rawNdjsonOrJson.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        records.push(JSON.parse(line));
      } catch (e) {
        try {
          records = JSON.parse(rawNdjsonOrJson);
          break;
        } catch (_) {}
      }
    }
  } else {
    records = Array.isArray(rawNdjsonOrJson) ? rawNdjsonOrJson : [rawNdjsonOrJson];
  }

  // 3. Process and normalize metrics
  let processedCount = 0;
  for (const item of records) {
    if (reportType === 'organization-1-day' || reportType === 'enterprise-1-day') {
      const orgId = item.organization_id || entityId;
      const dayTotals = item.day_totals || [];
      
      for (const dt of dayTotals) {
        const recordDay = dt.day || item.day || day;
        const existingIdx = store.dailyMetrics.findIndex(
          (d) => d.day === recordDay && d.organizationId === orgId
        );

        const metricData = {
          id: existingIdx >= 0 ? store.dailyMetrics[existingIdx].id : `dm_${Date.now()}_${processedCount}`,
          day: recordDay,
          organizationId: orgId,
          enterpriseId: item.enterprise_id || (entityType === 'enterprise' ? entityId : undefined),
          assignedLicenses: dt.assigned_licenses ?? 120,
          dailyActiveUsers: dt.daily_active_users ?? 0,
          weeklyActiveUsers: dt.weekly_active_users ?? 0,
          monthlyActiveUsers: dt.monthly_active_users ?? 0,
          dailyActiveCliUsers: dt.daily_active_cli_users ?? 0,
          dailyActiveCopilotAppUsers: dt.daily_active_copilot_app_users ?? 0,
          dailyActiveCloudAgentUsers: dt.daily_active_cloud_agent_users ?? 0,
          dailyActiveCodeReviewUsers: dt.daily_active_code_review_users ?? 0,
          dailyPassiveCodeReviewUsers: dt.daily_passive_code_review_users ?? 0,
          monthlyActiveAgentUsers: dt.monthly_active_agent_users ?? 0,
          monthlyActiveChatUsers: dt.monthly_active_chat_users ?? 0,
          codeGenerationActivityCount: dt.code_generation_activity_count ?? 0,
          codeAcceptanceActivityCount: dt.code_acceptance_activity_count ?? 0,
          locSuggestedToAddSum: dt.loc_suggested_to_add_sum ?? 0,
          locSuggestedToDeleteSum: dt.loc_suggested_to_delete_sum ?? 0,
          locAddedSum: dt.loc_added_sum ?? 0,
          locDeletedSum: dt.loc_deleted_sum ?? 0,
          userInitiatedInteractionCount: dt.user_initiated_interaction_count ?? 0,
          aiCreditsUsed: dt.ai_credits_used ?? 0,
          // GitHub Copilot API billing fields
          tokenConsumption: dt.token_consumption ?? 0,
          dailyBillableTokens: dt.daily_billable_tokens ?? 0,
          cost: dt.cost ?? 0,
        };

        if (existingIdx >= 0) {
          store.dailyMetrics[existingIdx] = metricData;
        } else {
          store.dailyMetrics.push(metricData);
        }
        processedCount++;
      }
    } else if (reportType === 'repos-1-day') {
      const recordDay = item.day || item.day_partition || day;
      if (item.repo_id) {
        const repoId = `${item.repo_id}`;
        const existingIdx = store.repoMetrics.findIndex(
          (r) => r.day === recordDay && `${r.repoId}` === repoId
        );

        const repoData = {
          id: existingIdx >= 0 ? store.repoMetrics[existingIdx].id : `repo_${Date.now()}_${processedCount}`,
          day: recordDay,
          organizationId: item.organization_id || entityId,
          enterpriseId: item.enterprise_id,
          repoId,
          repoOwnerName: item.repo_owner_name || entityId,
          repoName: item.repo_name || `repo-${item.repo_id}`,
          repoVisibility: item.repo_visibility || 'PRIVATE',
          totalCreated: item.pull_requests?.total_created ?? 0,
          totalCreatedByCopilot: item.pull_requests?.total_created_by_copilot ?? 0,
          totalReviewed: item.pull_requests?.total_reviewed ?? 0,
          totalReviewedByCopilot: item.pull_requests?.total_reviewed_by_copilot ?? 0,
          totalMerged: item.pull_requests?.total_merged ?? 0,
          totalMergedCreatedByCopilot: item.pull_requests?.total_merged_created_by_copilot ?? 0,
          totalMergedReviewedByCopilot: item.pull_requests?.total_merged_reviewed_by_copilot ?? 0,
          medianMinutesToMerge: item.pull_requests?.median_minutes_to_merge ?? 0,
          medianMinutesToMergeCopilotAuthored: item.pull_requests?.median_minutes_to_merge_copilot_authored ?? 0,
          medianMinutesToMergeCopilotReviewed: item.pull_requests?.median_minutes_to_merge_copilot_reviewed ?? 0,
          totalSuggestions: 0,
          totalAppliedSuggestions: 0,
          totalCopilotSuggestions: 0,
          totalCopilotAppliedSuggestions: 0,
          commentTypeBreakdownJson: '[]'
        };

        if (existingIdx >= 0) {
          store.repoMetrics[existingIdx] = repoData;
        } else {
          store.repoMetrics.push(repoData);
        }
        processedCount++;
      }
    }
  }

  return {
    rawPayloadId: rawId,
    recordsProcessed: processedCount,
    status: 'success'
  };
}
