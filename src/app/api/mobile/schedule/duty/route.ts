import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { addDutyAssignment, deleteDutyAssignment } from '@/lib/storage';

export async function POST(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  // Only Demonstrators and Admins can assign duties
  if (auth.user.role !== 'DEMONSTRATOR' && auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Demonstrator or Admin role required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      rosterWeekId,
      instructorId,
      dutyDate,
      slotLabel,
      startTime,
      endTime,
      dutyType,
      batchName,
      moduleName,
      roomLab,
      notes,
    } = body;

    if (!rosterWeekId || !instructorId || !dutyDate || !slotLabel || !startTime || !endTime || !dutyType) {
      return NextResponse.json(
        { error: 'Missing required duty allocation fields.' },
        { status: 400 }
      );
    }

    const res = await addDutyAssignment(
      {
        rosterWeekId,
        instructorId,
        dutyDate,
        slotLabel,
        startTime,
        endTime,
        dutyType,
        batchName,
        moduleName,
        roomLab,
        notes,
      },
      auth.user.id
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      assignment: res.assignment,
    });
  } catch (error) {
    console.error('Error assigning duty via mobile:', error);
    return NextResponse.json({ error: 'Failed to assign duty' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  if (auth.user.role !== 'DEMONSTRATOR' && auth.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Demonstrator or Admin role required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json({ error: 'Duty assignment ID is required.' }, { status: 400 });
    }

    const success = await deleteDutyAssignment(assignmentId, auth.user.id);

    if (!success) {
      return NextResponse.json({ error: 'Duty assignment not found or could not be deleted.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Duty assignment deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting duty via mobile:', error);
    return NextResponse.json({ error: 'Failed to delete duty assignment' }, { status: 500 });
  }
}
