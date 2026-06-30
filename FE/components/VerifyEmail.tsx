import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const VerifyEmail = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const token = route.params?.token;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Không tìm thấy mã xác thực.');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Xác thực email thành công!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Xác thực thất bại.');
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage('Lỗi kết nối máy chủ.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#4a72b5" />
            <Text style={styles.text}>Đang xác thực tài khoản...</Text>
          </>
        ) : (
          <>
            <Ionicons 
              name={status === 'success' ? 'checkmark-circle' : 'close-circle'} 
              size={64} 
              color={status === 'success' ? '#15803d' : '#b91c1c'} 
            />
            <Text style={[styles.title, { color: status === 'success' ? '#15803d' : '#b91c1c' }]}>
              {status === 'success' ? 'Thành Công!' : 'Thất Bại!'}
            </Text>
            <Text style={styles.text}>{message}</Text>
            
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.buttonText}>Về trang đăng nhập</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 25,
  },
  button: {
    backgroundColor: '#4a72b5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VerifyEmail;
