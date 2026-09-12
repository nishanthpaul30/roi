import { NextResponse } from 'next/server';
import { loadCsvData } from '@/lib/data/csvLoader';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '2026-03-01';
  const endDate = searchParams.get('endDate') || '2026-08-31';
  const aiTool = searchParams.get('aiTool') || 'all';

  try {
    let rows = loadCsvData();

    if (startDate) {
      rows = rows.filter((r) => r.activityDate >= startDate);
    }
    if (endDate) {
      rows = rows.filter((r) => r.activityDate <= endDate);
    }
    if (aiTool !== 'all') {
      rows = rows.filter((r) => r.aiTool.toLowerCase() === aiTool.toLowerCase());
    }

    const csvHeader = 'Activity Date,AI Tool,User Mail,Display Name,Service Line,Management Region,Country,Token Consumption,Daily Billable Tokens,Cost ($),License Cost ($),Usage Free Token Limit,Billable/Non-Billable,ProjectType,Engagement Code';
    const csvRows = rows.map((r) =>
      [
        r.activityDate,
        `"${r.aiTool}"`,
        `"${r.userMail}"`,
        `"${r.displayName}"`,
        `"${r.orgServiceLine}"`,
        `"${r.managementRegion}"`,
        `"${r.country}"`,
        r.tokenConsumption,
        r.dailyBillableTokens,
        r.cost.toFixed(4),
        (r.licenseCost || 100.0).toFixed(2),
        (r.usageFreeTokenLimit || r.usageLimit || 80.0).toFixed(2),
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
