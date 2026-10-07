import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { getExecutiveStatus } from '@/lib/storage';
import { format } from 'date-fns';

export async function GET(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam || format(new Date(), 'yyyy-MM-dd');

    const report = await getExecutiveStatus(targetDate, 'ALL');

    return NextResponse.json({
      date: targetDate,
      report,
    });
  } catch (error) {
    console.error('Error fetching mobile executive status:', error);
    return NextResponse.json({ error: 'Failed to generate status report' }, { status: 500 });
  }
}
