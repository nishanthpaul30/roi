import { NextResponse } from 'next/server';
import { setCustomCsvData, resetCustomCsvData, getDatasetMetadata } from '@/lib/data/csvLoader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = getDatasetMetadata();
    return NextResponse.json(meta);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch dataset metadata' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvText, fileName } = body;

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid csvText in request body' }, { status: 400 });
    }

    const result = setCustomCsvData(csvText, fileName || 'uploaded_data.csv');
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to parse CSV or no valid data rows found' }, { status: 400 });
    }

    const meta = getDatasetMetadata();
    return NextResponse.json({
      message: `Successfully uploaded ${result.rowsParsed} rows`,
      metadata: meta,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error processing CSV upload' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    resetCustomCsvData();
    const meta = getDatasetMetadata();
    return NextResponse.json({
      message: 'Reset dataset to default ai_usage_data.csv',
      metadata: meta,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error resetting dataset' }, { status: 500 });
  }
}
