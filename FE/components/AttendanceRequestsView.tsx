import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../context/AuthContext';
import SearchableDropdown from './SearchableDropdown';

const AttendanceRequestsView = () => {
  const { user, company } = useAuth();
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(requestDate || new Date().toISOString().slice(0, 10));

  const isEmployee = company.role === 'employee';
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchData = async () => {
    setLoading(true);
    try {
      const requestsUrl = `${API_URL}/api/attendance-requests?company_id=${company.company_id}&user_id=${user.id}&role=${company.role}`;
      const attendanceUrl = `${API_URL}/api/attendance?company_id=${company.company_id}&role=${company.role}&linked_enno=${company.linked_enno || ''}`;
      const [resRequests, resAttendance] = await Promise.all([
        fetch(requestsUrl),
        fetch(attendanceUrl),
      ]);

      const dataRequests = await resRequests.json();
      const dataAttendance = await resAttendance.json();
      let fetchedEmployees = dataAttendance.employees || [];

      if (!isEmployee) {
        const resPersonnel = await fetch(`${API_URL}/api/boss/personnel?company_id=${company.company_id}`);
        const dataPersonnel = await resPersonnel.json();
      }

      setAttendanceRequests(dataRequests.requests || []);
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Error fetching attendance requests:', err);
      alert('Lỗi tải phiếu chấm công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAttendanceRequestModal = () => {
    const today = new Date();
    const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
    setRequestDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setRequestTime(nowTime);
    setRequestReason('');
    setShowRequestModal(true);
  };

  const handleSubmitAttendanceRequest = async () => {
    if (!requestDate.trim() || !requestTime.trim()) return alert('Vui lòng nhập ngày và giờ');

    setSubmittingRequest(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          company_id: company.company_id,
          date: requestDate.trim(),
          time: requestTime.trim(),
          reason: requestReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể tạo phiếu chấm công');
        return;
      }
      setShowRequestModal(false);
      await fetchData();
      const msg = company.role === 'owner' ? 'Đã lưu phiếu chấm công.' : 'Đã tạo phiếu chấm công, chờ duyệt.';
      alert(data.mailWarning ? `${msg}\n\n${data.mailWarning}` : msg);
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleApproveAttendanceRequest = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`${API_URL}/api/attendance-requests/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          reviewer_id: user.id,
          approval_status: status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể xử lý phiếu chấm công');
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteAttendanceRequest = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu chấm công này không?')) return;
    try {
      const res = await fetch(`${API_URL}/api/attendance-requests/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          reviewer_id: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể xóa phiếu chấm công');
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
  };

  const renderCalendarHeader = ({ month, addMonth }: any) => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthLabel = month?.toString?.('MMMM yyyy') || '';
    return (
      <View>
        <View style={styles.calendarHeaderRow}>
          <View style={styles.calendarHeaderSide}>
            <TouchableOpacity style={styles.calendarHeaderBtn} onPress={() => addMonth?.(-12)}>
              <Text style={styles.calendarHeaderIcon}>◀◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarHeaderBtn} onPress={() => addMonth?.(-1)}>
              <Text style={styles.calendarHeaderIcon}>◀</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.calendarHeaderTitle}>{monthLabel}</Text>
          <View style={[styles.calendarHeaderSide, {justifyContent: 'flex-end'}]}>
            <TouchableOpacity style={styles.calendarHeaderBtn} onPress={() => addMonth?.(1)}>
              <Text style={styles.calendarHeaderIcon}>▶</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarHeaderBtn} onPress={() => addMonth?.(12)}>
              <Text style={styles.calendarHeaderIcon}>▶▶</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.calendarWeekRow}>
          {weekDays.map(day => (
            <Text key={day} style={styles.calendarWeekDay}>{day}</Text>
          ))}
        </View>
      </View>
    );
  };

  const statusLabel: Record<string, string> = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
  };
  const statusColor: Record<string, string> = {
    pending: '#d97706',
    approved: '#15803d',
    rejected: '#b91c1c',
  };

  const isOwner = company.role === 'owner';
  const isManager = company.role === 'manager';
  const canApprove = (req: any) => {
    if (req.user_id === user.id) return false;
    if (isOwner) return true;
    if (isManager && req.submitter_role !== 'manager' && req.submitter_role !== 'owner') return true;
    return false;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Phiếu chấm công</Text>
            <Text style={styles.panelSubtitle}>Tạo và duyệt các lần chấm công bổ sung khi máy chấm công bị lỗi.</Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={openAttendanceRequestModal}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.createText}>Tạo phiếu</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#4a72b5" />
          </View>
        ) : attendanceRequests.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có phiếu chấm công nào.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>Người gửi</Text>
              <Text style={[styles.cell, {flex: 1.2, fontWeight: 'bold'}]}>Ngày</Text>
              <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold'}]}>Giờ</Text>
              <Text style={[styles.cell, {flex: 1, fontWeight: 'bold'}]}>Trạng thái</Text>
              {!isEmployee && <Text style={[styles.cell, {flex: 1.2, textAlign: 'center', fontWeight: 'bold'}]}>Thao tác</Text>}
            </View>
            {attendanceRequests.map(req => (
              <View key={req.id} style={styles.tableRow}>
                <Text style={[styles.cell, {flex: 1.5}]}>{req.username || req.machine_name || req.enno}</Text>
                <Text style={[styles.cell, {flex: 1.2}]}>{req.date}</Text>
                <Text style={[styles.cell, {flex: 0.8}]}>{String(req.time || '').slice(0, 5)}</Text>
                <Text style={[styles.cell, {flex: 1, color: statusColor[req.approval_status] || '#444', fontWeight: 'bold'}]}>
                  {statusLabel[req.approval_status] || req.approval_status}
                </Text>
                {!isEmployee && (
                  <View style={styles.actions}>
                    {req.approval_status === 'pending' && canApprove(req) ? (
                      <>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#15803d'}]} onPress={() => handleApproveAttendanceRequest(req.id, 'approved')}>
                          <Text style={styles.actionText}>Duyệt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#b91c1c'}]} onPress={() => handleApproveAttendanceRequest(req.id, 'rejected')}>
                          <Text style={styles.actionText}>Từ chối</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.doneText}>
                        {req.approval_status === 'pending' ? 'Chờ sếp duyệt' : 'Đã xử lý'}
                      </Text>
                    )}
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#6b7280', marginLeft: (req.approval_status === 'pending' && canApprove(req)) ? 0 : 8}]} onPress={() => handleDeleteAttendanceRequest(req.id)}>
                      <Text style={styles.actionText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={showRequestModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tạo phiếu chấm công</Text>
            <Text style={styles.modalLabel}>Ngày</Text>
            <TouchableOpacity
              style={[styles.modalInput, { justifyContent: 'center' }]}
              onPress={() => {
                setCalendarMonth(requestDate || new Date().toISOString().slice(0, 10));
                setShowCalendar(true);
              }}
            >
              <Text style={{ color: requestDate ? '#333' : '#888' }}>
                {requestDate || 'Chọn ngày...'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.modalLabel}>Giờ</Text>
            <TextInput
              style={styles.modalInput}
              value={requestTime}
              onChangeText={setRequestTime}
              placeholder="HH:mm"
            />
            <Text style={styles.modalLabel}>Lý do</Text>
            <TextInput
              style={[styles.modalInput, styles.reasonInput]}
              value={requestReason}
              onChangeText={setRequestReason}
              placeholder="Ví dụ: Máy chấm công bị lỗi..."
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRequestModal(false)} disabled={submittingRequest}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmitAttendanceRequest} disabled={submittingRequest}>
                {submittingRequest ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Gửi phiếu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCalendar} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: 340 }]}>
            <Calendar
              key={calendarMonth}
              current={calendarMonth}
              customHeader={renderCalendarHeader}
              showSixWeeks
              hideExtraDays={false}
              style={styles.fixedCalendar}
              onMonthChange={(month: any) => setCalendarMonth(month.dateString)}
              onDayPress={(day: any) => {
                setRequestDate(day.dateString);
                setCalendarMonth(day.dateString);
                setShowCalendar(false);
              }}
              markedDates={{
                [requestDate]: {selected: true, selectedColor: '#4a72b5'}
              }}
              theme={{
                selectedDayBackgroundColor: '#4a72b5',
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  panelSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#4a72b5',
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  createText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  loadingBox: {
    padding: 24,
  },
  emptyText: {
    padding: 18,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  table: {
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  cell: {
    fontSize: 13,
    color: '#444',
    paddingRight: 8,
  },
  actions: {
    flex: 1.2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  doneText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    shadowColor: '#111827',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 7,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  reasonInput: {
    minHeight: 84,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelText: {
    color: '#555',
    fontWeight: '600',
  },
  saveBtn: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: '#4a72b5',
    borderRadius: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  fixedCalendar: {
    height: 332,
  },
  calendarHeaderRow: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  calendarHeaderSide: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarHeaderBtn: {
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHeaderIcon: {
    color: '#4a72b5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  calendarHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#4f6180',
    fontSize: 16,
    fontWeight: '500',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
  },
  calendarWeekDay: {
    width: 38,
    textAlign: 'center',
    color: '#b8c0d0',
    fontSize: 14,
    fontWeight: '600',
  },
  closeModalBtn: {
    marginTop: 15,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  closeModalText: {
    fontWeight: 'bold',
    color: '#555',
  },
});

export default AttendanceRequestsView;
