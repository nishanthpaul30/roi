export interface DailyMetricData {
  id: string;
  day: string;
  enterpriseId?: string | null;
  organizationId?: string | null;
  assignedLicenses: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  dailyActiveCliUsers: number;
  dailyActiveCopilotAppUsers: number;
  dailyActiveCloudAgentUsers: number;
  dailyActiveCodeReviewUsers: number;
  dailyPassiveCodeReviewUsers: number;
  monthlyActiveAgentUsers: number;
  monthlyActiveChatUsers: number;
  codeGenerationActivityCount: number;
  codeAcceptanceActivityCount: number;
  locSuggestedToAddSum: number;
  locSuggestedToDeleteSum: number;
  locAddedSum: number;
  locDeletedSum: number;
  userInitiatedInteractionCount: number;
  aiCreditsUsed: number;
  // GitHub Copilot API billing fields
  tokenConsumption: number;       // total tokens consumed (prompt + output)
  dailyBillableTokens: number;    // billable tokens for cost tracking
  cost: number;                   // actual billed cost ($) from GitHub Copilot API
}

export interface RepoMetricData {
  id: string;
  day: string;
  enterpriseId?: string | null;
  organizationId: string;
  repoId: string | number;
  repoOwnerName: string;
  repoName: string;
  repoVisibility: string;
  totalCreated: number;
  totalCreatedByCopilot: number;
  totalReviewed: number;
  totalReviewedByCopilot: number;
  totalMerged: number;
  totalMergedCreatedByCopilot: number;
  totalMergedReviewedByCopilot: number;
  medianMinutesToMerge: number;
  medianMinutesToMergeCopilotAuthored: number;
  medianMinutesToMergeCopilotReviewed: number;
  totalSuggestions: number;
  totalAppliedSuggestions: number;
  totalCopilotSuggestions: number;
  totalCopilotAppliedSuggestions: number;
  commentTypeBreakdownJson: string;
}

export interface UserMetricData {
  id: string;
  day: string;
  enterpriseId?: string | null;
  organizationId: string;
  userId: string | number;
  userLogin: string;
  aiAdoptionPhase: string;
  aiCreditsUsed: number;
  codeAcceptanceActivityCount: number;
  codeGenerationActivityCount: number;
  locSuggestedToAddSum: number;
  locSuggestedToDeleteSum: number;
  locAddedSum: number;
  locDeletedSum: number;
  userInitiatedInteractionCount: number;
  usedCli: boolean;
  usedCopilotApp: boolean;
  usedAgent: boolean;
  usedChat: boolean;
  usedCloudAgent: boolean;
}

export interface RoiSettingsData {
  monthlyLicenseCost: number;
  developerHourlyRate: number;
  minsSavedPerAcceptedLoc: number;
  minsSavedPerChat: number;
  minsSavedPerPrAgent: number;
}

export interface RawPayloadData {
  id: string;
  entityType: string;
  entityId: string;
  reportType: string;
  day: string;
  payloadJson: string;
  createdAt: string;
}

export interface DbStore {
  dailyMetrics: DailyMetricData[];
  repoMetrics: RepoMetricData[];
  userMetrics: UserMetricData[];
  featureMetrics: any[];
  ideMetrics: any[];
  languageMetrics: any[];
  cliAppMetrics: any[];
  agentMetrics: any[];
  userTeamMetrics: any[];
  rawPayloads: RawPayloadData[];
  roiSettings?: RoiSettingsData;
}
