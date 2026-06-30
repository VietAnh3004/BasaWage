import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SearchableDropdown from './SearchableDropdown';
import Pagination from './Pagination';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const StatisticsView = () => {
  const { user, company } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  const isEmployee = company.role === 'employee';

  const timeToSeconds = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };

  const workStartSeconds = timeToSeconds(company.work_start_time || '09:00:00');
  const workEndSeconds = timeToSeconds(company.work_end_time || '18:00:00');
  const flexibleMinutes = Math.max(0, Number(company.flexible_minutes || 0));
  const flexibleEndSeconds = workStartSeconds + flexibleMinutes * 60;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAttendance, resLeave, resPersonnel, resDepts] = await Promise.all([
        fetch(`${API_URL}/api/attendance?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/leave?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/boss/personnel?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/boss/departments?company_id=${company.company_id}`)
      ]);
      
      const dataAtt = await resAttendance.json();
      const dataLeave = await resLeave.json();
      const dataPersonnel = await resPersonnel.json();
      const dataDepts = await resDepts.json();
      
      const personnelList = dataPersonnel.personnel || [];
      setPersonnel(personnelList);
      setDepartments(dataDepts.departments || []);
      setLeaves(dataLeave.leaveRequests || []);
      setAttendance(dataAtt.attendanceLogs || []);

      let fetchedEmployees = dataAtt.employees || [];
      // Filter out inactive personnel
      fetchedEmployees = fetchedEmployees.filter((emp: any) => {
        const p = personnelList.find((p: any) => p.enno === emp.enNo);
        if (p && p.status === 'inactive') return false;
        return true;
      });
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(newDate);
    setCurrentPage(1);
  };

  const isEmployeeInDept = (enNo: string) => {
    if (!selectedDepartment) return true;
    const p = personnel.find(p => p.enno === enNo);
    return p && p.department_id === selectedDepartment;
  };

  const filteredEmployees = employees.filter(e => {
    if (isEmployee) return e.enNo === company.linked_enno;
    if (!isEmployeeInDept(e.enNo)) return false;
    if (selectedEmployee && e.enNo !== selectedEmployee) return false;
    return true;
  });

  const getStats = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const daysToCount: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        const mStr = String(month + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        daysToCount.push(`${year}-${mStr}-${dStr}`);
      }
    }

    let totalLate = 0;
    let totalFlexible = 0;
    let totalEarly = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalWorkDays = 0;

    const employeeStats = filteredEmployees.map(emp => {
      let late = 0;
      let flexible = 0;
      let early = 0;
      let absent = 0;
      let leave = 0;
      let workCount = 0;

      const p = personnel.find(p => p.enno === emp.enNo);
      const displayName = p ? p.name : emp.name;
      const dept = departments.find(d => d.id === p?.department_id);
      const departmentName = dept ? dept.name : '-';

      const employeeLogs = attendance.filter(a => a.enNo === emp.enNo);
      const firstEverDate = employeeLogs.length > 0 ? employeeLogs.reduce((min, log) => log.date < min ? log.date : min, employeeLogs[0].date) : null;

      employeeLogs.forEach(log => {
        const logDate = new Date(log.date);
        const dayOfWeek = logDate.getDay();
        if (logDate.getFullYear() === year && logDate.getMonth() === month && dayOfWeek !== 0 && dayOfWeek !== 6) {
          workCount++;
        }
      });

      daysToCount.forEach(dateStr => {
        const log = employeeLogs.find(a => a.date === dateStr);
        const hasLeave = leaves.find(l => l.date === dateStr && l.linked_enno === emp.enNo && l.approval_status === 'approved');

        if (hasLeave) {
          leave++;
        } else if (log) {
          const firstCheckInSeconds = timeToSeconds(log.firstCheckIn);
          if (firstCheckInSeconds > workStartSeconds && firstCheckInSeconds <= flexibleEndSeconds) flexible++;
          if (firstCheckInSeconds > flexibleEndSeconds) late++;
          if (timeToSeconds(log.lastCheckOut) < workEndSeconds) early++;
        } else {
          // If no log and no leave, it might be an absence.
          // Only count absence if:
          // 1. It's strictly before today.
          // 2. It's on or after their first ever log (meaning they were working for the company).
          // 3. They actually have logs (if firstEverDate is null, they never checked in yet, don't count everything as absent).
          if (dateStr < todayStr && firstEverDate && dateStr >= firstEverDate) {
            absent++;
          }
        }
      });

      totalLate += late;
      totalFlexible += flexible;
      totalEarly += early;
      totalAbsent += absent;
      totalLeave += leave;
      totalWorkDays += workCount;

      return { ...emp, late, flexible, early, absent, leave, workCount, displayName, departmentName };
    });

    return { employeeStats, totalLate, totalFlexible, totalEarly, totalAbsent, totalLeave, totalWorkDays };
  };

  const stats = getStats();
  const monthStr = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Month Navigation */}
      <View style={styles.header}>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={24} color="#4a72b5" />
          </TouchableOpacity>
          <Text style={styles.weekText}>{monthStr}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={24} color="#4a72b5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      {!isEmployee && (
        <View style={{ marginBottom: 20, zIndex: 9999, flexDirection: 'row', gap: 15 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Lọc theo bộ phận:</Text>
            <SearchableDropdown
              data={departments}
              value={selectedDepartment}
              onChange={(val) => {
                setSelectedDepartment(val);
                setSelectedEmployee(null);
                setCurrentPage(1);
              }}
              placeholder="Tất cả bộ phận"
              searchPlaceholder="Tìm kiếm bộ phận..."
              keyExtractor={(item) => item.id}
              labelExtractor={(item) => item.name}
              showClear={true}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Lọc theo nhân viên:</Text>
            <SearchableDropdown
              data={employees.filter(e => isEmployeeInDept(e.enNo))}
              value={selectedEmployee}
              onChange={(val) => {
                setSelectedEmployee(val);
                setCurrentPage(1);
              }}
              placeholder="Tất cả nhân viên"
              searchPlaceholder="Tìm kiếm nhân viên..."
              keyExtractor={(item) => item.enNo}
              labelExtractor={(item) => item.name}
              showClear={true}
            />
          </View>
        </View>
      )}

      {/* Summary Cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.card, { borderLeftColor: '#0f766e', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Công</Text>
          <Text style={[styles.cardValue, {color: '#0f766e'}]}>{stats.totalWorkDays}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#dc2626', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Đi muộn</Text>
          <Text style={[styles.cardValue, {color: '#dc2626'}]}>{stats.totalLate}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Linh động</Text>
          <Text style={[styles.cardValue, {color: '#f59e0b'}]}>{stats.totalFlexible}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#7c3aed', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Về sớm</Text>
          <Text style={[styles.cardValue, {color: '#7c3aed'}]}>{stats.totalEarly}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#4a72b5', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Vắng không phép</Text>
          <Text style={[styles.cardValue, {color: '#4a72b5'}]}>{stats.totalAbsent}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#4caf50', borderLeftWidth: 4 }]}>
          <Text style={styles.cardTitle}>Có phép</Text>
          <Text style={[styles.cardValue, {color: '#4caf50'}]}>{stats.totalLeave}</Text>
        </View>
      </View>

      {/* Detailed Table */}
      {!isEmployee && (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>Nhân viên</Text>
            <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>Bộ phận</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Công</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Đi muộn</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Linh động</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Về sớm</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Vắng</Text>
            <Text style={[styles.cell, {flex: 0.8, fontWeight: 'bold', textAlign: 'center'}]}>Có phép</Text>
          </View>
          
          {stats.employeeStats.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(emp => (
            <View key={emp.enNo} style={styles.tableRow}>
              <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>{emp.displayName}</Text>
              <Text style={[styles.cell, {flex: 1.5}]}>{emp.departmentName}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.workCount > 0 ? '#0f766e' : '#888'}]}>{emp.workCount}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.late > 0 ? '#dc2626' : '#888'}]}>{emp.late}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.flexible > 0 ? '#f59e0b' : '#888'}]}>{emp.flexible}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.early > 0 ? '#7c3aed' : '#888'}]}>{emp.early}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.absent > 0 ? '#4a72b5' : '#888'}]}>{emp.absent}</Text>
              <Text style={[styles.cell, {flex: 0.8, textAlign: 'center', color: emp.leave > 0 ? '#4caf50' : '#888'}]}>{emp.leave}</Text>
            </View>
          ))}

          {stats.employeeStats.length === 0 && (
            <Text style={{padding: 20, textAlign: 'center', color: '#888'}}>Không có dữ liệu hiển thị.</Text>
          )}

          <Pagination 
            currentPage={currentPage} 
            totalPages={Math.ceil(stats.employeeStats.length / ITEMS_PER_PAGE)} 
            onPageChange={setCurrentPage} 
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 15,
  },
  weekText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 120,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
    zIndex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    zIndex: 1,
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
    color: '#333',
  },
});

export default StatisticsView;
