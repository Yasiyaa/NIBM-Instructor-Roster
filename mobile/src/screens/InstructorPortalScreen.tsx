import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  apiGetLeaves,
  apiSubmitLeave,
  apiCancelLeave,
  apiGetSchedule,
  getCalendarFeedUrl,
} from '../services/api';
import { LeaveRequest, DutyAssignment } from '../types';
import {
  CalendarPlus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  CalendarDays,
  MapPin,
  ExternalLink,
  FileText,
  Trash2,
  Sparkles,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';

export const InstructorPortalScreen: React.FC = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [myDuties, setMyDuties] = useState<DutyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Leave Application Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPortalData = useCallback(async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [fetchedLeaves, scheduleData] = await Promise.all([
        apiGetLeaves(),
        apiGetSchedule(),
      ]);

      setLeaves(fetchedLeaves);

      if (user && scheduleData?.mergedDuties) {
        const userDuties = scheduleData.mergedDuties.filter(
          (d) => d.instructorId === user.id
        );
        setMyDuties(userDuties);
      }
    } catch (err) {
      console.warn('[InstructorPortal] Failed loading portal data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  const handleCancelLeave = (leaveId: string) => {
    Alert.alert(
      'Cancel Leave Application',
      'Are you sure you want to withdraw this pending leave request?',
      [
        { text: 'No, Keep', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCancelLeave(leaveId);
              Alert.alert('Leave Cancelled', 'Your leave request has been withdrawn.');
              fetchPortalData();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to cancel leave';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleSubscribeCalendar = () => {
    if (!user) return;
    const url = getCalendarFeedUrl(user.id);
    Alert.alert(
      'Live Calendar Subscription',
      `Subscribe to your personal live duty roster in Apple Calendar or Google Calendar:\n\n${url}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe Now',
          onPress: () => Linking.openURL(url.replace(/^https?:/, 'webcal:')),
        },
      ]
    );
  };

  const handleOpenModal = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    setReason('');
    setIsModalOpen(true);
  };

  const handleSubmitLeave = async () => {
    if (!startDate.trim() || !endDate.trim() || !reason.trim()) {
      Alert.alert('Required Fields', 'Please specify start date, end date, and reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiSubmitLeave(startDate.trim(), endDate.trim(), reason.trim());
      setIsModalOpen(false);
      Alert.alert('Success', 'Leave request submitted successfully. Executives have been alerted.');
      fetchPortalData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit leave request';
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <View style={[styles.statusBadge, styles.statusApproved]}>
            <CheckCircle2 size={12} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>Approved</Text>
          </View>
        );
      case 'REJECTED':
        return (
          <View style={[styles.statusBadge, styles.statusRejected]}>
            <XCircle size={12} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.danger }]}>Rejected</Text>
          </View>
        );
      case 'PENDING':
        return (
          <View style={[styles.statusBadge, styles.statusPending]}>
            <AlertCircle size={12} color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>Pending</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <Text style={[styles.statusText, { color: colors.textMuted }]}>{status}</Text>
          </View>
        );
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return format(parseISO(isoString), 'MMM d, yyyy • h:mm a');
    } catch {
      return isoString;
    }
  };

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchPortalData(true)}
            tintColor={colors.primaryLight}
          />
        }
      >
        {/* Modern Instructor Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'I'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullName}>{user?.fullName}</Text>
              <Text style={styles.jobTitle}>{user?.jobTitle || 'Technical Instructor'}</Text>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={handleOpenModal} activeOpacity={0.8}>
              <CalendarPlus size={15} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.applyButtonText}>Apply Leave</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Metrics Row */}
          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricValue}>{myDuties.length}</Text>
              <Text style={styles.heroMetricLabel}>Sessions This Week</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={[styles.heroMetricValue, { color: colors.warning }]}>
                {pendingCount}
              </Text>
              <Text style={styles.heroMetricLabel}>Pending Leaves</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={[styles.heroMetricValue, { color: colors.success }]}>
                {approvedCount}
              </Text>
              <Text style={styles.heroMetricLabel}>Approved</Text>
            </View>
          </View>
        </View>

        {/* Live Calendar Sync Banner */}
        <TouchableOpacity
          style={styles.calendarBanner}
          onPress={handleSubscribeCalendar}
          activeOpacity={0.8}
        >
          <View style={styles.calendarBannerLeft}>
            <View style={styles.calIconBox}>
              <CalendarDays size={18} color={colors.accentLight} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.calendarBannerTitle}>Sync Live Calendar</Text>
                <Sparkles size={12} color={colors.accentLight} />
              </View>
              <Text style={styles.calendarBannerSub}>
                Subscribe on Apple Calendar or Google Calendar
              </Text>
            </View>
          </View>
          <ExternalLink size={16} color={colors.accentLight} />
        </TouchableOpacity>

        {/* My Duties This Week */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Weekly Duties</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{myDuties.length}</Text>
          </View>
        </View>

        {myDuties.length === 0 ? (
          <View style={styles.emptyDutiesCard}>
            <CalendarDays size={28} color={colors.textMuted} />
            <Text style={styles.emptyDutiesTitle}>No Scheduled Duties This Week</Text>
            <Text style={styles.emptyDutiesSub}>
              You have no active teaching sessions allocated for the current week.
            </Text>
          </View>
        ) : (
          myDuties.map((duty) => (
            <View key={duty.id} style={styles.dutyItemCard}>
              <View style={styles.dutyItemTop}>
                <Text style={styles.dutyItemDate}>
                  {format(parseISO(duty.dutyDate), 'EEEE, MMM d')}
                </Text>
                <View style={styles.dutyTimeChip}>
                  <Clock size={11} color={colors.primaryLight} style={{ marginRight: 4 }} />
                  <Text style={styles.dutyTimeChipText}>
                    {duty.startTime} - {duty.endTime}
                  </Text>
                </View>
              </View>
              <Text style={styles.dutyItemSlot}>{duty.slotLabel}</Text>
              {(duty.batchName || duty.moduleName) && (
                <Text style={styles.dutyItemBatch}>
                  {[duty.batchName, duty.moduleName].filter(Boolean).join(' • ')}
                </Text>
              )}
              {duty.roomLab && (
                <View style={styles.dutyRoomRow}>
                  <MapPin size={11} color={colors.accentLight} />
                  <Text style={styles.dutyRoomText}>{duty.roomLab}</Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Leave Requests Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
          <Text style={styles.sectionTitle}>My Leave Requests</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{leaves.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading leave history...</Text>
          </View>
        ) : leaves.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileText size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Leave Applications</Text>
            <Text style={styles.emptySubtitle}>
              You have not submitted any leave requests yet. Tap "Apply Leave" above when you need time off.
            </Text>
          </View>
        ) : (
          leaves.map((leave) => (
            <View key={leave.id} style={styles.leaveCard}>
              <View style={styles.leaveCardHeader}>
                <View style={styles.dateRangeBox}>
                  <Calendar size={13} color={colors.primaryLight} style={{ marginRight: 6 }} />
                  <Text style={styles.dateRangeText}>
                    {leave.startDate} {leave.startDate !== leave.endDate ? `to ${leave.endDate}` : ''}
                  </Text>
                </View>
                {getStatusBadge(leave.status)}
              </View>

              <Text style={styles.reasonText}>{leave.reason}</Text>

              {/* Applied At timestamp */}
              {leave.appliedAt && (
                <View style={styles.appliedAtRow}>
                  <Clock size={11} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.appliedAtText}>
                    Applied: {formatTimestamp(leave.appliedAt)}
                  </Text>
                </View>
              )}

              {/* Reviewer remarks if available */}
              {leave.reviewComment && (
                <View style={styles.reviewCommentBox}>
                  <Text style={styles.reviewCommentLabel}>
                    Reviewed by {leave.reviewedByName || 'Administrator'}
                    {leave.reviewedAt ? ` on ${formatTimestamp(leave.reviewedAt)}` : ''}:
                  </Text>
                  <Text style={styles.reviewCommentText}>{leave.reviewComment}</Text>
                </View>
              )}

              {/* Cancel Button for Pending Requests */}
              {leave.status === 'PENDING' && (
                <TouchableOpacity
                  style={styles.cancelLeaveButton}
                  onPress={() => handleCancelLeave(leave.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={13} color={colors.danger} style={{ marginRight: 6 }} />
                  <Text style={styles.cancelLeaveText}>Withdraw Leave Request</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Leave Application Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <Text style={styles.modalSubtitle}>
              Submission will be recorded with exact timestamp and alerted to Executive reviewers.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>START DATE (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-10-12"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>END DATE (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-10-12"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REASON / REMARKS</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Annual leave, family commitment..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmitLeave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  fullName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  jobTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
  },
  heroMetricItem: {
    alignItems: 'center',
  },
  heroMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroMetricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },
  calendarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  calendarBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  calIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calendarBannerSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptyDutiesCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  emptyDutiesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptyDutiesSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  dutyItemCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
  },
  dutyItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dutyItemDate: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dutyTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  dutyTimeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  dutyItemSlot: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dutyItemBatch: {
    fontSize: 12,
    color: colors.accentLight,
    marginTop: 4,
  },
  dutyRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dutyRoomText: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  leaveCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateRangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusApproved: {
    backgroundColor: colors.successLight,
  },
  statusRejected: {
    backgroundColor: colors.dangerLight,
  },
  statusPending: {
    backgroundColor: colors.warningLight,
  },
  statusCancelled: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reasonText: {
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 6,
  },
  appliedAtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  appliedAtText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  reviewCommentBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
  },
  reviewCommentLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  reviewCommentText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  cancelLeaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
  },
  cancelLeaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
