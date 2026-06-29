import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useCompanyNotifications } from './NotificationCenter';

const Sidebar = () => {
  const { user, company, logout } = useAuth();
  const { unreadCount, markAllAsRead } = useCompanyNotifications();
  const navigation = useNavigation<any>();

  // Subscribe to navigation state changes so Sidebar re-renders immediately
  const activeRouteName = useNavigationState(state => {
    if (!state) return 'Calendar';
    const currentRoute = state.routes[state.index];
    // Check if we are inside the Dashboard nested navigator
    if (currentRoute.name === 'Dashboard' && currentRoute.state) {
       const nestedState = currentRoute.state as any;
       const index = nestedState.index ?? 0;
       return nestedState.routes?.[index]?.name ?? 'Calendar';
    }
    return 'Calendar';
  });
  
  const activeTab = activeRouteName.toLowerCase();

  const roleName = company.role === 'owner' ? 'Sếp tổng' : company.role === 'manager' ? 'Quản lý' : 'Nhân viên';

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoContainer}>
        <Image source={require('../assets/logo.png')} style={{width: 40, height: 40, resizeMode: 'contain'}} />
        <Text style={styles.logoName}>basawage</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={[styles.notificationItem, activeTab === 'notifications' && styles.notificationItemActive]}
          onPress={() => {
            markAllAsRead();
            navigation.navigate('Dashboard', { screen: 'Notifications' });
          }}
        >
          <View style={styles.notificationIconBox}>
            <Ionicons name="notifications-outline" size={22} color={activeTab === 'notifications' ? '#fff' : '#4a72b5'} />
          </View>
          <View style={styles.notificationTextWrap}>
            <Text style={[styles.notificationTitle, activeTab === 'notifications' && styles.notificationTitleActive]}>Thông báo</Text>
            <Text style={[styles.notificationSubtitle, activeTab === 'notifications' && styles.notificationSubtitleActive]}>
              {unreadCount > 0 ? `${unreadCount} cập nhật mới` : 'Cập nhật chung'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={[styles.notificationBadge, activeTab === 'notifications' && styles.notificationBadgeActive]}>
              <Text style={[styles.notificationBadgeText, activeTab === 'notifications' && styles.notificationBadgeTextActive]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.menuItem, activeTab === 'calendar' && styles.menuItemActive]}
          onPress={() => navigation.navigate('Dashboard', { screen: 'Calendar' })}
        >
          <Ionicons name="time-outline" size={18} color={activeTab === 'calendar' ? "#fff" : "#888"} />
          <Text style={[styles.menuItemText, activeTab === 'calendar' && styles.menuItemTextActive]}>Chấm công</Text>
        </TouchableOpacity>

        {(company.role === 'owner' || company.role === 'manager') && (
          <TouchableOpacity 
            style={[styles.menuItem, activeTab === 'employees' && styles.menuItemActive]}
            onPress={() => navigation.navigate('Dashboard', { screen: 'Employees' })}
          >
            <Ionicons name="people-outline" size={18} color={activeTab === 'employees' ? "#fff" : "#888"} />
            <Text style={[styles.menuItemText, activeTab === 'employees' && styles.menuItemTextActive]}>Nhân viên</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.menuItem, activeTab === 'leave' && styles.menuItemActive]}
          onPress={() => navigation.navigate('Dashboard', { screen: 'Leave' })}
        >
          <Ionicons name="calendar-outline" size={18} color={activeTab === 'leave' ? "#fff" : "#888"} />
          <Text style={[styles.menuItemText, activeTab === 'leave' && styles.menuItemTextActive]}>Nghỉ phép</Text>
        </TouchableOpacity>

        {(company.role === 'owner' || company.role === 'manager') && (
          <TouchableOpacity 
            style={[styles.menuItem, activeTab === 'statistics' && styles.menuItemActive]}
            onPress={() => navigation.navigate('Dashboard', { screen: 'Statistics' })}
          >
            <Ionicons name="bar-chart-outline" size={18} color={activeTab === 'statistics' ? "#fff" : "#888"} />
            <Text style={[styles.menuItemText, activeTab === 'statistics' && styles.menuItemTextActive]}>Thống kê</Text>
          </TouchableOpacity>
        )}

        {company.role === 'owner' && (
          <TouchableOpacity 
            style={[styles.menuItem, activeTab === 'settings' && styles.menuItemActive]}
            onPress={() => navigation.navigate('Dashboard', { screen: 'Settings' })}
          >
            <Ionicons name="settings-outline" size={18} color={activeTab === 'settings' ? "#fff" : "#888"} />
            <Text style={[styles.menuItemText, activeTab === 'settings' && styles.menuItemTextActive]}>Cài đặt công ty</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.menuItem, activeTab === 'profilesettings' && styles.menuItemActive]}
          onPress={() => navigation.navigate('Dashboard', { screen: 'ProfileSettings' })}
        >
          <Ionicons name="person-circle-outline" size={18} color={activeTab === 'profilesettings' ? "#fff" : "#888"} />
          <Text style={[styles.menuItemText, activeTab === 'profilesettings' && styles.menuItemTextActive]}>Thông tin cá nhân</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.userContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.username}</Text>
            <Text style={styles.userRole}>{roleName}</Text>
            <Text style={styles.companyName} numberOfLines={1}>{company.company_name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#f28baf" />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  logoName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuContainer: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
  },
  notificationItemActive: {
    backgroundColor: '#4a72b5',
    borderColor: '#4a72b5',
    shadowColor: '#4a72b5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  notificationTextWrap: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  notificationTitleActive: {
    color: '#fff',
  },
  notificationSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  notificationSubtitleActive: {
    color: '#e0ecff',
  },
  notificationBadge: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  notificationBadgeActive: {
    backgroundColor: '#fff',
  },
  notificationBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  notificationBadgeTextActive: {
    color: '#4a72b5',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 5,
  },
  menuItemActive: {
    backgroundColor: '#4a72b5',
    shadowColor: '#4a72b5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemText: {
    fontSize: 15,
    marginLeft: 15,
    color: '#888',
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 20,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4a72b5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    fontSize: 12,
    color: '#888',
  },
  companyName: {
    fontSize: 11,
    color: '#4a72b5',
    fontWeight: '600',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: '#fef5f7',
    borderRadius: 8,
  },
  logoutText: {
    color: '#f28baf',
    fontWeight: 'bold',
    marginLeft: 8,
  }
});

export default Sidebar;
