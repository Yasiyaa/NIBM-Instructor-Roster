import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { setNightShift } from '@/lib/storage';

export async function POST(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  if (auth.user.role !== 'DEMONSTRATOR' && auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Demonstrator or Admin role required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { rosterWeekId, instructorId, shiftDate, notes } = body;

    if (!rosterWeekId || !instructorId || !shiftDate) {
      return NextResponse.json(
        { error: 'Roster week ID, instructor ID, and shift date are required.' },
        { status: 400 }
      );
    }

    const res = await setNightShift(rosterWeekId, shiftDate, instructorId, notes, auth.user.id);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      nightShift: res.shift,
    });
  } catch (error) {
    console.error('Error assigning night shift via mobile:', error);
    return NextResponse.json({ error: 'Failed to assign night shift' }, { status: 500 });
  }
}
