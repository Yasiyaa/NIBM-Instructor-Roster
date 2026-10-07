import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
} from 'react-native';
import { colors } from '../theme/colors';
import { apiGetPublicBoard, PublicBoardResponse } from '../services/api';
import {
  X,
  Eye,
  Clock,
  MapPin,
  Moon,
  Phone,
  Sparkles,
  Users,
  ShieldCheck,
  Calendar,
} from 'lucide-react-native';
import { format } from 'date-fns';

interface PublicStatusBoardModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PublicStatusBoardModal: React.FC<PublicStatusBoardModalProps> = ({
  visible,
  onClose,
}) => {
  const [data, setData] = useState<PublicBoardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => format(new Date(), 'h:mm:ss a'));

  const fetchBoard = useCallback(async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await apiGetPublicBoard();
      setData(res);
    } catch (e) {
      console.warn('[PublicBoard] Failed fetching status:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchBoard();
      const clockInterval = setInterval(() => {
        setCurrentTime(format(new Date(), 'h:mm:ss a'));
      }, 1000);
      return () => clearInterval(clockInterval);
    }
  }, [visible, fetchBoard]);

  const report = data?.executiveReport;
  const onDuty = report?.onDuty || [];
  const freeStandby = report?.freeStandby || [];
  const nightOfficer = report?.nightDutyInstructor;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE CAMPUS BOARD</Text>
            </View>
            <Text style={styles.headerTitle}>Operational Roster</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.75}>
            <X size={19} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Date and Clock Subheader */}
        <View style={styles.clockBar}>
          <View style={styles.clockBadge}>
            <Clock size={12} color={colors.accentLight} style={{ marginRight: 6 }} />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>
          <View style={styles.dateBadge}>
            <Calendar size={12} color={colors.textMuted} style={{ marginRight: 5 }} />
            <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchBoard(true)}
              tintColor={colors.accentLight}
            />
          }
        >
          {isLoading && !data ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accentLight} />
              <Text style={styles.loadingText}>Fetching live campus status...</Text>
            </View>
          ) : (
            <>
              {/* Tonight's Duty Officer */}
              {nightOfficer && (
                <View style={styles.nightCard}>
                  <View style={styles.nightIconBox}>
                    <Moon size={19} color={colors.nightBadge} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nightLabel}>TONIGHT'S NIGHT DUTY OFFICER</Text>
                    <Text style={styles.nightName}>{nightOfficer.fullName}</Text>
                    {nightOfficer.jobTitle ? (
                      <Text style={styles.nightSub}>{nightOfficer.jobTitle}</Text>
                    ) : null}
                  </View>
                  {nightOfficer.phone && (
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => Linking.openURL(`tel:${nightOfficer.phone}`)}
                      activeOpacity={0.8}
                    >
                      <Phone size={15} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Sessions Currently On Duty */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Currently Teaching Sessions</Text>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>{onDuty.length}</Text>
                  </View>
                </View>

                {onDuty.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <ShieldCheck size={28} color={colors.success} />
                    <Text style={styles.emptyText}>No classes currently in session.</Text>
                  </View>
                ) : (
                  onDuty.map((item, idx) => (
                    <View key={idx} style={styles.dutyCard}>
                      <View style={styles.dutyTopRow}>
                        <Text style={styles.dutyInstructor}>{item.instructor.fullName}</Text>
                        <View style={styles.dutyTimeChip}>
                          <Clock size={11} color={colors.primaryLight} style={{ marginRight: 4 }} />
                          <Text style={styles.dutyTimeText}>
                            {item.assignment.startTime} - {item.assignment.endTime}
                          </Text>
                        </View>
                      </View>

                      {(item.assignment.batchName || item.assignment.moduleName) && (
                        <Text style={styles.dutyBatch}>
                          {[item.assignment.batchName, item.assignment.moduleName]
                            .filter(Boolean)
                            .join(' • ')}
                        </Text>
                      )}

                      {item.assignment.roomLab && (
                        <View style={styles.dutyRoomRow}>
                          <MapPin size={11} color={colors.accentLight} />
                          <Text style={styles.dutyRoomText}>{item.assignment.roomLab}</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* Free Standby Pool */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Available Standby Officers</Text>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>{freeStandby.length}</Text>
                  </View>
                </View>

                {freeStandby.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Users size={24} color={colors.textMuted} />
                    <Text style={styles.emptyText}>All cadre officers currently deployed.</Text>
                  </View>
                ) : (
                  <View style={styles.standbyGrid}>
                    {freeStandby.map((officer) => (
                      <View key={officer.id} style={styles.standbyCard}>
                        <View style={styles.standbyAvatar}>
                          <Text style={styles.standbyAvatarText}>
                            {officer.fullName.charAt(0)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.standbyName} numberOfLines={1}>
                            {officer.fullName}
                          </Text>
                          <Text style={styles.standbyRole} numberOfLines={1}>
                            {officer.jobTitle || officer.role}
                          </Text>
                        </View>
                        {officer.phone && (
                          <TouchableOpacity
                            style={styles.miniCallBtn}
                            onPress={() => Linking.openURL(`tel:${officer.phone}`)}
                            activeOpacity={0.75}
                          >
                            <Phone size={13} color={colors.primaryLight} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderSubtle,
  },
  headerLeft: {
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  clockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderSubtle,
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  clockText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accentLight,
    letterSpacing: 0.2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  nightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.nightSurface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.nightBorder,
  },
  nightIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nightLabel: {
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
  nightSub: {
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
  section: {
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
  badgeCount: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  badgeCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dutyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.info,
  },
  dutyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dutyInstructor: {
    fontSize: 14,
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
  },
  dutyTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  dutyBatch: {
    fontSize: 12.5,
    color: colors.accentLight,
    marginTop: 4,
    fontWeight: '500',
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
  standbyGrid: {
    gap: 8,
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
  standbyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  standbyAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.success,
  },
  standbyName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  standbyRole: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  miniCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
});
