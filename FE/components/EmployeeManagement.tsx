import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SearchableDropdown from './SearchableDropdown';
import Pagination from './Pagination';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const EmployeeManagement = () => {
  const { user, company } = useAuth();
  
  const [viewMode, setViewMode] = useState<'personnel' | 'connections' | 'machine'>('personnel');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [members, setMembers] = useState<any[]>([]);
  const [machineEmployees, setMachineEmployees] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, searchQuery]);

  // Personnel Form
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [personnelForm, setPersonnelForm] = useState({ id: null, name: '', email: '', department_id: null });
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);

  // Connection Form
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [connForm, setConnForm] = useState({ personnel_id: '', enno: '' });

  const isOwner = company.role === 'owner';
  const canManage = company.role === 'owner' || company.role === 'manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resMembers, resMachine, resPersonnel, resDepts] = await Promise.all([
        fetch(`${API_URL}/api/boss/members?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/attendance?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/boss/personnel?company_id=${company.company_id}`),
        fetch(`${API_URL}/api/boss/departments?company_id=${company.company_id}`)
      ]);
      
      const dataMembers = await resMembers.json();
      const dataMachine = await resMachine.json();
      const dataPersonnel = await resPersonnel.json();
      const dataDepts = await resDepts.json();
      
      if (dataMembers.members) setMembers(dataMembers.members);
      if (dataMachine.employees) setMachineEmployees(dataMachine.employees);
      if (dataPersonnel.personnel) setPersonnel(dataPersonnel.personnel);
      if (dataDepts.departments) setDepartments(dataDepts.departments);
      
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChangeRole = async (memberId: string, currentRole: string) => {
    if (!isOwner) return;
    const newRole = currentRole === 'employee' ? 'manager' : 'employee';
    try {
      await fetch(`${API_URL}/api/boss/members/role`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId, role: newRole })
      });
      // Optimistic update: flip role without full reload
      setMembers(prev => prev.map(m => String(m.user_id) === String(memberId) ? { ...m, role: newRole } : m));
      setPersonnel(prev => prev.map(p => String(p.user_id) === String(memberId) ? { ...p, user_role: newRole } : p));
    } catch (err) { console.error(err); }
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/boss/departments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, name: newDeptName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setDepartments([...departments, data.department]);
        setPersonnelForm({...personnelForm, department_id: data.department.id});
        setShowDeptInput(false);
        setNewDeptName('');
      }
    } catch (e) { console.error(e); }
  };

  const handleSavePersonnel = async () => {
    if (!personnelForm.name.trim()) return;
    if (!personnelForm.id && !personnelForm.email.trim()) return alert('Vui lòng nhập email nhân viên');
    try {
      const url = personnelForm.id 
        ? `${API_URL}/api/boss/personnel/${personnelForm.id}`
        : `${API_URL}/api/boss/personnel`;
      const method = personnelForm.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.company_id,
          name: personnelForm.name,
          email: personnelForm.id ? undefined : personnelForm.email,
          department_id: personnelForm.department_id,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể lưu nhân sự');
        return;
      }
      setShowPersonnelModal(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDeletePersonnel = async (person: any) => {
    const linkedMember = getPersonnelMember(person);
    const accountRole = person.user_role || linkedMember?.role;
    const willDeleteAccount = Boolean(person.user_id && accountRole === 'employee');
    const confirmMessage = willDeleteAccount
      ? `Bạn có chắc muốn xóa nhân sự ${person.name} và xóa luôn tài khoản nhân viên liên kết không?`
      : `Bạn có chắc muốn xóa nhân sự ${person.name} khỏi danh sách không?`;
    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch(`${API_URL}/api/boss/personnel/${person.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, delete_linked_account: true })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể xóa nhân sự');
        return;
      }
      if (data.deletedUserId) {
        setMembers(prev => prev.filter(m => String(m.user_id) !== String(data.deletedUserId)));
      }
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleSaveConnection = async () => {
    if (!connForm.personnel_id) return alert('Vui lòng chọn nhân sự');
    try {
      const res = await fetch(`${API_URL}/api/boss/personnel/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company_id: company.company_id, 
          personnel_id: connForm.personnel_id, 
          user_id: selectedConnectionPersonnel?.user_id || null, 
          enno: connForm.enno || null 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể lưu kết nối');
        return;
      }
      setShowAddConnection(false);
      setConnForm({ personnel_id: '', enno: '' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    // Optimistic update: flip status immediately
    setPersonnel(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    try {
      await fetch(`${API_URL}/api/boss/personnel/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      // Revert on error
      setPersonnel(prev => prev.map(p => p.id === id ? { ...p, status: currentStatus } : p));
      console.error(e);
    }
  };

  const handleDisconnect = async (personnel_id: string) => {
    try {
      await fetch(`${API_URL}/api/boss/personnel/disconnect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, personnel_id })
      });
      // Optimistic update: clear only the timeclock link, keep the employee account/email intact.
      setPersonnel(prev => prev.map(p => p.id === personnel_id ? { ...p, enno: null } : p));
    } catch (e) { console.error(e); }
  };

  const isMachineEmployeeConnected = (enNo: string) => {
    return personnel.some(p => p.enno === enNo) || members.some(m => m.linked_enno === enNo);
  };

  const selectedConnectionPersonnel = personnel.find(p => String(p.id) === String(connForm.personnel_id));

  const availablePersonnel = personnel.filter(p => {
    if (String(p.id) === String(connForm.personnel_id)) return true;
    return !p.enno;
  });

  const availableMachineEmployees = machineEmployees.filter(emp => {
    if (String(emp.enNo) === String(selectedConnectionPersonnel?.enno || connForm.enno)) return true;
    return !personnel.some(p => String(p.enno) === String(emp.enNo)) && !members.some(m => String(m.linked_enno) === String(emp.enNo));
  });

  const handleDeleteMachineEmployee = async (enNo: string) => {
    if (!confirm(`Bạn có chắc muốn xóa ID máy chấm công ${enNo} khỏi hệ thống không?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/boss/machine-employees/${encodeURIComponent(enNo)}?company_id=${company.company_id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Không thể xóa ID máy chấm công');
        return;
      }
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối máy chủ');
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  const getPersonnelMember = (person: any) => {
    if (!person.user_id) return null;
    return members.find(m => String(m.user_id) === String(person.user_id)) || null;
  };

  const renderPersonnelView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Họ và tên</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Bộ phận</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Email</Text>
        <Text style={[styles.cell, {flex: 1.2, fontWeight: 'bold'}]}>Vai trò</Text>
        <Text style={[styles.cell, {flex: 1.4, fontWeight: 'bold'}]}>Trạng thái</Text>
        <Text style={[styles.cell, {flex: 2, textAlign: 'center', fontWeight: 'bold'}]}>Hành động</Text>
      </View>
      {canManage && (
        <TouchableOpacity style={styles.addBtnRow} onPress={() => { setPersonnelForm({id: null, name: '', email: '', department_id: null}); setShowPersonnelModal(true); }}>
          <Ionicons name="add-circle" size={20} color="#4a72b5" />
          <Text style={{color: '#4a72b5', fontWeight: 'bold', marginLeft: 5}}>Thêm nhân sự mới</Text>
        </TouchableOpacity>
      )}
      {(() => {
        const filtered = personnel.filter(p => {
          const member = getPersonnelMember(p);
          const accountEmail = p.user_email || member?.user_email;
          const accountRole = p.user_role || member?.role;
          return !searchQuery ||
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.department_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            accountEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            accountRole?.toLowerCase().includes(searchQuery.toLowerCase());
        });
        const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
          <>
            {paginated.map(p => {
              const member = getPersonnelMember(p);
              const accountUserId = p.user_id || member?.user_id;
              const accountEmail = p.user_email || member?.user_email;
              const accountRole = p.user_role || member?.role;
              return (
              <View key={p.id} style={styles.tableRow}>
                <Text style={[styles.cell, {flex: 2}]}>{p.name}</Text>
                <Text style={[styles.cell, {flex: 2}]}>{p.department_name || '-'}</Text>
                <Text style={[styles.cell, {flex: 2}]}>{accountEmail || '-'}</Text>
                <View style={{flex: 1.2}}>
                  {accountRole ? (
                    <View style={[styles.badge, accountRole === 'owner' ? styles.badgeOwner : accountRole === 'manager' ? styles.badgeManager : styles.badgeEmployee]}>
                      <Text style={styles.badgeText}>{accountRole}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.cell, {color: '#888'}]}>-</Text>
                  )}
                </View>
                <View style={{flex: 1.4, flexDirection: 'row', alignItems: 'center'}}>
                  <Switch
                    value={p.status === 'active' || p.status === undefined}
                    onValueChange={() => handleToggleStatus(p.id, p.status || 'active')}
                    trackColor={{ false: '#f28baf', true: '#4caf50' }}
                    thumbColor={'#fff'}
                    disabled={!canManage}
                  />
                  <Text style={{marginLeft: 8, fontSize: 13, color: (p.status === 'active' || p.status === undefined) ? '#4caf50' : '#f28baf'}}>
                    {(p.status === 'active' || p.status === undefined) ? 'Hoạt động' : 'Nghỉ'}
                  </Text>
                </View>
                <View style={styles.personnelActions}>
                  {canManage && (
                    <>
                      <View style={styles.roleActionSlot}>
                        {isOwner && accountUserId && accountRole && accountRole !== 'owner' && (
                          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#eee'}]} onPress={() => handleChangeRole(accountUserId, accountRole)}>
                            <Text style={[styles.actionText, {color: '#555'}]}>{accountRole === 'employee' ? 'Lên quản lý' : 'Hạ xuống NV'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.iconActionSlot}>
                        <TouchableOpacity style={styles.iconActionBtn} onPress={() => { setPersonnelForm({id: p.id, name: p.name, email: '', department_id: p.department_id}); setShowPersonnelModal(true); }}>
                          <Ionicons name="pencil" size={18} color="#4a72b5" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleDeletePersonnel(p)}>
                          <Ionicons name="trash" size={18} color="#f28baf" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
              );
            })}
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE)} 
              onPageChange={setCurrentPage} 
            />
          </>
        );
      })()}
    </View>
  );

  const renderConnectionsView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Tên nhân sự</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Mã máy chấm công</Text>
        <Text style={[styles.cell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Lưu</Text>
      </View>
      
      {showAddConnection && (
        <View style={[styles.tableRow, {backgroundColor: '#f5f8fd', zIndex: 999}]}>
          {/* Personnel Dropdown */}
          <View style={{flex: 2, position: 'relative', paddingRight: 10, zIndex: 3000}}>
            <SearchableDropdown
              data={availablePersonnel}
              value={connForm.personnel_id}
              onChange={(val) => setConnForm({...connForm, personnel_id: val})}
              placeholder="Chọn nhân sự..."
              searchPlaceholder="Tìm kiếm nhân sự..."
              keyExtractor={item => item.id}
              labelExtractor={item => item.name}
              showClear={false}
            />
          </View>

          {/* Timeclock Dropdown */}
          <View style={{flex: 2, position: 'relative', paddingRight: 10, zIndex: 1000}}>
            <SearchableDropdown
              data={availableMachineEmployees}
              value={connForm.enno}
              onChange={(val) => setConnForm({...connForm, enno: val})}
              placeholder="Chọn ID máy..."
              searchPlaceholder="Tìm kiếm ID máy..."
              keyExtractor={item => item.enNo}
              labelExtractor={item => `${item.enNo} - ${item.name}`}
              showClear={true}
            />
          </View>
          
          <View style={{flex: 1, flexDirection: 'row', justifyContent: 'center'}}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConnection}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddConnection(false); }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!showAddConnection && canManage && (
        <TouchableOpacity style={styles.addBtnRow} onPress={() => setShowAddConnection(true)}>
          <Ionicons name="add-circle" size={20} color="#4a72b5" />
          <Text style={{color: '#4a72b5', fontWeight: 'bold', marginLeft: 5}}>Liên kết mới</Text>
        </TouchableOpacity>
      )}

      {/* Existing connections */}
      {(() => {
        const filtered = personnel.filter(p => p.enno).filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.enno?.toLowerCase().includes(searchQuery.toLowerCase()));
        const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
          <>
            {paginated.map(p => (
              <View key={p.id} style={styles.tableRow}>
                <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>{p.name}</Text>
                <Text style={[styles.cell, {flex: 2}]}>
                  {p.enno ? `${p.enno} - ${machineEmployees.find(m => m.enNo === p.enno)?.name || '?'}` : '-'}
                </Text>
                <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                  <TouchableOpacity onPress={() => {
                    setConnForm({ personnel_id: p.id, enno: p.enno || '' });
                    setShowAddConnection(true);
                  }} style={{marginRight: 15}}>
                    <Ionicons name="pencil" size={16} color="#4a72b5" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => handleDisconnect(p.id)}>
                    <Ionicons name="trash" size={16} color="#f28baf" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE)} 
              onPageChange={setCurrentPage} 
            />
          </>
        );
      })()}
    </View>
  );

  const renderMachineEmployeesView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>ID máy chấm công</Text>
        <Text style={[styles.cell, {flex: 2.5, fontWeight: 'bold'}]}>Tên trên máy</Text>
        <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>Trạng thái</Text>
        <Text style={[styles.cell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Hành động</Text>
      </View>
      {(() => {
        const filtered = machineEmployees.filter(emp =>
          !searchQuery ||
          emp.enNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
          <>
            {paginated.map(emp => {
              const connected = isMachineEmployeeConnected(emp.enNo);
              return (
                <View key={emp.enNo} style={styles.tableRow}>
                  <Text style={[styles.cell, {flex: 1.5, fontWeight: 'bold'}]}>{emp.enNo}</Text>
                  <Text style={[styles.cell, {flex: 2.5}]}>{emp.name}</Text>
                  <View style={{flex: 1.5}}>
                    <View style={[styles.statusBadge, connected ? styles.statusConnected : styles.statusDisconnected]}>
                      <Text style={[styles.statusBadgeText, connected ? styles.statusConnectedText : styles.statusDisconnectedText]}>
                        {connected ? 'Đã kết nối' : 'Chưa kết nối'}
                      </Text>
                    </View>
                  </View>
                  <View style={{flex: 1, alignItems: 'center'}}>
                    {canManage && (
                      <TouchableOpacity onPress={() => handleDeleteMachineEmployee(emp.enNo)}>
                        <Ionicons name="trash" size={18} color="#f28baf" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {filtered.length === 0 && (
              <Text style={{padding: 20, textAlign: 'center', color: '#888'}}>Chưa có ID máy chấm công nào.</Text>
            )}
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
            />
          </>
        );
      })()}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quản lý Nhân viên</Text>
          <Text style={styles.subtitle}>Tổ chức và liên kết nhân sự, tài khoản</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'personnel' && styles.tabBtnActive]} onPress={() => setViewMode('personnel')}>
          <Text style={[styles.tabText, viewMode === 'personnel' && styles.tabTextActive]}>Danh sách nhân sự</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'machine' && styles.tabBtnActive]} onPress={() => setViewMode('machine')}>
          <Text style={[styles.tabText, viewMode === 'machine' && styles.tabTextActive]}>Máy chấm công</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'connections' && styles.tabBtnActive]} onPress={() => setViewMode('connections')}>
          <Text style={[styles.tabText, viewMode === 'connections' && styles.tabTextActive]}>Liên kết</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 15 }}>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' }}
          placeholder="Nhập từ khóa để tìm kiếm..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {viewMode === 'personnel' && renderPersonnelView()}
      {viewMode === 'connections' && renderConnectionsView()}
      {viewMode === 'machine' && renderMachineEmployeesView()}

      {/* Modal for adding/editing Personnel */}
      <Modal visible={showPersonnelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{personnelForm.id ? 'Sửa nhân sự' : 'Thêm nhân sự mới'}</Text>
            
            <Text style={styles.label}>Họ và tên</Text>
            <TextInput 
              style={styles.modalInput} 
              value={personnelForm.name} 
              onChangeText={t => setPersonnelForm({...personnelForm, name: t})}
              placeholder="Nhập họ và tên..."
            />

            {!personnelForm.id && (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={personnelForm.email}
                  onChangeText={t => setPersonnelForm({...personnelForm, email: t})}
                  placeholder="Nhập email nhân viên..."
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </>
            )}

            <Text style={styles.label}>Bộ phận</Text>
            <View style={{position: 'relative', zIndex: 100}}>
              <TouchableOpacity style={styles.modalInput} onPress={() => setShowDeptDropdown(!showDeptDropdown)}>
                <Text>{departments.find(d => d.id === personnelForm.department_id)?.name || 'Chọn bộ phận...'}</Text>
                <Ionicons name="chevron-down" size={16} style={{position: 'absolute', right: 10, top: 12}} />
              </TouchableOpacity>
              
              {showDeptDropdown && (
                <View style={styles.deptDropdown}>
                  <ScrollView style={{maxHeight: 150}}>
                    {departments.map(d => (
                      <TouchableOpacity key={d.id} style={styles.deptDropdownItem} onPress={() => { setPersonnelForm({...personnelForm, department_id: d.id}); setShowDeptDropdown(false); }}>
                        <Text>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.deptDropdownAddBtn} onPress={() => { setShowDeptInput(true); setShowDeptDropdown(false); }}>
                      <Ionicons name="add" size={16} color="#4a72b5" />
                      <Text style={{color: '#4a72b5', fontWeight: 'bold'}}>Thêm bộ phận mới</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>

            {showDeptInput && (
              <View style={{flexDirection: 'row', marginTop: 10, zIndex: 1}}>
                <TextInput 
                  style={[styles.modalInput, {flex: 1, marginBottom: 0}]} 
                  value={newDeptName} 
                  onChangeText={setNewDeptName}
                  placeholder="Nhập tên bộ phận..."
                />
                <TouchableOpacity style={styles.addDeptBtn} onPress={handleAddDept}>
                  <Text style={{color: '#fff'}}>Thêm</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPersonnelModal(false)}>
                <Text style={{color: '#555'}}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSavePersonnel}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
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
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    // Removed overflow: 'hidden' to prevent dropdown from being clipped
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeOwner: {
    backgroundColor: '#f28baf',
  },
  badgeManager: {
    backgroundColor: '#4a72b5',
  },
  badgeEmployee: {
    backgroundColor: '#4caf50',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  statusConnected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  statusDisconnected: {
    backgroundColor: '#fff7e6',
    borderColor: '#ffa500',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusConnectedText: {
    color: '#4caf50',
  },
  statusDisconnectedText: {
    color: '#cc7a00',
  },
  actionBtn: {
    backgroundColor: '#4a72b5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  personnelActions: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  roleActionSlot: {
    width: 112,
    alignItems: 'flex-end',
  },
  iconActionSlot: {
    width: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconActionBtn: {
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  addBtnRow: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fbff',
  },
  dropdownBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dropdownList: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    maxHeight: 150,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  saveBtn: {
    backgroundColor: '#4caf50',
    padding: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  cancelBtn: {
    backgroundColor: '#f28baf',
    padding: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: 400,
    borderRadius: 12,
    padding: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  deptDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    elevation: 5,
    zIndex: 1000,
  },
  deptDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deptDropdownAddBtn: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f5f8fd',
  },
  addDeptBtn: {
    backgroundColor: '#4a72b5',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 6,
    marginLeft: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 30,
    zIndex: 1,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  modalSaveBtn: {
    backgroundColor: '#4a72b5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  }
});

export default EmployeeManagement;
