import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const SESSION_KEY = 'sessionToken';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyServerState = (state: any) => {
    setUser(state.user || null);
    setCompany(state.company || null);
  };

  const fetchSession = async (sessionToken: string) => {
    const res = await fetch(`${API_URL}/api/session`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) throw new Error('Invalid session');
    const data = await res.json();
    applyServerState(data);
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(SESSION_KEY);
        if (storedToken) {
          setToken(storedToken);
          await fetchSession(storedToken);
        }
      } catch (e) {
        await AsyncStorage.removeItem(SESSION_KEY);
        setToken(null);
        setUser(null);
        setCompany(null);
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  const login = async (data: any) => {
    if (!data.token) throw new Error('Missing session token');
    setToken(data.token);
    await AsyncStorage.setItem(SESSION_KEY, data.token);
    applyServerState(data);
  };

  const logout = async () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    setCompany(null);
    await AsyncStorage.removeItem(SESSION_KEY);

    if (currentToken) {
      fetch(`${API_URL}/api/session`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => undefined);
    }
  };

  const refreshSession = async () => {
    if (!token) return;
    await fetchSession(token);
  };

  const updateCompany = async (companyData: any) => {
    if (!user?.id || !companyData?.company_id) {
      setCompany(companyData || null);
      return;
    }

    const res = await fetch(`${API_URL}/api/users/selected-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, company_id: companyData.company_id }),
    });
    if (!res.ok) throw new Error('Could not update selected company');
    const data = await res.json();
    applyServerState(data);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4a72b5" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, company, token, login, logout, refreshSession, updateCompany, applyServerState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
