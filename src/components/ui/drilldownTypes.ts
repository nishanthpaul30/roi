export interface DrilldownMetricData {
  id: 'token_consumption' | 'total_investment' | 'avg_daily_cost' | 'avg_monthly_cost' | 'cost_per_user' | 'tool_chatgpt' | 'tool_copilot' | 'tool_claude' | 'ai_adoption';
  title: string;
  subtitle: string;
  currentValue: string;
  deltaText: string;
  trend: 'up' | 'down' | 'neutral';
  series: { date: string; value: number }[];
  summaryData: any;
}
