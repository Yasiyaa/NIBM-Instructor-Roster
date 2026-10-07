import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react-native';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onProfilePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onProfilePress }) => {
  const { user } = useAuth();

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: colors.warning };
      case 'DEMONSTRATOR':
        return { bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.35)', text: colors.primaryLight };
      case 'EXECUTIVE':
        return { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: colors.accent };
      default:
        return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: colors.success };
    }
  };

  const roleStyle = getRoleBadgeStyle(user?.role);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {/* Brand Mark Badge */}
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>SLATE</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'NIBM Slate'}
          </Text>

          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : user ? (
            <View style={styles.userMetaRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.fullName}
              </Text>
              <View
                style={[
                  styles.rolePill,
                  { backgroundColor: roleStyle.bg, borderColor: roleStyle.border },
                ]}
              >
                <Shield size={10} color={roleStyle.text} style={{ marginRight: 3 }} />
                <Text style={[styles.rolePillText, { color: roleStyle.text }]}>{user.role}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {onProfilePress && (
        <TouchableOpacity style={styles.avatarButton} onPress={onProfilePress} activeOpacity={0.75}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.fullName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            {/* Live active indicator dot */}
            <View style={styles.onlineDot} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  userName: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 130,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  avatarButton: {
    marginLeft: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.cardBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
