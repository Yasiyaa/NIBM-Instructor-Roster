import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { cancelLeaveRequest } from '@/lib/storage';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const { id } = await params;
    const result = await cancelLeaveRequest(id, auth.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled successfully.',
    });
  } catch (error) {
    console.error('Error cancelling mobile leave request:', error);
    return NextResponse.json({ error: 'Failed to cancel leave request' }, { status: 500 });
  }
}
