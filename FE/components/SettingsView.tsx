import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const TimePickerModal = ({ visible, field, currentTime, onConfirm, onCancel }: any) => {
  const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));

  const [h, m] = (currentTime || '09:00:00').split(':');
  const [selectedH, setSelectedH] = useState(h || '09');
  const [selectedM, setSelectedM] = useState(m || '00');

  useEffect(() => {
    if (visible) {
      const [ch, cm] = (currentTime || '09:00:00').split(':');
      setSelectedH(ch || '09');
      setSelectedM(cm || '00');
    }
  }, [visible, currentTime]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.timePickerContainer}>
          <Text style={styles.timePickerTitle}>
            Chọn giờ {field === 'start' ? 'vào làm' : 'tan làm'}
          </Text>
          
          <View style={styles.timePickerWheels}>
            <View style={styles.wheelCol}>
              <Text style={styles.wheelHeader}>Giờ</Text>
              <ScrollView style={styles.wheelScroll} showsVerticalScrollIndicator={false}>
                {hours.map(hour => (
                  <TouchableOpacity 
                    key={hour} 
                    style={[styles.wheelItem, selectedH === hour && styles.wheelItemActive]}
                    onPress={() => setSelectedH(hour)}
                  >
                    <Text style={[styles.wheelText, selectedH === hour && styles.wheelTextActive]}>{hour}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.wheelSeparator}>:</Text>

            <View style={styles.wheelCol}>
              <Text style={styles.wheelHeader}>Phút</Text>
              <ScrollView style={styles.wheelScroll} showsVerticalScrollIndicator={false}>
                {minutes.map(minute => (
                  <TouchableOpacity 
                    key={minute} 
                    style={[styles.wheelItem, selectedM === minute && styles.wheelItemActive]}
                    onPress={() => setSelectedM(minute)}
                  >
                    <Text style={[styles.wheelText, selectedM === minute && styles.wheelTextActive]}>{minute}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.timePickerActions}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
              <Text style={styles.btnCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => onConfirm(`${selectedH}:${selectedM}:00`)}>
              <Text style={styles.btnSaveText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SettingsView = () => {
  const { user, company, applyServerState } = useAuth();
  
  const [startTime, setStartTime] = useState(company?.work_start_time || '09:00:00');
  const [endTime, setEndTime] = useState(company?.work_end_time || '18:00:00');
  const [flexibleMinutes, setFlexibleMinutes] = useState(company?.flexible_minutes?.toString() || '0');
  const [maxLeave, setMaxLeave] = useState(company?.max_leave_days?.toString() || '12');
  const [deadlineDays, setDeadlineDays] = useState(company?.leave_request_deadline_days?.toString() || '0');
  const [deadlineHours, setDeadlineHours] = useState(company?.leave_request_deadline_hours?.toString() || '0');

  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{visible: boolean, field: 'start'|'end'}>({visible: false, field: 'start'});

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/boss/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          user_id: user.id,
          work_start_time: startTime,
          work_end_time: endTime,
          flexible_minutes: parseInt(flexibleMinutes) || 0,
          max_leave_days: parseInt(maxLeave) || 12,
          leave_request_deadline_days: parseInt(deadlineDays) || 0,
          leave_request_deadline_hours: parseInt(deadlineHours) || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu thiết lập thành công!');
        applyServerState(data);
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể lưu thiết lập'));
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
    setLoading(false);
  };

  if (company?.role !== 'owner') {
    return (
      <View style={styles.container}>
        <Text style={{color: 'red'}}>Bạn không có quyền truy cập trang này.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý Công ty</Text>
        <Text style={styles.subtitle}>Thiết lập quy định chung cho toàn công ty</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Giờ Hành Chính</Text>
        <Text style={styles.sectionDesc}>Thiết lập mốc thời gian để hệ thống tính toán Đi muộn và Về sớm tự động.</Text>
        
        <View style={styles.formRow}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Giờ bắt đầu (Vào làm)</Text>
            <TouchableOpacity style={styles.timeInput} onPress={() => setShowTimePicker({visible: true, field: 'start'})}>
              <Ionicons name="time-outline" size={20} color="#4a72b5" style={{marginRight: 8}} />
              <Text style={styles.timeText}>{startTime}</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>Sau giờ này sẽ bị tính là Đi muộn</Text>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Giờ kết thúc (Tan làm)</Text>
            <TouchableOpacity style={styles.timeInput} onPress={() => setShowTimePicker({visible: true, field: 'end'})}>
              <Ionicons name="time-outline" size={20} color="#4a72b5" style={{marginRight: 8}} />
              <Text style={styles.timeText}>{endTime}</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>Trước giờ này sẽ bị tính là Về sớm</Text>
          </View>
        </View>

        <View style={[styles.formRow, { marginTop: 18 }]}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Thời gian linh động (Phút)</Text>
            <TextInput
              style={styles.input}
              value={flexibleMinutes}
              onChangeText={setFlexibleMinutes}
              keyboardType="numeric"
              placeholder="Ví dụ: 10"
            />
            <Text style={styles.helpText}>Trong khoảng này sẽ ghi nhận là Linh động, chưa tính Đi muộn</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Chế Độ Nghỉ Phép</Text>
        <Text style={styles.sectionDesc}>Số lượng ngày nghỉ phép có lương tiêu chuẩn mỗi năm cho nhân viên.</Text>
        
        <View style={styles.formRow}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Giới hạn nghỉ phép (Ngày/Năm)</Text>
            <TextInput
              style={styles.input}
              value={maxLeave}
              onChangeText={setMaxLeave}
              keyboardType="numeric"
              placeholder="Ví dụ: 12"
            />
          </View>
        </View>

        <View style={[styles.formRow, { marginTop: 18 }]}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Phải gửi đơn trước (Ngày)</Text>
            <TextInput
              style={styles.input}
              value={deadlineDays}
              onChangeText={setDeadlineDays}
              keyboardType="numeric"
              placeholder="Ví dụ: 1"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Phải gửi đơn trước (Giờ)</Text>
            <TextInput
              style={styles.input}
              value={deadlineHours}
              onChangeText={setDeadlineHours}
              keyboardType="numeric"
              placeholder="Ví dụ: 4"
            />
          </View>
        </View>
        <Text style={styles.helpText}>
          Ví dụ: 1 ngày 4 giờ nghĩa là đơn cho một ngày nghỉ phải gửi muộn nhất trước 00:00 của ngày đó 1 ngày 4 giờ.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.saveBtn, loading && {opacity: 0.7}]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Ionicons name="save-outline" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.saveBtnText}>{loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TimePickerModal
        visible={showTimePicker.visible}
        field={showTimePicker.field}
        currentTime={showTimePicker.field === 'start' ? startTime : endTime}
        onConfirm={(time: string) => {
          if (showTimePicker.field === 'start') setStartTime(time);
          else setEndTime(time);
          setShowTimePicker({visible: false, field: 'start'});
        }}
        onCancel={() => setShowTimePicker({visible: false, field: 'start'})}
      />
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a72b5',
    marginBottom: 5,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 25,
  },
  formRow: {
    flexDirection: 'row',
    gap: 20,
  },
  formGroup: {
    flex: 1,
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
    backgroundColor: '#f9f9f9',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  timeText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 30,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: 300,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  timePickerWheels: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 200,
    width: '100%',
    justifyContent: 'center',
  },
  wheelCol: {
    width: 70,
    alignItems: 'center',
  },
  wheelHeader: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  wheelScroll: {
    height: 160,
  },
  wheelItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  wheelItemActive: {
    backgroundColor: '#f5f8fd',
  },
  wheelText: {
    fontSize: 18,
    color: '#666',
  },
  wheelTextActive: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a72b5',
  },
  wheelSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 15,
  },
  timePickerActions: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginLeft: 10,
  },
  btnCancel: {
    backgroundColor: '#f5f5f5',
  },
  btnCancelText: {
    color: '#555',
    fontWeight: '600',
  },
  btnSave: {
    backgroundColor: '#4a72b5',
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});

export default SettingsView;
