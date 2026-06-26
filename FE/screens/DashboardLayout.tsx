import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Sidebar from '../components/Sidebar';
import CalendarView from '../components/CalendarView';
import EmployeeManagement from '../components/EmployeeManagement';
import LeaveManagement from '../components/LeaveManagement';
import StatisticsView from '../components/StatisticsView';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const DashboardLayout = () => {
  const { user, company, logout } = useAuth();

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Sidebar />
        <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Stack.Navigator
              id="DashboardStack"
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}
            >
              <Stack.Screen name="Calendar" component={CalendarView} />
              <Stack.Screen name="Employees" component={EmployeeManagement} />
              <Stack.Screen name="Leave" component={LeaveManagement} />
              <Stack.Screen name="Statistics" component={StatisticsView} />
            </Stack.Navigator>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
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
  }
});

export default DashboardLayout;
