import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../components/Sidebar';
import CalendarView from '../components/CalendarView';
import AttendanceRequestsView from '../components/AttendanceRequestsView';
import EmployeeManagement from '../components/EmployeeManagement';
import LeaveManagement from '../components/LeaveManagement';
import StatisticsView from '../components/StatisticsView';
import SettingsView from '../components/SettingsView';
import ProfileSettingsView from '../components/ProfileSettingsView';
import NotificationCenter, { NotificationProvider } from '../components/NotificationCenter';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const DashboardLayout = () => {
  const { user, company, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (company.status === 'pending') {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
        <Text style={{fontSize: 20, fontWeight: 'bold', color: '#555', marginBottom: 10}}>Đang chờ duyệt</Text>
        <Text style={{fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 20}}>Yêu cầu gia nhập công ty "{company.company_name}" của bạn đang chờ Sếp duyệt. Vui lòng quay lại sau.</Text>
        
        <TouchableOpacity 
          style={{backgroundColor: '#f28baf', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8}}
          onPress={logout}
        >
          <Text style={{color: '#fff', fontWeight: 'bold'}}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NotificationProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {(!isMobile || isSidebarOpen) && (
            <>
              {isMobile && (
                <TouchableOpacity 
                  style={styles.backdrop} 
                  activeOpacity={1} 
                  onPress={() => setIsSidebarOpen(false)} 
                />
              )}
              <View style={[isMobile ? styles.sidebarMobile : { height: '100%' }]}>
                <Sidebar onNavigate={() => isMobile && setIsSidebarOpen(false)} />
              </View>
            </>
          )}
          <View style={styles.mainContent}>
            {isMobile && (
              <View style={styles.mobileHeader}>
                <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuIcon}>
                  <Ionicons name="menu" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.mobileHeaderTitle}>{company.company_name}</Text>
                <View style={{width: 28}} /> {/* placeholder to center title */}
              </View>
            )}
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Stack.Navigator
                id="DashboardStack"
                initialRouteName="Statistics"
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}
              >
                <Stack.Screen name="Calendar" component={CalendarView} />
                <Stack.Screen name="AttendanceRequests" component={AttendanceRequestsView} />
                <Stack.Screen name="Employees" component={EmployeeManagement} />
                <Stack.Screen name="Leave" component={LeaveManagement} />
                <Stack.Screen name="Statistics" component={StatisticsView} />
                <Stack.Screen name="Notifications" component={NotificationCenter} />
                <Stack.Screen name="Settings" component={SettingsView} />
                <Stack.Screen name="ProfileSettings" component={ProfileSettingsView} />
              </Stack.Navigator>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </NotificationProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 5, height: 0 },
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuIcon: {
    padding: 4,
  },
  mobileHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  }
});

export default DashboardLayout;
