import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { getAllLeaveRequests, createLeaveRequest } from '@/lib/storage';
import { sendPushNotificationToRoles } from '@/lib/push-notifications';

export async function GET(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const allLeaves = await getAllLeaveRequests();
    // Instructors and Demonstrators only see their own leaves; Admins and Executives see all
    if (auth.user.role === 'ADMIN' || auth.user.role === 'EXECUTIVE') {
      return NextResponse.json({ leaves: allLeaves });
    }

    const myLeaves = allLeaves.filter((l) => l.instructorId === auth.user.id);
    return NextResponse.json({ leaves: myLeaves });
  } catch (error) {
    console.error('Error fetching mobile leaves:', error);
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const body = await request.json();
    const { startDate, endDate, reason } = body;

    if (!startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'Start date, end date, and reason are required.' },
        { status: 400 }
      );
    }

    const leave = await createLeaveRequest(
      auth.user.id,
      startDate.trim(),
      endDate.trim(),
      reason.trim(),
      new Date()
    );

    // Notify administrators / executives asynchronously
    sendPushNotificationToRoles(['ADMIN', 'EXECUTIVE'], {
      title: '🌴 New Leave Request',
      body: `${auth.user.fullName} applied for leave (${startDate} to ${endDate}).`,
      data: { type: 'LEAVE_REQUEST', leaveId: leave.id },
    }).catch((err) => console.error('[Push] Leave notification failed:', err));

    return NextResponse.json({ success: true, leave });
  } catch (error) {
    console.error('Error creating mobile leave request:', error);
    return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 });
  }
}
