import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const ProfileSettingsView = () => {
  const { user, applyServerState } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const wantsPasswordChange = Boolean(newPassword || confirmPassword);
    const trimmedUsername = username.trim();
    const payload: any = { user_id: user.id };

    if (!trimmedUsername) {
      alert('Tên không được để trống');
      return;
    }

    if (trimmedUsername !== user.username) {
      payload.username = trimmedUsername;
    }

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Vui lòng nhập đủ thông tin đổi mật khẩu');
        return;
      }
      if (newPassword.length < 6) {
        alert('Mật khẩu mới phải có ít nhất 6 ký tự');
        return;
      }
      if (newPassword !== confirmPassword) {
        alert('Xác nhận mật khẩu mới không khớp');
        return;
      }
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    if (Object.keys(payload).length === 1) {
      alert('Không có thông tin nào thay đổi');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Không thể cập nhật thông tin cá nhân');
        return;
      }

      applyServerState(data);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Đã cập nhật thông tin cá nhân');
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông tin cá nhân</Text>
        <Text style={styles.subtitle}>Cập nhật tên hiển thị và mật khẩu đăng nhập</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hồ sơ</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={[styles.input, styles.inputDisabled]} value={user?.email || ''} editable={false} />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tên hiển thị</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Nhập tên hiển thị"
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
        <View style={styles.formRow}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Mật khẩu hiện tại</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Nhập mật khẩu hiện tại"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Mật khẩu mới</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Ít nhất 6 ký tự"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Nhập lại mật khẩu mới"
            />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.saveBtn, loading && {opacity: 0.7}]} onPress={handleSave} disabled={loading}>
            <Ionicons name="save-outline" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.saveBtnText}>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  card: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a72b5',
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 20,
  },
  formGroup: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    outlineStyle: 'none' as any,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 18,
  },
  actions: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#4a72b5',
    paddingHorizontal: 25,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileSettingsView;
