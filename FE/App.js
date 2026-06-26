import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import CompanySelection from './components/CompanySelection';
import DashboardLayout from './screens/DashboardLayout';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['http://localhost:8081', 'chamcong://'],
  config: {
    screens: {
      Login: 'login',
      Company: 'company',
      Dashboard: {
        path: 'dashboard',
        screens: {
          Calendar: 'calendar',
          Employees: 'employees',
          Leave: 'leave',
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
        <Stack.Screen name="Login" component={AuthScreen} />
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
