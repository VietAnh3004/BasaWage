import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const CompanySelection = () => {
  const { user, applyServerState, logout } = useAuth();
  const [view, setView] = useState('menu');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!companyName.trim()) {
      setError('Vui lòng nhập tên công ty');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/companies/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim(), user_id: user.id })
      });
      const data = await res.json();
      if (data.success) {
        applyServerState(data);
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Xin chào, {user.username}!</Text>
          <TouchableOpacity onPress={logout}>
            <Ionicons name="log-out-outline" size={24} color="#f28baf" />
          </TouchableOpacity>
        </View>

        {view === 'menu' && (
          <View>
            <Text style={styles.subtitle}>
              Tài khoản đăng ký mới dành riêng cho chủ doanh nghiệp. Hãy tạo công ty để bắt đầu.
            </Text>

            <TouchableOpacity style={styles.actionBtn} onPress={() => { setView('create'); setError(''); }}>
              <Ionicons name="business-outline" size={24} color="#4a72b5" />
              <Text style={styles.actionBtnText}>Tạo Công Ty Mới</Text>
            </TouchableOpacity>
          </View>
        )}

        {view === 'create' && (
          <View>
            <TouchableOpacity style={styles.backBtn} onPress={() => setView('menu')}>
              <Ionicons name="arrow-back" size={20} color="#888" />
              <Text style={styles.backText}>Quay lại</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Tạo Công Ty</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tên công ty của bạn</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="VD: Công ty TNHH ABC..."
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Tạo Ngay</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4fa',
  },
  card: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 500,
    padding: 30,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f4fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe6f5',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a72b5',
    marginLeft: 15,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backText: {
    color: '#888',
    marginLeft: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    outlineStyle: 'none' as any,
  },
  submitBtn: {
    backgroundColor: '#4a72b5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#f28baf',
    marginBottom: 15,
    fontWeight: '500',
  }
});

export default CompanySelection;
