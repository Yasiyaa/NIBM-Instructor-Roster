import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { TabScreen } from '../types';
import { Calendar, UserCheck, Activity, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

interface TabBarProps {
  currentTab: TabScreen;
  onSelectTab: (tab: TabScreen) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const showExecutive =
    user?.role === 'EXECUTIVE' || user?.role === 'ADMIN' || user?.role === 'DEMONSTRATOR';

  const tabs: Array<{ id: TabScreen; label: string; icon: typeof Calendar; isAccent?: boolean }> = [
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'portal', label: 'My Portal', icon: UserCheck },
    ...(showExecutive
      ? [{ id: 'executive' as TabScreen, label: 'Cockpit', icon: Activity, isAccent: true }]
      : []),
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          const activeColor = tab.isAccent ? colors.accentLight : colors.primaryLight;
          const iconColor = isActive ? activeColor : colors.textMuted;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive && (tab.isAccent ? styles.tabItemActiveAccent : styles.tabItemActive),
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.75}
            >
              <View style={styles.iconContainer}>
                <Icon size={19} color={iconColor} strokeWidth={isActive ? 2.3 : 1.8} />
                {isActive && (
                  <View
                    style={[
                      styles.activeIndicatorDot,
                      { backgroundColor: tab.isAccent ? colors.accent : colors.primary },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive &&
                    (tab.isAccent ? styles.tabLabelActiveAccent : styles.tabLabelActive),
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderSubtle,
    paddingTop: 6,
    paddingBottom: 22,
    paddingHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    minWidth: 68,
  },
  tabItemActive: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  tabItemActiveAccent: {
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.28)',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicatorDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  tabLabelActiveAccent: {
    color: colors.accentLight,
    fontWeight: '700',
  },
});
