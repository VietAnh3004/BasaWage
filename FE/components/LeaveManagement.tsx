import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const LeaveManagement = () => {
  const { user, company } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form for employee
  const [dateStr, setDateStr] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const isEmployee = company.role === 'employee';

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave?company_id=${company.company_id}&user_id=${user.id}&role=${company.role}`);
      const data = await res.json();
      if (data.leaveRequests) {
        setLeaves(data.leaveRequests);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmitLeave = async () => {
    if (!dateStr || !reason) {
      alert("Vui lòng nhập Ngày và Lý do");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          company_id: company.company_id,
          date: dateStr,
          reason
        })
      });
      if (res.ok) {
        setDateStr('');
        setReason('');
        fetchLeaves();
        alert("Đã tạo đơn xin nghỉ thành công!");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
    }
    setSubmitting(false);
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quản lý Nghỉ phép</Text>
      <Text style={styles.subtitle}>
        {isEmployee ? "Bạn có thể gửi đơn xin nghỉ tại đây. Đơn sẽ tự động được ghi nhận." : "Xem danh sách nhân viên xin nghỉ phép của công ty."}
      </Text>

      {isEmployee && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Tạo đơn nghỉ phép mới</Text>
          
          <View style={styles.inputRow}>
            <View style={{flex: 1, marginRight: 15}}>
              <Text style={styles.label}>Ngày nghỉ (YYYY-MM-DD)</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowCalendar(true)}>
                <Text style={{color: dateStr ? '#333' : '#888'}}>
                  {dateStr || 'Chọn ngày nghỉ...'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{flex: 2}}>
              <Text style={styles.label}>Lý do</Text>
              <TextInput 
                style={styles.input} 
                value={reason} 
                onChangeText={setReason} 
                placeholder="Lý do nghỉ..." 
              />
            </View>
          </View>
          
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLeave} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? 'Đang gửi...' : 'Gửi Đơn'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Lịch Xịn Xò */}
      <Modal visible={showCalendar} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={(day) => {
                setDateStr(day.dateString);
                setShowCalendar(false);
              }}
              markedDates={{
                [dateStr]: {selected: true, selectedColor: '#f28baf'}
              }}
              theme={{
                selectedDayBackgroundColor: '#f28baf',
                todayTextColor: '#4a72b5',
                arrowColor: '#4a72b5',
              }}
            />
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowCalendar(false)}>
              <Text style={styles.closeModalText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.listTitle}>Danh sách đơn nghỉ phép</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          {!isEmployee && <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Người gửi</Text>}
          <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Ngày nghỉ</Text>
          <Text style={[styles.cell, {flex: 3, fontWeight: 'bold'}]}>Lý do</Text>
          <Text style={[styles.cell, {flex: 1, fontWeight: 'bold', textAlign: 'right'}]}>Trạng thái</Text>
        </View>

        {leaves.length === 0 && (
           <Text style={{padding: 20, textAlign: 'center', color: '#888'}}>Chưa có đơn nghỉ phép nào.</Text>
        )}

        {leaves.map(l => (
          <View key={l.id} style={styles.tableRow}>
            {!isEmployee && <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>{l.username}</Text>}
            <Text style={[styles.cell, {flex: 2}]}>{l.date}</Text>
            <Text style={[styles.cell, {flex: 3, color: '#666'}]}>{l.reason}</Text>
            <Text style={[styles.cell, {flex: 1, textAlign: 'right', color: '#4a72b5', fontWeight: 'bold'}]}>Đã ghi nhận</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 30,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#4a72b5',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    outlineStyle: 'none' as any,
    backgroundColor: '#fafafa',
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    height: 40,
  },
  submitBtn: {
    backgroundColor: '#4a72b5',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  cell: {
    fontSize: 14,
    color: '#444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 5,
  },
  closeModalBtn: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalText: {
    fontWeight: 'bold',
    color: '#555',
  }
});

export default LeaveManagement;
