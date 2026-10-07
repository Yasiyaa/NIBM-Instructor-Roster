import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  apiGetDashboard,
  apiGetLeaves,
  apiReviewLeave,
} from '../services/api';
import { ExecutiveStatusReport, LeaveRequest } from '../types';
import {
  Activity,
  Users,
  CalendarX,
  ShieldCheck,
  Moon,
  Phone,
  Check,
  X,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';

export const ExecutiveCockpitScreen: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [report, setReport] = useState<ExecutiveStatusReport | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  const fetchCockpitData = useCallback(async (dateStr: string, isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [dashRes, leavesRes] = await Promise.all([
        apiGetDashboard(dateStr),
        apiGetLeaves(),
      ]);
      setReport(dashRes.report);
      setPendingLeaves(leavesRes.filter((l) => l.status === 'PENDING'));
    } catch (err) {
      console.warn('[Cockpit] Error fetching executive status:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCockpitData(selectedDate);
  }, [selectedDate, fetchCockpitData]);

  const handleReviewLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingLeaveId(leaveId);
    try {
      await apiReviewLeave(leaveId, status, `${status === 'APPROVED' ? 'Approved' : 'Rejected'} via Slate Mobile`);
      Alert.alert(
        'Decision Recorded',
        `Leave has been ${status.toLowerCase()}. The instructor has been notified.`
      );
      fetchCockpitData(selectedDate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed';
      Alert.alert('Action Error', msg);
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const onDutyCount = report?.onDuty?.length ?? 0;
  const onLeaveCount = report?.onLeave?.length ?? 0;
  const freeStandbyCount = report?.freeStandby?.length ?? 0;
  const totalCadreCount = (report ? onDutyCount + onLeaveCount + freeStandbyCount : 0) || 9;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchCockpitData(selectedDate, true)}
          tintColor={colors.accentLight}
        />
      }
    >
      {/* Header Bar */}
      <View style={styles.headerBox}>
        <View style={styles.headerLeft}>
          <Activity size={18} color={colors.accentLight} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Operational Cockpit</Text>
        </View>
        <View style={styles.dateBadge}>
          <Calendar size={12} color={colors.accentLight} style={{ marginRight: 4 }} />
          <Text style={styles.dateBadgeText}>{selectedDate}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accentLight} />
          <Text style={styles.loadingText}>Synthesizing cadre metrics...</Text>
        </View>
      ) : (
        <>
          {/* 4-Stat Grid */}
          <View style={styles.statsGrid}>
            {/* Total Cadre */}
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.primaryGlow }]}>
                <Users size={16} color={colors.primaryLight} />
              </View>
              <Text style={styles.statNumber}>{totalCadreCount}</Text>
              <Text style={styles.statLabel}>Cadre Total</Text>
            </View>

            {/* On Duty */}
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Sparkles size={16} color={colors.info} />
              </View>
              <Text style={[styles.statNumber, { color: colors.info }]}>{onDutyCount}</Text>
              <Text style={styles.statLabel}>On Duty</Text>
            </View>

            {/* On Leave */}
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.warningLight }]}>
                <CalendarX size={16} color={colors.warning} />
              </View>
              <Text style={[styles.statNumber, { color: colors.warning }]}>{onLeaveCount}</Text>
              <Text style={styles.statLabel}>On Leave</Text>
            </View>

            {/* Free Standby */}
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.successLight }]}>
                <ShieldCheck size={16} color={colors.success} />
              </View>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {freeStandbyCount}
              </Text>
              <Text style={styles.statLabel}>Free Standby</Text>
            </View>
          </View>

          {/* Tonight's Duty Officer */}
          <View style={styles.nightDutySection}>
            <View style={styles.nightCard}>
              <View style={styles.nightIconCircle}>
                <Moon size={19} color={colors.nightBadge} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nightTitle}>TONIGHT'S DUTY OFFICER</Text>
                <Text style={styles.nightName}>
                  {report?.nightDutyInstructor?.fullName || 'Not Yet Designated'}
                </Text>
                {report?.nightDutyInstructor?.jobTitle && (
                  <Text style={styles.nightJobTitle}>{report.nightDutyInstructor.jobTitle}</Text>
                )}
              </View>
              {report?.nightDutyInstructor?.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => Linking.openURL(`tel:${report.nightDutyInstructor?.phone}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={15} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Pending Leave Requests Approval Queue */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Leave Approvals</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingLeaves.length}</Text>
              </View>
            </View>

            {pendingLeaves.length === 0 ? (
              <View style={styles.emptyQueueCard}>
                <ShieldCheck size={26} color={colors.success} />
                <Text style={styles.emptyQueueText}>All leave applications are resolved.</Text>
              </View>
            ) : (
              pendingLeaves.map((leave) => (
                <View key={leave.id} style={styles.leaveReviewCard}>
                  <View style={styles.leaveReviewHeader}>
                    <View>
                      <Text style={styles.applicantName}>
                        {leave.instructorName || 'Instructor'}
                      </Text>
                      <Text style={styles.leaveDates}>
                        {leave.startDate} to {leave.endDate}
                      </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Clock size={11} color={colors.warning} />
                      <Text style={styles.pendingText}>Pending Review</Text>
                    </View>
                  </View>

                  <Text style={styles.leaveReason}>{leave.reason}</Text>

                  {leave.appliedAt && (
                    <Text style={styles.appliedTime}>
                      Applied: {format(parseISO(leave.appliedAt), 'MMM d, h:mm a')}
                    </Text>
                  )}

                  {/* Approve / Reject Actions */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.rejectButton, processingLeaveId === leave.id && styles.btnDisabled]}
                      onPress={() => handleReviewLeave(leave.id, 'REJECTED')}
                      disabled={processingLeaveId === leave.id}
                      activeOpacity={0.8}
                    >
                      <X size={14} color={colors.danger} style={{ marginRight: 4 }} />
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.approveButton, processingLeaveId === leave.id && styles.btnDisabled]}
                      onPress={() => handleReviewLeave(leave.id, 'APPROVED')}
                      disabled={processingLeaveId === leave.id}
                      activeOpacity={0.8}
                    >
                      <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Currently On Duty Sessions */}
          {report?.onDuty && report.onDuty.length > 0 && (
            <View style={styles.sectionWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Currently Teaching Sessions</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{report.onDuty.length}</Text>
                </View>
              </View>

              {report.onDuty.map((item, idx) => (
                <View key={idx} style={styles.onDutyCard}>
                  <View style={styles.onDutyTop}>
                    <Text style={styles.onDutyInstructor}>{item.instructor.fullName}</Text>
                    <View style={styles.onDutyTimeChip}>
                      <Clock size={10} color={colors.primaryLight} style={{ marginRight: 4 }} />
                      <Text style={styles.onDutyTimeText}>
                        {item.assignment.startTime} - {item.assignment.endTime}
                      </Text>
                    </View>
                  </View>

                  {(item.assignment.batchName || item.assignment.moduleName) && (
                    <Text style={styles.onDutyBatch}>
                      {[item.assignment.batchName, item.assignment.moduleName]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  )}

                  {item.assignment.roomLab && (
                    <View style={styles.onDutyRoomRow}>
                      <MapPin size={11} color={colors.accentLight} />
                      <Text style={styles.onDutyRoomText}>{item.assignment.roomLab}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Free Standby Cadre List */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Standby Officers</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{freeStandbyCount}</Text>
              </View>
            </View>

            {report?.freeStandby && report.freeStandby.length > 0 ? (
              report.freeStandby.map((officer) => (
                <View key={officer.id} style={styles.standbyCard}>
                  <View style={styles.officerAvatar}>
                    <Text style={styles.officerAvatarText}>
                      {officer.fullName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.officerName}>{officer.fullName}</Text>
                    <Text style={styles.officerRole}>{officer.jobTitle || officer.role}</Text>
                  </View>
                  {officer.phone && (
                    <TouchableOpacity
                      style={styles.miniCallButton}
                      onPress={() => Linking.openURL(`tel:${officer.phone}`)}
                      activeOpacity={0.7}
                    >
                      <Phone size={13} color={colors.primaryLight} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noStandbyText}>No instructors are currently on standby.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentLight,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  nightDutySection: {
    marginTop: 2,
  },
  nightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.nightSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.nightBorder,
  },
  nightIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nightTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.nightBadge,
    letterSpacing: 0.8,
  },
  nightName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nightJobTitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionWrapper: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  emptyQueueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    gap: 12,
  },
  emptyQueueText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  leaveReviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  leaveReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  applicantName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  leaveDates: {
    fontSize: 12,
    color: colors.primaryLight,
    marginTop: 2,
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  pendingText: {
    fontSize: 10.5,
    color: colors.warning,
    fontWeight: '700',
  },
  leaveReason: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  appliedTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 9,
    paddingVertical: 9,
  },
  rejectText: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: '700',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: 9,
    paddingVertical: 9,
  },
  approveText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  onDutyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.info,
  },
  onDutyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onDutyInstructor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  onDutyTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  onDutyTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  onDutyBatch: {
    fontSize: 12,
    color: colors.accentLight,
    marginTop: 4,
    fontWeight: '500',
  },
  onDutyRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  onDutyRoomText: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  standbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  officerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  officerAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.success,
  },
  officerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  officerRole: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  miniCallButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  noStandbyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
