import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục trạng thái đăng nhập từ Storage khi load ứng dụng
  useEffect(() => {
    const loadState = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedCompany = await AsyncStorage.getItem('company');
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedCompany) setCompany(JSON.parse(storedCompany));
      } catch (e) {
        console.error("Failed to load auth state", e);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  const login = async (userData: any) => {
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));

    if (userData.memberships && userData.memberships.length > 0) {
      setCompany(userData.memberships[0]);
      await AsyncStorage.setItem('company', JSON.stringify(userData.memberships[0]));
    } else {
      setCompany(null);
      await AsyncStorage.removeItem('company');
    }
  };

  const logout = async () => {
    setUser(null);
    setCompany(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('company');
  };

  const updateCompany = async (companyData: any) => {
    setCompany(companyData);
    await AsyncStorage.setItem('company', JSON.stringify(companyData));
  };

  // Tránh render quá sớm khi chưa load xong storage
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4a72b5" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, company, login, logout, updateCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
