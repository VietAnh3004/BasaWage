import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import VerifyEmail from './components/VerifyEmail';
import CompanySelection from './components/CompanySelection';
import DashboardLayout from './screens/DashboardLayout';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['http://localhost:8081', 'chamcong://'],
  config: {
    screens: {
      Login: 'login',
      VerifyEmail: 'verify-email',
      Company: 'company',
      Dashboard: {
        path: 'dashboard',
        screens: {
          Calendar: 'calendar',
          AttendanceRequests: 'attendancerequests',
          Employees: 'employees',
          Leave: 'leave',
          Statistics: 'statistics',
          Settings: 'settings',
          ProfileSettings: 'profilesettings',
          Notifications: 'notifications',
        }
      }
    }
  }
};

const MainNavigator = () => {
  const { user, company } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={AuthScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
        </>
      ) : !company ? (
        <Stack.Screen name="Company" component={CompanySelection} />
      ) : (
        <Stack.Screen name="Dashboard" component={DashboardLayout} />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <MainNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
