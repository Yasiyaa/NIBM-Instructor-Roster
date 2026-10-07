import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, AlertCircle, ChevronRight, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { PublicStatusBoardModal } from '../components/PublicStatusBoardModal';

export const LoginScreen: React.FC = () => {
  const { login, serverUrl, updateServerUrl } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPublicBoardOpen, setIsPublicBoardOpen] = useState(false);

  // Server settings modal (hidden gesture: tap logo 5 times)
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl);
  const [logoTapCount, setLogoTapCount] = useState(0);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoTap = () => {
    const next = logoTapCount + 1;
    if (next >= 5) {
      setLogoTapCount(0);
      setIsServerModalOpen(true);
    } else {
      setLogoTapCount(next);
      setTimeout(() => setLogoTapCount(0), 3000);
    }
  };

  const handleSaveServerUrl = async () => {
    if (customServerUrl.trim()) {
      await updateServerUrl(customServerUrl.trim());
      setIsServerModalOpen(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.85} style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>SLATE</Text>
          </TouchableOpacity>
          <Text style={styles.brandTitle}>Instructor Roster</Text>
          <Text style={styles.brandSubtitle}>
            School of Computing • National Institute of Business Management
          </Text>
        </View>

        {/* Public Live Status Board Button (Glassmorphic card) */}
        <TouchableOpacity
          style={styles.publicBoardButton}
          onPress={() => setIsPublicBoardOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.publicBoardLeft}>
            <View style={styles.eyeIconBox}>
              <View style={styles.livePulseDot} />
              <Eye size={17} color={colors.accentLight} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.boardTitleRow}>
                <Text style={styles.publicBoardTitle}>Live Status Board</Text>
                <View style={styles.liveTag}>
                  <Text style={styles.liveTagText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.publicBoardSub}>
                View campus on-duty roster without signing in
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.accentLight} />
        </TouchableOpacity>

        {/* Card Form */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeader}>Staff Sign In</Text>
            <ShieldCheck size={18} color={colors.primaryLight} />
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <User size={17} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter staff username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock size={17} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={17} color={colors.textMuted} />
                ) : (
                  <Eye size={17} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Text style={styles.submitButtonText}>Sign In to Slate</Text>
                <ArrowRight size={17} color="#ffffff" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Institutional System Footer */}
        <View style={styles.systemFooter}>
          <Text style={styles.systemFooterText}>
            NIBM SLATE v1.0 • Technical Cadre Management
          </Text>
        </View>
      </ScrollView>

      {/* Server URL Modal */}
      <Modal visible={isServerModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configure API Server</Text>
            <Text style={styles.modalDescription}>
              Point to your local development host or production server URL.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://slate.oalindustries.me"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsServerModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveServerUrl}>
                <Text style={styles.modalSaveText}>Save Endpoint</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Public Live Status Board Modal */}
      <PublicStatusBoardModal
        visible={isPublicBoardOpen}
        onClose={() => setIsPublicBoardOpen(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  publicBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.28)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  publicBoardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  eyeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  livePulseDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publicBoardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  liveTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveTagText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  publicBoardSub: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12.5,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 7,
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14.5,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  systemFooter: {
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemFooterText: {
    color: colors.textMuted,
    fontSize: 11.5,
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
