import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { reviewLeaveRequest } from '@/lib/storage';
import { sendPushNotificationToUsers } from '@/lib/push-notifications';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateMobileRequest(request, ['ADMIN', 'EXECUTIVE']);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, reviewComment } = body;

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Status must be APPROVED or REJECTED.' },
        { status: 400 }
      );
    }

    const reviewedLeave = await reviewLeaveRequest(
      id,
      status,
      auth.user.id,
      reviewComment
    );

    // Send push notification directly to the applicant instructor
    sendPushNotificationToUsers([reviewedLeave.instructorId], {
      title: status === 'APPROVED' ? '🌴 Leave Request Approved' : '❌ Leave Request Rejected',
      body: `Your leave from ${reviewedLeave.startDate} to ${reviewedLeave.endDate} was ${status.toLowerCase()} by ${auth.user.fullName}.`,
      data: { type: 'LEAVE_REVIEW', leaveId: reviewedLeave.id, status },
    }).catch((err) => console.error('[Push] Review notification failed:', err));

    return NextResponse.json({ success: true, leave: reviewedLeave });
  } catch (error) {
    console.error('Error reviewing leave via mobile API:', error);
    return NextResponse.json({ error: 'Failed to review leave request' }, { status: 500 });
  }
}
