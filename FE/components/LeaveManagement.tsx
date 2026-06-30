import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Pagination from './Pagination';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_LEAVE_TYPES = ['Nghỉ phép', 'Công tác'];

type LeavePolicy = {
  id?: number | string;
  name: string;
  period_type?: 'monthly' | 'yearly';
  days?: number;
  require_approval?: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  approved: '#4caf50',
  pending: '#ffa500',
  rejected: '#f44336',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Đã duyệt',
  pending: 'Chờ duyệt',
  rejected: 'Từ chối',
};

const LeaveManagement = () => {
  const { user, company } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  // Form for employee
  const [dateStr, setDateStr] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('Nghỉ phép');
  const [submitting, setSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [leaveCalendarMonth, setLeaveCalendarMonth] = useState(dateStr || new Date().toISOString().slice(0, 10));
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Leave type dropdown
  const [leaveTypes, setLeaveTypes] = useState<string[]>(DEFAULT_LEAVE_TYPES);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([
    { name: 'Nghỉ phép', period_type: 'yearly', days: company.max_leave_days || 12, require_approval: false },
    { name: 'Công tác', period_type: 'yearly', days: 0, require_approval: true },
  ]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const isEmployee = company.role === 'employee';
  const isManager = company.role === 'manager';
  const isOwner = company.role === 'owner';
  const canSubmitLeave = isEmployee || isManager || isOwner;
  const canApprove = isOwner || isManager; // both can approve, but managers can't approve manager-submitted leaves
  const selectedPolicy = leavePolicies.find(policy => policy.name === leaveType);
  const selectedRequiresApproval = Boolean(selectedPolicy?.require_approval ?? true);
  const isAutoApprovedLeave = isOwner || !selectedRequiresApproval;
  const getLeaveSubmissionDeadline = (leaveDate: string) => {
    const days = Number(company.leave_request_deadline_days || 0);
    const hours = Number(company.leave_request_deadline_hours || 0);
    const advanceMs = ((days * 24) + hours) * 60 * 60 * 1000;
    if (advanceMs <= 0) return null;

    const leaveStart = new Date(`${leaveDate}T00:00:00`);
    if (Number.isNaN(leaveStart.getTime())) return null;
    return new Date(leaveStart.getTime() - advanceMs);
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave?company_id=${company.company_id}&user_id=${user.id}&role=${company.role}`);
      const data = await res.json();
      if (data.leaveRequests) {
        setLeaves(data.leaveRequests);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leave-types?company_id=${company.company_id}`);
      const data = await res.json();
      const policies = data.leaveTypes || [];
      setLeavePolicies(policies);
      const fetchedTypes = policies.map((t: any) => t.name) || [];
      setLeaveTypes(Array.from(new Set([...DEFAULT_LEAVE_TYPES, ...fetchedTypes])));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchLeaveTypes();
  }, []);

  const renderLeaveCalendarHeader = ({ month, addMonth }: any) => {
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

  const getPolicyRemaining = (policy?: LeavePolicy | null) => {
    const maxDays = Number(policy?.days || 0);
    if (maxDays <= 0) return { remaining: null, maxDays, usedDays: 0 };

    const periodType = policy?.period_type === 'monthly' ? 'monthly' : 'yearly';
    const baseDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    const year = baseDate.getFullYear();
    const monthNumber = baseDate.getMonth() + 1;

    if (periodType === 'monthly') {
      const currentYearPrefix = `${year}-`;
      const currentMonthLimit = `${year}-${String(monthNumber).padStart(2, '0')}-31`;
      const currentYearUsedDays = leaves.filter((l: any) =>
        l.approval_status === 'approved' &&
        l.user_id === user.id &&
        (l.leave_type || 'Nghỉ phép') === policy?.name &&
        String(l.date || '').startsWith(currentYearPrefix) &&
        String(l.date || '') <= currentMonthLimit
      ).length;
      const carryoverDays = monthNumber === 1
        ? Math.max(0, maxDays * 12 - leaves.filter((l: any) =>
            l.approval_status === 'approved' &&
            l.user_id === user.id &&
            (l.leave_type || 'Nghỉ phép') === policy?.name &&
            String(l.date || '').startsWith(`${year - 1}-`)
          ).length)
        : 0;
      const accruedMaxDays = maxDays * monthNumber + carryoverDays;
      return {
        remaining: Math.max(0, accruedMaxDays - currentYearUsedDays),
        maxDays: accruedMaxDays,
        usedDays: currentYearUsedDays,
      };
    }

    const datePrefix = `${year}-`;
    const usedDays = leaves.filter((l: any) =>
      l.approval_status === 'approved' &&
      l.user_id === user.id &&
      (l.leave_type || 'Nghỉ phép') === policy?.name &&
      String(l.date || '').startsWith(datePrefix)
    ).length;

    return { remaining: Math.max(0, maxDays - usedDays), maxDays, usedDays };
  };

  const handleSubmitLeave = async () => {
    if (!dateStr || !reason) {
      alert("Vui lòng nhập Ngày và Lý do");
      return;
    }
    const selectedRemaining = getPolicyRemaining(selectedPolicy);
    if (selectedRemaining.remaining !== null && selectedRemaining.remaining <= 0) {
      alert(`Bạn đã hết quỹ ${leaveType}.`);
      return;
    }
    const submitDeadline = getLeaveSubmissionDeadline(dateStr);
    if (submitDeadline && new Date() > submitDeadline) {
      alert(`Đã quá hạn gửi đơn. Đơn cho ngày ${dateStr} phải được gửi muộn nhất lúc ${submitDeadline.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}.`);
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
          reason,
          leave_type: leaveType,
          submitter_role: company.role,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể gửi đơn");
        setSubmitting(false);
        return;
      }
      if (res.ok) {
        setDateStr('');
        setReason('');
        setLeaveType('Nghỉ phép');
        fetchLeaves();
        const msg = isAutoApprovedLeave
          ? "Đã tạo đơn vắng mặt thành công!"
          : isManager
            ? "Đã gửi đơn, chờ Sếp tổng phê duyệt!"
            : "Đã gửi đơn, chờ Sếp tổng hoặc quản lý phê duyệt!";
        alert(data.mailWarning ? `${msg}\n\n${data.mailWarning}` : msg);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
    }
    setSubmitting(false);
  };

  const handleRecallLeave = async (id: string) => {
    if (!confirm("Bạn có chắc muốn rút lại đơn vắng mặt này không?")) return;
    try {
      const res = await fetch(`${API_URL}/api/leave/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        fetchLeaves();
        alert("Đã rút lại đơn.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối");
    }
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    // Optimistic update: flip approval_status immediately
    setLeaves(prev => prev.map((l: any) => l.id === id ? { ...l, approval_status: status } : l));
    try {
      await fetch(`${API_URL}/api/leave/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: status }),
      });
    } catch (err) {
      console.error(err);
      // Revert on error
      fetchLeaves();
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  const totalLeaves = leaves.length;
  const pendingLeaves = leaves.filter((l: any) => l.approval_status === 'pending').length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quản lý Vắng mặt</Text>
      
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.policyButton} onPress={() => setShowPolicyModal(true)}>
          <Ionicons name="document-text-outline" size={22} color="#4a72b5" />
          <Text style={styles.policyButtonText}>Chính sách nghỉ phép</Text>
        </TouchableOpacity>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalLeaves}</Text>
          <Text style={styles.statLabel}>Tổng đơn</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{pendingLeaves}</Text>
          <Text style={styles.statLabel}>Chờ duyệt</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        {canSubmitLeave ? "Bạn có thể gửi đơn xin vắng mặt tại đây." : "Xem và duyệt đơn vắng mặt của nhân viên."}
      </Text>

      {canSubmitLeave && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Tạo đơn xin vắng mặt mới</Text>

          {/* Row 1: Date + Reason */}
          <View style={styles.inputRow}>
            <View style={{flex: 1, marginRight: 15}}>
              <Text style={styles.label}>Ngày vắng mặt</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => {
                  setLeaveCalendarMonth(dateStr || new Date().toISOString().slice(0, 10));
                  setShowCalendar(true);
                }}
              >
                <Text style={{color: dateStr ? '#333' : '#888'}}>
                  {dateStr || 'Chọn ngày...'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{flex: 2}}>
              <Text style={styles.label}>Lý do</Text>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Lý do vắng mặt..."
              />
            </View>
          </View>

          {/* Row 2: Leave type - uses position:relative wrapper so dropdown overlays below */}
          <View style={{marginBottom: 12, position: 'relative', maxWidth: 260, zIndex: 100}}>
            <Text style={styles.label}>Loại</Text>
            <TouchableOpacity
              style={[styles.dateSelector, {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}]}
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            >
              <Text style={{color: '#333'}}>{leaveType}</Text>
              <Ionicons name={showTypeDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#888" />
            </TouchableOpacity>

            {showTypeDropdown && (
              <View style={styles.typeDropdown}>
                {leaveTypes.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={styles.typeDropdownItem}
                    onPress={() => { setLeaveType(t); setShowTypeDropdown(false); }}
                  >
                    <Text style={{color: leaveType === t ? '#4a72b5' : '#333', fontWeight: leaveType === t ? 'bold' : 'normal'}}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {!isAutoApprovedLeave && (
            <Text style={{fontSize: 12, color: '#ffa500', marginBottom: 14}}>
              ⚠ Đơn loại "{leaveType}" sẽ cần được {isManager ? 'Sếp tổng' : 'Sếp tổng hoặc quản lý'} phê duyệt trước khi có hiệu lực.
            </Text>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLeave} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? 'Đang gửi...' : 'Gửi Đơn'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Calendar
              key={leaveCalendarMonth}
              current={leaveCalendarMonth}
              customHeader={renderLeaveCalendarHeader}
              showSixWeeks
              hideExtraDays={false}
              style={styles.fixedCalendar}
              onMonthChange={(month) => setLeaveCalendarMonth(month.dateString)}
              onDayPress={(day) => {
                setDateStr(day.dateString);
                setLeaveCalendarMonth(day.dateString);
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

      <Modal visible={showPolicyModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.policyModalContent}>
            <Text style={styles.policyModalTitle}>Chính sách nghỉ phép</Text>
            <View style={styles.policyTable}>
              <View style={styles.policyTableHeader}>
                <Text style={[styles.policyCell, {flex: 2, fontWeight: 'bold'}]}>Tên</Text>
                <Text style={[styles.policyCell, {flex: 1.3, fontWeight: 'bold'}]}>Loại</Text>
                <Text style={[styles.policyCell, {flex: 1.4, fontWeight: 'bold'}]}>Số ngày còn lại</Text>
                <Text style={[styles.policyCell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Cần duyệt</Text>
              </View>
              {leavePolicies.map(policy => {
                const remainingInfo = getPolicyRemaining(policy);
                return (
                  <View key={policy.id || policy.name} style={styles.policyTableRow}>
                    <Text style={[styles.policyCell, {flex: 2}]}>{policy.name}</Text>
                    <Text style={[styles.policyCell, {flex: 1.3}]}>{policy.period_type === 'monthly' ? 'Theo tháng' : 'Theo năm'}</Text>
                    <Text style={[styles.policyCell, {flex: 1.4}]}>
                      {remainingInfo.remaining === null ? 'Không giới hạn' : `${remainingInfo.remaining}/${remainingInfo.maxDays}`}
                    </Text>
                    <Text style={[styles.policyCell, {flex: 1, textAlign: 'center', fontWeight: '600', color: policy.require_approval ? '#b91c1c' : '#15803d'}]}>
                      {policy.require_approval ? 'Có' : 'Không'}
                    </Text>
                  </View>
                );
              })}
              {leavePolicies.length === 0 && (
                <Text style={styles.emptyPolicyText}>Chưa có chính sách nghỉ phép nào.</Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPolicyModal(false)}>
              <Text style={styles.closeModalText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.listTitle}>Danh sách đơn vắng mặt</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          {!isEmployee && <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Người gửi</Text>}
          <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Ngày</Text>
          <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Loại</Text>
          <Text style={[styles.cell, {flex: 3, fontWeight: 'bold'}]}>Lý do</Text>
          <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold', textAlign: 'center'}]}>Trạng thái</Text>
          <Text style={[styles.cell, {flex: 2, fontWeight: 'bold', textAlign: 'center'}]}>Thao tác</Text>
        </View>

        {leaves.length === 0 && (
          <Text style={{padding: 20, textAlign: 'center', color: '#888'}}>Chưa có đơn vắng mặt nào.</Text>
        )}

        {leaves.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((l: any) => (
          <View key={l.id} style={styles.tableRow}>
            {!isEmployee && <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>{l.username}</Text>}
            <Text style={[styles.cell, {flex: 2}]}>{l.date}</Text>
            <Text style={[styles.cell, {flex: 2}]}>{l.leave_type || 'Nghỉ phép'}</Text>
            <Text style={[styles.cell, {flex: 3, color: '#666'}]}>{l.reason}</Text>
            <View style={[styles.cell, {flex: 1.5, alignItems: 'center'}]}>
              <Text style={{color: STATUS_COLOR[l.approval_status] || '#666', fontWeight: 'bold', fontSize: 12}}>
                {STATUS_LABEL[l.approval_status] || l.approval_status}
              </Text>
            </View>
            <View style={[styles.cell, {flex: 2, flexDirection: 'row', justifyContent: 'center', gap: 8}]}>
              {/* Boss/Manager approve/reject pending — manager cannot approve manager-submitted leaves */}
              {canApprove && l.approval_status === 'pending' && l.user_id !== user.id && !(isManager && l.submitter_role === 'manager') && (
                <>
                  <TouchableOpacity onPress={() => handleApprove(l.id, 'approved')} style={[styles.actionBtn, {backgroundColor: '#4caf50'}]}>
                    <Text style={styles.actionBtnText}>Duyệt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleApprove(l.id, 'rejected')} style={[styles.actionBtn, {backgroundColor: '#f44336'}]}>
                    <Text style={styles.actionBtnText}>Từ chối</Text>
                  </TouchableOpacity>
                </>
              )}
              {/* Owner of the leave can recall if still pending or approved */}
              {l.user_id === user.id && l.approval_status !== 'rejected' && (
                <TouchableOpacity onPress={() => handleRecallLeave(l.id)}>
                  <Text style={{color: '#f28baf', fontWeight: 'bold', fontSize: 13}}>Rút lại</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <Pagination 
          currentPage={currentPage} 
          totalPages={Math.ceil(leaves.length / ITEMS_PER_PAGE)} 
          onPageChange={setCurrentPage} 
        />
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
  statsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce7f7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  policyButtonText: {
    color: '#4a72b5',
    fontWeight: 'bold',
    fontSize: 15,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a72b5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 30,
    zIndex: 10,
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
  typeDropdown: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  typeDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  typeDropdownAddBtn: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f5f8fd',
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
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    alignItems: 'center',
  },
  cell: {
    fontSize: 14,
    color: '#444',
    paddingRight: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: 340,
  },
  policyModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: 560,
    maxWidth: '92%',
  },
  policyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 14,
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  policyCell: {
    fontSize: 14,
    color: '#444',
  },
  emptyPolicyText: {
    padding: 18,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
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

export default LeaveManagement;
