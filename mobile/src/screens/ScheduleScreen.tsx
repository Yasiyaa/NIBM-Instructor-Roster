import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  apiGetSchedule,
  apiPublishRoster,
  apiAssignDuty,
  apiDeleteDuty,
  apiSetNightShift,
  ScheduleResponse,
} from '../services/api';
import { DutyAssignment, NightShift, User } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Moon,
  Phone,
  CalendarCheck,
  Filter,
  Plus,
  Trash2,
  Send,
  UserPlus,
  CheckCircle,
  Calendar,
} from 'lucide-react-native';
import { addDays, format, parseISO, startOfWeek, subDays } from 'date-fns';

const PRESET_SLOTS = [
  { label: '09:00 - 12:00', start: '09:00', end: '12:00', slotLabel: 'Slot 1 (09:00 - 12:00)' },
  { label: '13:00 - 16:00', start: '13:00', end: '16:00', slotLabel: 'Slot 2 (13:00 - 16:00)' },
  { label: '09:00 - 16:00', start: '09:00', end: '16:00', slotLabel: 'Full Day (09:00 - 16:00)' },
  { label: '16:30 - 19:30', start: '16:30', end: '19:30', slotLabel: 'Evening Slot (16:30 - 19:30)' },
];

const PRESET_DUTY_TYPES = ['Lecture', 'Practical Lab', 'Exam Supervision', 'Student Support'];

export const ScheduleScreen: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'DEMONSTRATOR' || user?.role === 'ADMIN';

  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterMyDuties, setFilterMyDuties] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Add Duty Modal State
  const [isAddDutyModalOpen, setIsAddDutyModalOpen] = useState(false);
  const [dutyInstructorId, setDutyInstructorId] = useState('');
  const [dutySlotIndex, setDutySlotIndex] = useState(0);
  const [dutyType, setDutyType] = useState('Lecture');
  const [dutyBatch, setDutyBatch] = useState('');
  const [dutyModule, setDutyModule] = useState('');
  const [dutyRoom, setDutyRoom] = useState('');
  const [isSubmittingDuty, setIsSubmittingDuty] = useState(false);

  // Night Duty Modal State
  const [isNightModalOpen, setIsNightModalOpen] = useState(false);
  const [nightInstructorId, setNightInstructorId] = useState('');
  const [nightNotes, setNightNotes] = useState('');
  const [isSubmittingNight, setIsSubmittingNight] = useState(false);

  const fetchSchedule = useCallback(async (weekStart: string, isPullRefresh = false) => {
    if (isPullRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await apiGetSchedule(weekStart);
      setData(result);
    } catch (err) {
      console.warn('[Schedule] Failed loading schedule:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule(currentWeekStart);
  }, [currentWeekStart, fetchSchedule]);

  // Compute 7 days of the selected week
  const weekDays = useMemo(() => {
    try {
      const monday = parseISO(currentWeekStart);
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i);
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          dayName: format(d, 'EEE'),
          dayNum: format(d, 'd'),
          isToday: format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
        };
      });
    } catch {
      return [];
    }
  }, [currentWeekStart]);

  // Navigate weeks
  const handlePrevWeek = () => {
    const monday = parseISO(currentWeekStart);
    const prevMonday = subDays(monday, 7);
    const prevStr = format(prevMonday, 'yyyy-MM-dd');
    setCurrentWeekStart(prevStr);
    setSelectedDate(prevStr);
  };

  const handleNextWeek = () => {
    const monday = parseISO(currentWeekStart);
    const nextMonday = addDays(monday, 7);
    const nextStr = format(nextMonday, 'yyyy-MM-dd');
    setCurrentWeekStart(nextStr);
    setSelectedDate(nextStr);
  };

  // Filter duties for selected date
  const dutiesForDay = useMemo(() => {
    if (!data?.mergedDuties) return [];
    return data.mergedDuties.filter((duty: DutyAssignment) => {
      const matchesDate = duty.dutyDate === selectedDate;
      const matchesUser = !filterMyDuties || duty.instructorId === user?.id;
      return matchesDate && matchesUser;
    });
  }, [data?.mergedDuties, selectedDate, filterMyDuties, user?.id]);

  // Night duty officer for selected date
  const nightShiftForDay: NightShift | undefined = useMemo(() => {
    return data?.nightShifts?.find((s) => s.shiftDate === selectedDate);
  }, [data?.nightShifts, selectedDate]);

  const handleTogglePublish = async () => {
    if (!data?.week) return;
    const isCurrentlyPublished = data.week.status === 'PUBLISHED';
    const action = isCurrentlyPublished ? 'unpublish' : 'publish';

    Alert.alert(
      isCurrentlyPublished ? 'Revert to Draft?' : 'Publish Roster Week?',
      isCurrentlyPublished
        ? 'Reverting to draft will allow demonstrator adjustments without showing partial updates.'
        : 'Publishing will mark this week official and broadcast real-time push alerts to instructors.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyPublished ? 'Revert to Draft' : 'Publish Week',
          style: isCurrentlyPublished ? 'destructive' : 'default',
          onPress: async () => {
            setIsPublishing(true);
            try {
              await apiPublishRoster(data.week.id, action);
              Alert.alert(
                'Success',
                isCurrentlyPublished
                  ? 'Roster week reverted to draft.'
                  : 'Roster week published! Push notifications dispatched.'
              );
              await fetchSchedule(currentWeekStart);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Action failed';
              Alert.alert('Error', msg);
            } finally {
              setIsPublishing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteDuty = (duty: DutyAssignment) => {
    Alert.alert(
      'Delete Duty Assignment',
      `Remove session for ${duty.instructorName} on ${duty.slotLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteDuty(duty.id);
              Alert.alert('Deleted', 'Duty assignment removed.');
              await fetchSchedule(currentWeekStart);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to delete duty';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleOpenAddDuty = () => {
    if (data?.instructors && data.instructors.length > 0) {
      setDutyInstructorId(data.instructors[0].id);
    }
    setDutySlotIndex(0);
    setDutyType('Lecture');
    setDutyBatch('');
    setDutyModule('');
    setDutyRoom('');
    setIsAddDutyModalOpen(true);
  };

  const handleSubmitDuty = async () => {
    if (!data?.week) return;
    if (!dutyInstructorId) {
      Alert.alert('Missing Field', 'Please select an instructor.');
      return;
    }

    const slot = PRESET_SLOTS[dutySlotIndex];
    setIsSubmittingDuty(true);
    try {
      await apiAssignDuty({
        rosterWeekId: data.week.id,
        instructorId: dutyInstructorId,
        dutyDate: selectedDate,
        slotLabel: slot.slotLabel,
        startTime: slot.start,
        endTime: slot.end,
        dutyType,
        batchName: dutyBatch.trim() || undefined,
        moduleName: dutyModule.trim() || undefined,
        roomLab: dutyRoom.trim() || undefined,
      });

      setIsAddDutyModalOpen(false);
      Alert.alert('Duty Assigned', 'The session has been added to the roster.');
      await fetchSchedule(currentWeekStart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign duty';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDuty(false);
    }
  };

  const handleOpenNightModal = () => {
    if (nightShiftForDay) {
      setNightInstructorId(nightShiftForDay.instructorId);
      setNightNotes(nightShiftForDay.notes || '');
    } else if (data?.instructors && data.instructors.length > 0) {
      setNightInstructorId(data.instructors[0].id);
      setNightNotes('');
    }
    setIsNightModalOpen(true);
  };

  const handleSubmitNightShift = async () => {
    if (!data?.week) return;
    if (!nightInstructorId) {
      Alert.alert('Missing Field', 'Please select an instructor for night duty.');
      return;
    }

    setIsSubmittingNight(true);
    try {
      await apiSetNightShift(
        data.week.id,
        nightInstructorId,
        selectedDate,
        nightNotes.trim() || undefined
      );

      setIsNightModalOpen(false);
      Alert.alert('Night Officer Assigned', 'The night duty officer has been recorded.');
      await fetchSchedule(currentWeekStart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set night duty';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmittingNight(false);
    }
  };

  const getDutyColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('teaching') || t.includes('lecture')) return colors.dutyTeaching;
    if (t.includes('cgu') || t.includes('call') || t.includes('support')) return colors.dutyCgu;
    if (t.includes('lab') || t.includes('practical')) return colors.dutyLab;
    if (t.includes('exam')) return colors.dutyExam;
    return colors.dutyDefault;
  };

  return (
    <View style={styles.container}>
      {/* Week Navigator Bar */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.navButton} activeOpacity={0.75}>
          <ChevronLeft size={19} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.weekInfo}>
          <Text style={styles.weekDates}>
            {data?.week ? `${data.week.startDate}  —  ${data.week.endDate}` : currentWeekStart}
          </Text>

          {/* Badge / Publish Action */}
          <View style={styles.badgeRow}>
            {canManage ? (
              <TouchableOpacity
                onPress={handleTogglePublish}
                disabled={isPublishing}
                style={[
                  data?.week?.status === 'PUBLISHED' ? styles.publishedBadge : styles.draftBadge,
                  styles.badgeTouchable,
                ]}
                activeOpacity={0.75}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
                ) : data?.week?.status === 'PUBLISHED' ? (
                  <CheckCircle size={11} color={colors.success} style={{ marginRight: 4 }} />
                ) : (
                  <Send size={11} color={colors.warning} style={{ marginRight: 4 }} />
                )}
                <Text
                  style={
                    data?.week?.status === 'PUBLISHED'
                      ? styles.publishedBadgeText
                      : styles.draftBadgeText
                  }
                >
                  {data?.week?.status === 'PUBLISHED' ? 'PUBLISHED (Tap to unpublish)' : 'DRAFT (Tap to publish)'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={
                  data?.week?.status === 'PUBLISHED' ? styles.publishedBadge : styles.draftBadge
                }
              >
                <Text
                  style={
                    data?.week?.status === 'PUBLISHED'
                      ? styles.publishedBadgeText
                      : styles.draftBadgeText
                  }
                >
                  {data?.week?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={handleNextWeek} style={styles.navButton} activeOpacity={0.75}>
          <ChevronRight size={19} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Day Switcher */}
      <View style={styles.daySwitcherWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySwitcher}
        >
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={day.dateStr}
                style={[
                  styles.dayPill,
                  isSelected && styles.dayPillActive,
                  day.isToday && !isSelected && styles.dayPillToday,
                ]}
                onPress={() => setSelectedDate(day.dateStr)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>
                  {day.dayName}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                  {day.dayNum}
                </Text>
                {day.isToday && (
                  <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Action & Filter Toolbar */}
      <View style={styles.filterBar}>
        <View style={styles.dateLabelRow}>
          <Calendar size={15} color={colors.accentLight} style={{ marginRight: 6 }} />
          <Text style={styles.selectedDateHeader}>
            {format(parseISO(selectedDate), 'EEEE, MMM d')}
          </Text>
        </View>

        <View style={styles.filterActionsRow}>
          {canManage && (
            <TouchableOpacity
              style={styles.addDutyButton}
              onPress={handleOpenAddDuty}
              activeOpacity={0.8}
            >
              <Plus size={13} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.addDutyButtonText}>Add Duty</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.filterToggle, filterMyDuties && styles.filterToggleActive]}
            onPress={() => setFilterMyDuties(!filterMyDuties)}
            activeOpacity={0.75}
          >
            <Filter size={12} color={filterMyDuties ? '#ffffff' : colors.textMuted} />
            <Text style={[styles.filterToggleText, filterMyDuties && styles.filterToggleTextActive]}>
              My Duties
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Duties List */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchSchedule(currentWeekStart, true)}
            tintColor={colors.primaryLight}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Syncing schedule...</Text>
          </View>
        ) : (
          <>
            {/* Night Duty Card */}
            {nightShiftForDay ? (
              <View style={styles.nightDutyCard}>
                <View style={styles.nightIconWrapper}>
                  <Moon size={19} color={colors.nightBadge} />
                </View>
                <View style={styles.nightInfo}>
                  <Text style={styles.nightLabel}>NIGHT DUTY OFFICER</Text>
                  <Text style={styles.nightInstructorName}>
                    {nightShiftForDay.instructorName}
                  </Text>
                  {nightShiftForDay.notes ? (
                    <Text style={styles.nightNotes}>{nightShiftForDay.notes}</Text>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {nightShiftForDay.instructorPhone && (
                    <TouchableOpacity
                      style={styles.phoneButton}
                      onPress={() => Linking.openURL(`tel:${nightShiftForDay.instructorPhone}`)}
                    >
                      <Phone size={14} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                  {canManage && (
                    <TouchableOpacity
                      style={[styles.phoneButton, styles.editNightBtn]}
                      onPress={handleOpenNightModal}
                    >
                      <UserPlus size={14} color={colors.primaryLight} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : canManage ? (
              <TouchableOpacity
                style={styles.assignNightPrompt}
                onPress={handleOpenNightModal}
                activeOpacity={0.8}
              >
                <Moon size={15} color={colors.nightBadge} style={{ marginRight: 8 }} />
                <Text style={styles.assignNightText}>+ Designate Night Duty Officer</Text>
              </TouchableOpacity>
            ) : null}

            {/* Duty Cards */}
            {dutiesForDay.length === 0 ? (
              <View style={styles.emptyCard}>
                <CalendarCheck size={38} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Duties Scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  {filterMyDuties
                    ? "You don't have any scheduled sessions on this day."
                    : 'No sessions are allocated for this date.'}
                </Text>
              </View>
            ) : (
              dutiesForDay.map((duty) => {
                const dutyColor = getDutyColor(duty.dutyType);
                const isFullDay =
                  duty.slotLabel.includes('09:00 - 16:00') ||
                  (duty.startTime === '09:00' && duty.endTime === '16:00');

                return (
                  <View
                    key={duty.id}
                    style={[styles.dutyCard, { borderLeftColor: dutyColor, borderLeftWidth: 3.5 }]}
                  >
                    {/* Top Row: Time, Type Chip & Delete */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.timeBadge, isFullDay && styles.fullDayTimeBadge]}>
                        <Clock size={11} color="#ffffff" style={{ marginRight: 5 }} />
                        <Text style={styles.timeBadgeText}>
                          {isFullDay ? '09:00 - 16:00 (Full Day)' : `${duty.startTime} - ${duty.endTime}`}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.dutyTypeChip,
                            { backgroundColor: `${dutyColor}18`, borderColor: `${dutyColor}50` },
                          ]}
                        >
                          <Text style={[styles.dutyTypeChipText, { color: dutyColor }]}>
                            {duty.dutyType}
                          </Text>
                        </View>
                        {canManage && (
                          <TouchableOpacity
                            onPress={() => handleDeleteDuty(duty)}
                            style={styles.deleteDutyBtn}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={13} color={colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Instructor Info */}
                    <View style={styles.instructorRow}>
                      <View style={[styles.avatar, { backgroundColor: `${dutyColor}25` }]}>
                        <Text style={[styles.avatarText, { color: dutyColor }]}>
                          {duty.instructorName?.charAt(0) || 'I'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.instructorName}>{duty.instructorName}</Text>
                        {duty.batchName && (
                          <Text style={styles.batchModuleText}>
                            {duty.batchName} {duty.moduleName ? `• ${duty.moduleName}` : ''}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Room & Lab metadata */}
                    <View style={styles.cardFooter}>
                      {duty.roomLab ? (
                        <View style={styles.metaChip}>
                          <MapPin size={11} color={colors.accentLight} />
                          <Text style={styles.metaChipText}>{duty.roomLab}</Text>
                        </View>
                      ) : (
                        <View />
                      )}

                      {duty.notes ? (
                        <Text style={styles.notesText} numberOfLines={2}>
                          {duty.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Add Duty Modal */}
      <Modal visible={isAddDutyModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Add Duty Allocation</Text>
            <Text style={styles.modalSubtitle}>Date: {selectedDate}</Text>

            {/* Instructor Selector */}
            <Text style={styles.inputLabel}>SELECT INSTRUCTOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {data?.instructors?.map((inst: User) => {
                const isSelected = inst.id === dutyInstructorId;
                return (
                  <TouchableOpacity
                    key={inst.id}
                    style={[styles.instChip, isSelected && styles.instChipActive]}
                    onPress={() => setDutyInstructorId(inst.id)}
                  >
                    <Text style={[styles.instChipText, isSelected && styles.instChipTextActive]}>
                      {inst.fullName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Slot Preset */}
            <Text style={styles.inputLabel}>SESSION SLOT</Text>
            <View style={styles.slotGrid}>
              {PRESET_SLOTS.map((slot, idx) => {
                const isSelected = idx === dutySlotIndex;
                return (
                  <TouchableOpacity
                    key={slot.label}
                    style={[styles.slotOption, isSelected && styles.slotOptionActive]}
                    onPress={() => setDutySlotIndex(idx)}
                  >
                    <Text style={[styles.slotOptionText, isSelected && styles.slotOptionTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duty Type */}
            <Text style={styles.inputLabel}>DUTY TYPE</Text>
            <View style={styles.typeGrid}>
              {PRESET_DUTY_TYPES.map((t) => {
                const isSelected = t === dutyType;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOption, isSelected && styles.typeOptionActive]}
                    onPress={() => setDutyType(t)}
                  >
                    <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Batch & Room */}
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>BATCH</Text>
                <TextInput
                  style={styles.modalInput}
                  value={dutyBatch}
                  onChangeText={setDutyBatch}
                  placeholder="e.g. DSE 24.1F"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>ROOM / LAB</Text>
                <TextInput
                  style={styles.modalInput}
                  value={dutyRoom}
                  onChangeText={setDutyRoom}
                  placeholder="e.g. Lab 3"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>MODULE NAME (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                value={dutyModule}
                onChangeText={setDutyModule}
                placeholder="e.g. Enterprise Application Development"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsAddDutyModalOpen(false)}
                disabled={isSubmittingDuty}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isSubmittingDuty && styles.buttonDisabled]}
                onPress={handleSubmitDuty}
                disabled={isSubmittingDuty}
              >
                {isSubmittingDuty ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Assign Duty</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Night Duty Officer Modal */}
      <Modal visible={isNightModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Designate Night Duty Officer</Text>
            <Text style={styles.modalSubtitle}>Date: {selectedDate}</Text>

            <Text style={styles.inputLabel}>SELECT OFFICER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {data?.instructors?.map((inst: User) => {
                const isSelected = inst.id === nightInstructorId;
                return (
                  <TouchableOpacity
                    key={inst.id}
                    style={[styles.instChip, isSelected && styles.instChipActive]}
                    onPress={() => setNightInstructorId(inst.id)}
                  >
                    <Text style={[styles.instChipText, isSelected && styles.instChipTextActive]}>
                      {inst.fullName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>SPECIAL INSTRUCTIONS / NOTES</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                value={nightNotes}
                onChangeText={setNightNotes}
                placeholder="e.g. Key handover at 21:00, check lab security..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsNightModalOpen(false)}
                disabled={isSubmittingNight}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isSubmittingNight && styles.buttonDisabled]}
                onPress={handleSubmitNightShift}
                disabled={isSubmittingNight}
              >
                {isSubmittingNight ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Officer</Text>
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
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderSubtle,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekDates: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  badgeRow: {
    marginTop: 4,
  },
  badgeTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  publishedBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  publishedBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  draftBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  draftBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  daySwitcherWrapper: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderSubtle,
  },
  daySwitcher: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayPill: {
    width: 54,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    position: 'relative',
  },
  dayPillActive: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  dayPillToday: {
    borderColor: colors.accent,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  todayDotActive: {
    backgroundColor: '#ffffff',
  },
  dayName: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNameActive: {
    color: '#ffffff',
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  dayNumActive: {
    color: '#ffffff',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedDateHeader: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addDutyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addDutyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    gap: 6,
  },
  filterToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterToggleTextActive: {
    color: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 34,
    gap: 12,
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
  nightDutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.nightSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.nightBorder,
    marginBottom: 4,
  },
  assignNightPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  assignNightText: {
    color: colors.nightBadge,
    fontSize: 13,
    fontWeight: '700',
  },
  nightIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nightInfo: {
    flex: 1,
  },
  nightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.nightBadge,
    letterSpacing: 0.8,
  },
  nightInstructorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nightNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phoneButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNightBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  dutyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  fullDayTimeBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: colors.primary,
  },
  timeBadgeText: {
    color: colors.textPrimary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  dutyTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  dutyTypeChipText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  deleteDutyBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  instructorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  batchModuleText: {
    fontSize: 12.5,
    color: colors.accentLight,
    fontWeight: '600',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 4,
  },
  metaChipText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 11.5,
    color: colors.textMuted,
    flex: 1,
    marginLeft: 10,
    textAlign: 'right',
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
    maxHeight: '92%',
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
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.8,
  },
  pickerScroll: {
    flexGrow: 0,
    marginBottom: 6,
  },
  instChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    marginRight: 8,
  },
  instChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  instChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  instChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  slotOption: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  slotOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  slotOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  slotOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  typeOption: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  typeOptionActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeOptionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSave: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
