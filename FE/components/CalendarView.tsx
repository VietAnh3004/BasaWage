import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import SearchableDropdown from './SearchableDropdown';

const CalendarView = () => {
  const { user, company } = useAuth();
  const [currentView, setCurrentView] = useState('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(company.role === 'employee' ? company.linked_enno : null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const isEmployee = company.role === 'employee';
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchData = async () => {
    try {
      const [res, resLeave] = await Promise.all([
        fetch(`${API_URL}/api/attendance?company_id=${company.company_id}&role=${company.role}&linked_enno=${company.linked_enno || ''}`),
        fetch(`${API_URL}/api/leave?company_id=${company.company_id}&user_id=${user.id}&role=${company.role}`)
      ]);
      const data = await res.json();
      setEmployees(data.employees || []);
      setAttendance(data.attendanceLogs || []);
      
      const dataLeave = await resLeave.json();
      setLeaves(dataLeave.leaveRequests || []);

      let fetchedEmployees = data.employees || [];

      if (!isEmployee) {
        const [resPersonnel, resDepts] = await Promise.all([
          fetch(`${API_URL}/api/boss/personnel?company_id=${company.company_id}`),
          fetch(`${API_URL}/api/boss/departments?company_id=${company.company_id}`)
        ]);
        const dataPersonnel = await resPersonnel.json();
        const dataDepts = await resDepts.json();
        
        const personnelList = dataPersonnel.personnel || [];
        setPersonnel(personnelList);
        setDepartments(dataDepts.departments || []);

        // Filter out inactive personnel
        fetchedEmployees = fetchedEmployees.filter((emp: any) => {
          const p = personnelList.find((p: any) => p.enno === emp.enNo);
          if (p && p.status === 'inactive') return false;
          return true;
        });
      }
      
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'text/plain' });
    if (result.canceled) return;

    setLoading(true);
    const formData = new FormData();
    if (result.assets[0].file) {
      // Web platform
      formData.append('file', result.assets[0].file);
    } else {
      // Mobile platforms
      formData.append('file', {
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        type: 'text/plain'
      } as any);
    }
    formData.append('company_id', company.company_id.toString());

    try {
      await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      await fetchData(); // Refresh data
      alert('Upload thành công!');
    } catch (err) {
      console.error(err);
      alert('Lỗi upload file!');
    } finally {
      setLoading(false);
    }
  };

  const timeToSeconds = (timeStr: string) => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  };

  const isEmployeeInDept = (enNo: string) => {
    if (!selectedDepartment) return true;
    const p = personnel.find(p => p.enno === enNo);
    return p && p.department_id === selectedDepartment;
  };

  const getLateEmployees = (dateStr: string, isWeekend: boolean) => {
    if (isWeekend) return [];
    return attendance
      .filter(a => a.date === dateStr && timeToSeconds(a.firstCheckIn) > 9 * 3600 && (!selectedEmployee || a.enNo === selectedEmployee) && isEmployeeInDept(a.enNo))
      .map(a => employees.find(e => e.enNo === a.enNo))
      .filter(Boolean);
  };

  const getLeaveEarlyEmployees = (dateStr: string, isWeekend: boolean) => {
    if (isWeekend) return [];
    return attendance
      .filter(a => a.date === dateStr && timeToSeconds(a.lastCheckOut) < 18 * 3600 && (!selectedEmployee || a.enNo === selectedEmployee) && isEmployeeInDept(a.enNo))
      .map(a => employees.find(e => e.enNo === a.enNo))
      .filter(Boolean);
  };

  const getAbsentEmployees = (dateStr: string, isWeekend: boolean) => {
    if (isWeekend) return []; 
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (dateStr >= todayStr) return [];

    return employees.filter(e => {
      if (!isEmployeeInDept(e.enNo)) return false;
      if (selectedEmployee && e.enNo !== selectedEmployee) return false;

      const employeeLogs = attendance.filter(a => a.enNo === e.enNo);
      if (employeeLogs.length === 0) return false; 
      
      const firstEverDate = employeeLogs.reduce((min, p) => p.date < min ? p.date : min, employeeLogs[0].date);
      if (dateStr < firstEverDate) return false;

      const hasLog = employeeLogs.find(a => a.date === dateStr);
      if (hasLog) return false;
      
      const hasLeave = leaves.find(l => l.date === dateStr && l.linked_enno === e.enNo && l.approval_status === 'approved');
      if (hasLeave) return false;

      return true;
    });
  };

  const getOnLeaveEmployees = (dateStr: string, isWeekend: boolean) => {
    if (isWeekend) return [];

    return employees.filter(e => {
      if (!isEmployeeInDept(e.enNo)) return false;
      if (selectedEmployee && e.enNo !== selectedEmployee) return false;
      const hasLeave = leaves.find(l => l.date === dateStr && l.linked_enno === e.enNo && l.approval_status === 'approved');
      return !!hasLeave;
    });
  };

  const getMonthData = () => {
    const today = new Date();
    today.setMonth(today.getMonth() + monthOffset);
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;
    
    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const paddingBefore = Array.from({length: startDayOfWeek}).map((_, i) => ({
      day: prevMonthLastDay - startDayOfWeek + i + 1,
      isCurrentMonth: false,
      fullDate: '',
      isWeekend: false
    }));
    
    const currentMonthDays = Array.from({length: daysInMonth}).map((_, i) => {
      const d = i + 1;
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      return {
        day: d,
        isCurrentMonth: true,
        fullDate: `${year}-${mStr}-${dStr}`,
        isWeekend: (new Date(year, month, d).getDay() === 0 || new Date(year, month, d).getDay() === 6)
      };
    });
    
    return {
      cells: [...paddingBefore, ...currentMonthDays],
      monthStr: `${today.toLocaleString('default', { month: 'long' })} ${year}`
    };
  };

  const { cells: monthCells, monthStr } = getMonthData();

  const renderMonthView = () => (
    <View style={styles.calendarCard}>
      <View style={styles.monthHeader}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <View key={day} style={styles.monthDayName}>
            <Text style={styles.dayName}>{day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {monthCells.map((cell, index) => {
          let lateCount = 0;
          let absentCount = 0;
          let earlyCount = 0;
          let leaveCount = 0;
            if (cell.isCurrentMonth && cell.fullDate) {
              lateCount = getLateEmployees(cell.fullDate, cell.isWeekend).length;
              absentCount = getAbsentEmployees(cell.fullDate, cell.isWeekend).length;
              earlyCount = getLeaveEarlyEmployees(cell.fullDate, cell.isWeekend).length;
              leaveCount = getOnLeaveEmployees(cell.fullDate, cell.isWeekend).length;
            }
          
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.monthCell, !cell.isCurrentMonth && {backgroundColor: '#f9f9f9'}]}
              onPress={() => {
                if (cell.isCurrentMonth) {
                  setSelectedDate(cell.fullDate);
                  setCurrentView('day');
                }
              }}
              disabled={!cell.isCurrentMonth}
            >
              <Text style={[styles.monthDayText, !cell.isCurrentMonth && styles.monthDayTextDisabled]}>
                {cell.day}
              </Text>
              
              {cell.isCurrentMonth && (
                <View style={styles.eventTextContainer}>
                  {lateCount > 0 && <Text style={{color: '#f28baf', fontSize: 12, fontWeight: 'bold'}}>{lateCount} muộn</Text>}
                  {earlyCount > 0 && <Text style={{color: '#ffa500', fontSize: 12, fontWeight: 'bold'}}>{earlyCount} về sớm</Text>}
                  {absentCount > 0 && <Text style={{color: '#4a72b5', fontSize: 12, fontWeight: 'bold'}}>{absentCount} vắng mặt</Text>}
                  {leaveCount > 0 && <Text style={{color: '#4caf50', fontSize: 12, fontWeight: 'bold'}}>{leaveCount} có phép</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderDayView = () => {
    if (!selectedDate) return null;
    const isWeekend = new Date(selectedDate).getDay() === 0 || new Date(selectedDate).getDay() === 6;
    const absentEmps = getAbsentEmployees(selectedDate, isWeekend);
    const leaveEmps = getOnLeaveEmployees(selectedDate, isWeekend);
    
    const timelineLogs = attendance.filter(a => 
      !isWeekend &&
      a.date === selectedDate && 
      (a.isLate || timeToSeconds(a.lastCheckOut) < 18 * 3600) &&
      (!selectedEmployee || a.enNo === selectedEmployee) &&
      isEmployeeInDept(a.enNo)
    );
    const timelineEmps = timelineLogs.map(a => {
      const emp = employees.find(e => e.enNo === a.enNo);
      return { ...emp, firstCheckIn: a.firstCheckIn, lastCheckOut: a.lastCheckOut };
    }).filter(e => e.name); 

    const startOfDaySecs = 8 * 3600; // 08:00
    const endOfDaySecs = 21 * 3600;  // 21:00
    const totalDaySecs = endOfDaySecs - startOfDaySecs;

    return (
      <View style={styles.calendarCard}>
        <View style={{padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center'}}>
           <TouchableOpacity onPress={() => setCurrentView('month')} style={{marginRight: 15}}>
             <Ionicons name="arrow-back" size={24} color="#000" />
           </TouchableOpacity>
           <Text style={{fontSize: 18, fontWeight: 'bold'}}>Chi tiết ngày {selectedDate}</Text>
        </View>

        <View style={{padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row'}}>
           <View style={{flex: 1}}>
             <Text style={{fontWeight: 'bold', marginBottom: 10, fontSize: 14}}>Vắng mặt (không phép):</Text>
             <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
               {absentEmps.length === 0 ? <Text style={{color: '#888', fontStyle: 'italic'}}>Không có ai</Text> : null}
               {absentEmps.map((emp, idx) => (
                  <View key={idx} style={[styles.summaryPill, { backgroundColor: emp.color + '20', borderColor: emp.color }]}>
                    <Text style={[styles.summaryPillText, { color: emp.color }]}>{emp.name}</Text>
                  </View>
               ))}
             </View>
           </View>
           
           <View style={{flex: 1}}>
             <Text style={{fontWeight: 'bold', marginBottom: 10, fontSize: 14}}>Nghỉ có phép:</Text>
             <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
               {leaveEmps.length === 0 ? <Text style={{color: '#888', fontStyle: 'italic'}}>Không có ai</Text> : null}
               {leaveEmps.map((emp, idx) => (
                  <View key={`leave_${idx}`} style={[styles.summaryPill, { backgroundColor: '#e8f5e9', borderColor: '#4caf50' }]}>
                    <Text style={[styles.summaryPillText, { color: '#4caf50' }]}>{emp.name}</Text>
                  </View>
               ))}
             </View>
           </View>
        </View>

        <View style={{padding: 15, flex: 1}}>
           <Text style={{fontWeight: 'bold', marginBottom: 15, fontSize: 14}}>Lịch sử hoạt động (người đi muộn / về sớm):</Text>
           
           <View style={{flexDirection: 'row'}}>
             <View style={{width: 120}}>{/* Name Column Header */}</View>
             <View style={{flex: 1, position: 'relative', height: 20}}>
               {[8, 10, 12, 14, 16, 18, 20].map(h => {
                 const percent = ((h - 8) / 13) * 100;
                 return (
                   <Text key={h} style={{
                     position: 'absolute',
                     left: `${percent}%`,
                     transform: [{ translateX: '-50%' }],
                     fontSize: 10, 
                     color: '#888',
                     textAlign: 'center',
                     width: 40
                   }}>
                     {h}:00
                   </Text>
                 );
               })}
             </View>
           </View>
           
           <ScrollView style={{marginTop: 10}}>
             {timelineEmps.length === 0 ? <Text style={{color: '#888', marginTop: 10, fontStyle: 'italic'}}>Không có người đi muộn / về sớm.</Text> : null}
             {timelineEmps.map((emp, idx) => {
                const startSecs = Math.max(timeToSeconds(emp.firstCheckIn) - startOfDaySecs, 0);
                const endSecs = Math.min(timeToSeconds(emp.lastCheckOut) - startOfDaySecs, totalDaySecs);
                const leftPercent = Math.max((startSecs / totalDaySecs) * 100, 0);
                let widthPercent = ((endSecs - startSecs) / totalDaySecs) * 100;
                
                if (widthPercent < 1) widthPercent = 1; 

                return (
                  <View key={idx} style={{flexDirection: 'row', alignItems: 'center', marginVertical: 12}}>
                    <Text style={{width: 120, fontSize: 13, fontWeight: '500'}} numberOfLines={1}>{emp.name}</Text>
                    <View style={{flex: 1, height: 24, backgroundColor: '#f0f0f0', borderRadius: 12, position: 'relative', overflow: 'hidden'}}>
                       <View style={{
                         position: 'absolute',
                         left: `${leftPercent}%`,
                         width: `${widthPercent}%`,
                         height: '100%',
                         backgroundColor: emp.color,
                         borderRadius: 12
                       }} />
                       <Text style={{
                          position: 'absolute',
                          left: `${leftPercent}%`,
                          paddingLeft: 8,
                          fontSize: 10,
                          color: '#fff',
                          fontWeight: 'bold',
                          lineHeight: 24,
                          textShadowColor: 'rgba(0,0,0,0.85)',
                          textShadowOffset: { width: 0.5, height: 0.5 },
                          textShadowRadius: 2,
                        }}>
                         {emp.firstCheckIn.slice(0,5)} - {emp.lastCheckOut.slice(0,5)}
                       </Text>
                    </View>
                  </View>
                );
             })}
           </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topActionsContainer}>
        {!isEmployee && (
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.uploadBtnText}>Upload File (.txt)</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!isEmployee && (
        <View style={{ marginBottom: 20, zIndex: 9999, flexDirection: 'row', gap: 15 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Lọc theo bộ phận:</Text>
            <SearchableDropdown
              data={departments}
              value={selectedDepartment}
              onChange={(val) => {
                setSelectedDepartment(val);
                setSelectedEmployee(null); // Reset employee when changing department
              }}
              placeholder="Tất cả bộ phận"
              searchPlaceholder="Tìm kiếm bộ phận..."
              keyExtractor={(item) => item.id}
              labelExtractor={(item) => item.name}
              showClear={true}
              style={{ width: '100%', maxWidth: 300 }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Lọc theo nhân viên:</Text>
            <SearchableDropdown
              data={employees.filter(e => isEmployeeInDept(e.enNo))}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              placeholder="Tất cả nhân viên"
              searchPlaceholder="Tìm kiếm nhân viên..."
              keyExtractor={(item) => item.enNo}
              labelExtractor={(item) => item.name}
              showClear={true}
              style={{ width: '100%', maxWidth: 300 }}
            />
          </View>
        </View>
      )}

      {currentView === 'month' && (
        <View style={styles.header}>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={() => setMonthOffset(m => m - 1)} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={16} color="#888" />
            </TouchableOpacity>
            <Ionicons name="calendar-outline" size={16} color="#555" style={{ marginLeft: 11, marginRight: 8 }} />
            <Text style={styles.weekText}>{monthStr}</Text>
            <TouchableOpacity onPress={() => setMonthOffset(m => m + 1)} style={{ padding: 4, marginLeft: 6 }}>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentView === 'month' ? renderMonthView() : renderDayView()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  modeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 4,
  },
  modeBtnActive: {
    backgroundColor: '#f0f4fa',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  modeBtnTextActive: {
    color: '#3b5e98',
    fontWeight: 'bold',
    fontSize: 14,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a72b5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  uploadBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  weekText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterPillActive: {
    backgroundColor: '#4a72b5',
    borderColor: '#4a72b5',
  },
  filterPillText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    minHeight: 600,
  },
  summaryPill: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
  },
  summaryPillText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  monthHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthDayName: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  dayName: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '14.28%', // 100% / 7
    height: 120,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 10,
  },
  monthDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  monthDayTextDisabled: {
    color: '#ccc',
  },
  eventTextContainer: {
    flexDirection: 'column',
    gap: 4,
  }
});

export default CalendarView;
