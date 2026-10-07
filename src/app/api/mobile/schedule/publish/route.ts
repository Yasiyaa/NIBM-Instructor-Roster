import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { publishRosterWeek, unpublishRosterWeek } from '@/lib/storage';
import { broadcastPushNotification } from '@/lib/push-notifications';

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
    const { weekId, action } = body;

    if (!weekId) {
      return NextResponse.json({ error: 'Week ID is required.' }, { status: 400 });
    }

    if (action === 'unpublish') {
      const week = await unpublishRosterWeek(weekId, auth.user.id);
      return NextResponse.json({ success: true, week });
    }

    const week = await publishRosterWeek(weekId, auth.user.id);

    // Broadcast push notification to all instructors
    broadcastPushNotification({
      title: '📅 Roster Published',
      body: `The roster for ${week.startDate} to ${week.endDate} is now published.`,
      data: { type: 'ROSTER_PUBLISHED', weekId },
    }).catch((e) => console.error('[Push] Mobile publish alert error:', e));

    return NextResponse.json({
      success: true,
      week,
    });
  } catch (error) {
    console.error('Error publishing roster via mobile:', error);
    return NextResponse.json({ error: 'Failed to publish roster' }, { status: 500 });
  }
}
