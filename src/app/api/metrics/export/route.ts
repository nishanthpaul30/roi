import { NextResponse } from 'next/server';
import { loadCsvData, dateStringToMonthId } from '@/lib/data/csvLoader';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '2026-03-01';
  const endDate = searchParams.get('endDate') || '2026-08-31';
  const aiTool = searchParams.get('aiTool') || 'all';

  try {
    let rows = loadCsvData();

    const startMonthId = dateStringToMonthId(startDate);
    const endMonthId = dateStringToMonthId(endDate);
    rows = rows.filter((r) => r.monthId >= startMonthId && r.monthId <= endMonthId);
    if (aiTool !== 'all') {
      rows = rows.filter((r) => r.aiTool.toLowerCase() === aiTool.toLowerCase());
    }

    const csvHeader = 'Month,AI Tool,User Mail,Display Name,Service Line,Super Region,Country,Calculation Method,GenAI Tool Consumption,Cost USD,Credits,Cost ($),Billable/Non-Billable,ProjectType,Engagement Code';
    const csvRows = rows.map((r) =>
      [
        r.monthYear,
        `"${r.aiTool}"`,
        `"${r.userMail}"`,
        `"${r.displayName}"`,
        `"${r.orgServiceLine}"`,
        `"${r.superRegion}"`,
        `"${r.country}"`,
        `"${r.calculationMethod}"`,
        r.tokenConsumption,
        r.costUsd.toFixed(4),
        r.creditsLimit.toFixed(2),
        r.cost.toFixed(4),
        r.billableFlag || 'True',
        r.projectType || 'External',
        r.projectCode || 'E-100000',
      ].join(',')
    );

    const csvContent = [csvHeader, ...csvRows].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=copilot_metrics_${startDate}_to_${endDate}.csv`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
