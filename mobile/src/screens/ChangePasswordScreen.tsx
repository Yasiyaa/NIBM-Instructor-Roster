import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Lock, ArrowRight, Eye, EyeOff, LogOut } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { apiChangePassword } from '../services/api';

export const ChangePasswordScreen: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!currentPassword) {
      setErrorMsg('Please enter your current temporary password.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiChangePassword(currentPassword, newPassword);
      if (res.success) {
        Alert.alert(
          'Password Updated',
          'Your password has been updated successfully. Welcome to NIBM Slate!'
        );
        await refreshUser();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconCircle}>
          <Lock size={28} color={colors.primaryLight} />
        </View>

        <Text style={styles.title}>Set a New Password</Text>
        <Text style={styles.subtitle}>
          Hi {user?.fullName?.split(' ')[0] || 'there'}, your account was created with a temporary
          password. Choose a secure personal password to continue.
        </Text>

        <View style={styles.card}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Temporary / Current Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                style={styles.eyeButton}
              >
                {showCurrent ? (
                  <EyeOff size={18} color={colors.textMuted} />
                ) : (
                  <Eye size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNew(!showNew)}
                style={styles.eyeButton}
              >
                {showNew ? (
                  <EyeOff size={18} color={colors.textMuted} />
                ) : (
                  <Eye size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Repeat new password"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeButton}
              >
                {showConfirm ? (
                  <EyeOff size={18} color={colors.textMuted} />
                ) : (
                  <Eye size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Set Password & Continue</Text>
                <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()} activeOpacity={0.7}>
          <LogOut size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Sign out instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
