import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Switch } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const normalizeTime = (value: any, fallback: string) => String(value || fallback).slice(0, 8);
const normalizeNumber = (value: any, fallback = 0) => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : Math.max(0, parsed);
};

type LeavePolicy = {
  id: number | string;
  name: string;
  period_type: 'monthly' | 'yearly';
  days: number;
  require_approval?: boolean;
};

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
  const [activeTab, setActiveTab] = useState<'workHours' | 'leavePolicy'>('workHours');
  
  const [startTime, setStartTime] = useState(company?.work_start_time || '09:00:00');
  const [endTime, setEndTime] = useState(company?.work_end_time || '18:00:00');
  const [flexibleMinutes, setFlexibleMinutes] = useState(company?.flexible_minutes?.toString() || '0');
  const [deadlineDays, setDeadlineDays] = useState(company?.leave_request_deadline_days?.toString() || '0');
  const [deadlineHours, setDeadlineHours] = useState(company?.leave_request_deadline_hours?.toString() || '0');
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [policyForm, setPolicyForm] = useState<{ id: number | string | null; name: string; period_type: 'monthly' | 'yearly'; days: string; require_approval: boolean }>({
    id: null,
    name: '',
    period_type: 'yearly',
    days: '0',
    require_approval: true,
  });
  const [showPolicyForm, setShowPolicyForm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{visible: boolean, field: 'start'|'end'}>({visible: false, field: 'start'});

  const fetchLeavePolicies = async () => {
    if (!company?.company_id) return;
    try {
      const res = await fetch(`${API_URL}/api/leave-types?company_id=${company.company_id}`);
      const data = await res.json();
      setLeavePolicies(data.leaveTypes || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setStartTime(company?.work_start_time || '09:00:00');
    setEndTime(company?.work_end_time || '18:00:00');
    setFlexibleMinutes(company?.flexible_minutes?.toString() || '0');
    setDeadlineDays(company?.leave_request_deadline_days?.toString() || '0');
    setDeadlineHours(company?.leave_request_deadline_hours?.toString() || '0');
    fetchLeavePolicies();
  }, [company?.company_id]);

  const buildChangedPayload = () => {
    const payload: Record<string, any> = {
      company_id: company.company_id,
      user_id: user.id,
    };

    if (activeTab === 'workHours') {
      const originalStartTime = normalizeTime(company?.work_start_time, '09:00:00');
      const originalEndTime = normalizeTime(company?.work_end_time, '18:00:00');
      const originalFlexibleMinutes = normalizeNumber(company?.flexible_minutes, 0);
      const nextStartTime = normalizeTime(startTime, '09:00:00');
      const nextEndTime = normalizeTime(endTime, '18:00:00');
      const nextFlexibleMinutes = normalizeNumber(flexibleMinutes, 0);

      if (nextStartTime !== originalStartTime) payload.work_start_time = nextStartTime;
      if (nextEndTime !== originalEndTime) payload.work_end_time = nextEndTime;
      if (nextFlexibleMinutes !== originalFlexibleMinutes) payload.flexible_minutes = nextFlexibleMinutes;
    }

    if (activeTab === 'leavePolicy') {
      const originalDeadlineDays = normalizeNumber(company?.leave_request_deadline_days, 0);
      const originalDeadlineHours = normalizeNumber(company?.leave_request_deadline_hours, 0);
      const nextDeadlineDays = normalizeNumber(deadlineDays, 0);
      const nextDeadlineHours = normalizeNumber(deadlineHours, 0);

      if (nextDeadlineDays !== originalDeadlineDays) payload.leave_request_deadline_days = nextDeadlineDays;
      if (nextDeadlineHours !== originalDeadlineHours) payload.leave_request_deadline_hours = nextDeadlineHours;
    }

    return payload;
  };

  const handleSave = async () => {
    const payload = buildChangedPayload();
    if (Object.keys(payload).length <= 2) {
      alert('Không có thay đổi để lưu.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = activeTab === 'workHours'
        ? `${API_URL}/api/boss/settings/work-hours`
        : `${API_URL}/api/boss/settings/leave-policy`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.changed === false ? 'Không có thay đổi để lưu.' : 'Đã lưu thiết lập thành công!');
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

  const resetPolicyForm = () => {
    setPolicyForm({ id: null, name: '', period_type: 'yearly', days: '0', require_approval: true });
    setShowPolicyForm(false);
  };

  const handleSavePolicy = async () => {
    const cleanName = policyForm.name.trim();
    if (!cleanName) {
      alert('Vui lòng nhập tên chính sách');
      return;
    }

    setPolicyLoading(true);
    try {
      const isEdit = Boolean(policyForm.id);
      const res = await fetch(`${API_URL}/api/leave-types${isEdit ? `/${policyForm.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          user_id: user.id,
          name: cleanName,
          period_type: policyForm.period_type,
          days: normalizeNumber(policyForm.days, 0),
          require_approval: policyForm.require_approval,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể lưu chính sách nghỉ phép');
        setPolicyLoading(false);
        return;
      }
      resetPolicyForm();
      fetchLeavePolicies();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
    setPolicyLoading(false);
  };

  const handleDeletePolicy = async (policy: LeavePolicy) => {
    if (!confirm(`Bạn có chắc muốn xóa chính sách ${policy.name} không?`)) return;

    setPolicyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave-types/${policy.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          user_id: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể xóa chính sách nghỉ phép');
        setPolicyLoading(false);
        return;
      }
      fetchLeavePolicies();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
    setPolicyLoading(false);
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

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'workHours' && styles.tabBtnActive]}
          onPress={() => setActiveTab('workHours')}
        >
          <Text style={[styles.tabText, activeTab === 'workHours' && styles.tabTextActive]}>Giờ hành chính</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'leavePolicy' && styles.tabBtnActive]}
          onPress={() => setActiveTab('leavePolicy')}
        >
          <Text style={[styles.tabText, activeTab === 'leavePolicy' && styles.tabTextActive]}>Chế độ nghỉ phép</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {activeTab === 'workHours' && (
          <>
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
          </>
        )}

        {activeTab === 'leavePolicy' && (
          <>
            <Text style={styles.sectionTitle}>Chế Độ Nghỉ Phép</Text>
            <Text style={styles.sectionDesc}>Thiết lập hạn gửi đơn và các chính sách nghỉ phép áp dụng trong công ty.</Text>
            
            <View style={styles.formRow}>
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

            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle}>Danh sách chính sách nghỉ phép</Text>
              {!showPolicyForm && (
                <TouchableOpacity
                  style={styles.smallAddBtn}
                  onPress={() => {
                    setPolicyForm({ id: null, name: '', period_type: 'yearly', days: '0', require_approval: true });
                    setShowPolicyForm(true);
                  }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.smallAddBtnText}>Thêm</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.policyTable}>
              <View style={styles.policyTableHeader}>
                <Text style={[styles.policyCell, {flex: 2, fontWeight: 'bold'}]}>Tên</Text>
                <Text style={[styles.policyCell, {flex: 1.2, fontWeight: 'bold'}]}>Loại</Text>
                <Text style={[styles.policyCell, {flex: 1, fontWeight: 'bold'}]}>Số ngày nghỉ</Text>
                <Text style={[styles.policyCell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Cần duyệt</Text>
                <Text style={[styles.policyCell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Hành động</Text>
              </View>

              {showPolicyForm && (
                <View style={[styles.policyTableRow, styles.policyEditRow]}>
                  <View style={{flex: 2, paddingRight: 10}}>
                    <TextInput
                      style={styles.compactInput}
                      value={policyForm.name}
                      onChangeText={name => setPolicyForm({...policyForm, name})}
                      placeholder="Tên chính sách"
                    />
                  </View>
                  <View style={{flex: 1.2, flexDirection: 'row', gap: 8, paddingRight: 10}}>
                    <TouchableOpacity
                      style={[styles.periodBtn, policyForm.period_type === 'monthly' && styles.periodBtnActive]}
                      onPress={() => setPolicyForm({...policyForm, period_type: 'monthly'})}
                    >
                      <Text style={[styles.periodBtnText, policyForm.period_type === 'monthly' && styles.periodBtnTextActive]}>Tháng</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.periodBtn, policyForm.period_type === 'yearly' && styles.periodBtnActive]}
                      onPress={() => setPolicyForm({...policyForm, period_type: 'yearly'})}
                    >
                      <Text style={[styles.periodBtnText, policyForm.period_type === 'yearly' && styles.periodBtnTextActive]}>Năm</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{flex: 1, paddingRight: 10}}>
                    <TextInput
                      style={styles.compactInput}
                      value={policyForm.days}
                      onChangeText={days => setPolicyForm({...policyForm, days})}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.policyApprovalCell}>
                    <Switch
                      value={policyForm.require_approval}
                      onValueChange={value => setPolicyForm({...policyForm, require_approval: value})}
                      trackColor={{ false: '#ddd', true: '#4a72b5' }}
                      thumbColor="#fff"
                    />
                    <Text style={styles.policyApprovalText}>{policyForm.require_approval ? 'Có' : 'Không'}</Text>
                  </View>
                  <View style={styles.policyActions}>
                    <TouchableOpacity style={styles.policyIconBtn} onPress={handleSavePolicy} disabled={policyLoading}>
                      <Ionicons name="checkmark" size={18} color="#4caf50" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.policyIconBtn} onPress={resetPolicyForm} disabled={policyLoading}>
                      <Ionicons name="close" size={18} color="#f28baf" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {leavePolicies.map(policy => (
                <View key={policy.id} style={styles.policyTableRow}>
                  <Text style={[styles.policyCell, {flex: 2}]}>{policy.name}</Text>
                  <Text style={[styles.policyCell, {flex: 1.2}]}>{policy.period_type === 'monthly' ? 'Theo tháng' : 'Theo năm'}</Text>
                  <Text style={[styles.policyCell, {flex: 1}]}>{Number(policy.days || 0)}</Text>
                  <Text style={[styles.policyCell, {flex: 1, textAlign: 'center', fontWeight: '600', color: policy.require_approval ? '#b91c1c' : '#15803d'}]}>
                    {policy.require_approval ? 'Có' : 'Không'}
                  </Text>
                  <View style={styles.policyActions}>
                    <TouchableOpacity
                      style={styles.policyIconBtn}
                      onPress={() => {
                        setPolicyForm({
                          id: policy.id,
                          name: policy.name,
                          period_type: policy.period_type === 'monthly' ? 'monthly' : 'yearly',
                          days: String(policy.days || 0),
                          require_approval: Boolean(policy.require_approval),
                        });
                        setShowPolicyForm(true);
                      }}
                    >
                      <Ionicons name="pencil" size={17} color="#4a72b5" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.policyIconBtn} onPress={() => handleDeletePolicy(policy)} disabled={policyLoading}>
                      <Ionicons name="trash" size={17} color="#f28baf" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {leavePolicies.length === 0 && (
                <Text style={styles.emptyPolicyText}>Chưa có chính sách nghỉ phép nào.</Text>
              )}
            </View>
          </>
        )}

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
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4a72b5',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#4a72b5',
    fontWeight: 'bold',
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
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  policyTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a72b5',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallAddBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  policyTable: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
  },
  policyTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  policyTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  policyEditRow: {
    backgroundColor: '#f5f8fd',
  },
  policyCell: {
    fontSize: 14,
    color: '#444',
  },
  policyApprovalCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
  },
  policyApprovalText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
  },
  compactInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  periodBtnActive: {
    borderColor: '#4a72b5',
    backgroundColor: '#eef4ff',
  },
  periodBtnText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  periodBtnTextActive: {
    color: '#4a72b5',
    fontWeight: 'bold',
  },
  policyActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  policyIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPolicyText: {
    padding: 18,
    textAlign: 'center',
    color: '#888',
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
