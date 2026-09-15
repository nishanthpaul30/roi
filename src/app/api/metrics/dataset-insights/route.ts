import { NextResponse } from 'next/server';
import { getDatasetInsights } from '@/lib/data/csvLoader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insights = getDatasetInsights();
    return NextResponse.json(insights);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute dataset insights' }, { status: 500 });
  }
}
