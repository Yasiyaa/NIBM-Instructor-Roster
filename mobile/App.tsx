import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/colors';
import { TabScreen } from './src/types';
import { Header } from './src/components/Header';
import { TabBar } from './src/components/TabBar';
import { LoginScreen } from './src/screens/LoginScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { InstructorPortalScreen } from './src/screens/InstructorPortalScreen';
import { ExecutiveCockpitScreen } from './src/screens/ExecutiveCockpitScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';

const MainNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabScreen>('schedule');

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SLATE</Text>
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        <Text style={styles.splashText}>Connecting to NIBM Roster...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (user.mustChangePassword) {
    return (
      <View style={styles.safeArea}>
        <ChangePasswordScreen />
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <Header onProfilePress={() => setActiveTab('profile')} />

      <View style={styles.body}>
        {activeTab === 'schedule' && <ScheduleScreen />}
        {activeTab === 'portal' && <InstructorPortalScreen />}
        {activeTab === 'executive' && <ExecutiveCockpitScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      <TabBar currentTab={activeTab} onSelectTab={setActiveTab} />
    </View>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : Platform.OS === 'ios' ? 44 : 0,
  },
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  splashText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});
