import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [requestEnno, setRequestEnno] = useState<string | null>(company.role === 'employee' ? company.linked_enno : null);
  const [loading, setLoading] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);

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
        const personnelList = dataPersonnel.personnel || [];
        fetchedEmployees = fetchedEmployees.filter((emp: any) => {
          const personnel = personnelList.find((p: any) => p.enno === emp.enNo);
          return !personnel || personnel.status !== 'inactive';
        });
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
    setRequestEnno(company.role === 'employee' ? company.linked_enno : null);
    setShowRequestModal(true);
  };

  const handleSubmitAttendanceRequest = async () => {
    if (!requestDate.trim() || !requestTime.trim()) return alert('Vui lòng nhập ngày và giờ');
    if (!isEmployee && !requestEnno) return alert('Vui lòng chọn nhân viên');

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
          enno: requestEnno,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể tạo phiếu chấm công');
        return;
      }
      setShowRequestModal(false);
      await fetchData();
      alert(data.mailWarning ? `Đã tạo phiếu chấm công.\n\n${data.mailWarning}` : 'Đã tạo phiếu chấm công, chờ duyệt.');
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
                    {req.approval_status === 'pending' ? (
                      <>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#15803d'}]} onPress={() => handleApproveAttendanceRequest(req.id, 'approved')}>
                          <Text style={styles.actionText}>Duyệt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#b91c1c'}]} onPress={() => handleApproveAttendanceRequest(req.id, 'rejected')}>
                          <Text style={styles.actionText}>Từ chối</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.doneText}>Đã xử lý</Text>
                    )}
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
            {!isEmployee && (
              <>
                <Text style={styles.modalLabel}>Nhân viên</Text>
                <SearchableDropdown
                  data={employees}
                  value={requestEnno}
                  onChange={setRequestEnno}
                  placeholder="Chọn nhân viên"
                  searchPlaceholder="Tìm kiếm nhân viên..."
                  keyExtractor={(item) => item.enNo}
                  labelExtractor={(item) => item.name}
                  showClear={false}
                  style={{width: '100%'}}
                />
              </>
            )}
            <Text style={styles.modalLabel}>Ngày</Text>
            <TextInput
              style={styles.modalInput}
              value={requestDate}
              onChangeText={setRequestDate}
              placeholder="YYYY-MM-DD"
            />
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
});

export default AttendanceRequestsView;
