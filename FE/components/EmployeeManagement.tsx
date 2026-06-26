import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SearchableDropdown from './SearchableDropdown';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const EmployeeManagement = () => {
  const { user, company } = useAuth();
  
  const [viewMode, setViewMode] = useState<'personnel' | 'users' | 'connections'>('personnel');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [members, setMembers] = useState<any[]>([]);
  const [machineEmployees, setMachineEmployees] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Personnel Form
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [personnelForm, setPersonnelForm] = useState({ id: null, name: '', department_id: null });
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);

  // Connection Form
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [connForm, setConnForm] = useState({ personnel_id: '', user_id: '', enno: '' });
  const [openDropdown, setOpenDropdown] = useState(''); // 'personnel', 'user', 'enno'

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

  const handleApprove = async (memberId: string) => {
    try {
      await fetch(`${API_URL}/api/boss/members/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId })
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleChangeRole = async (memberId: string, currentRole: string) => {
    if (!isOwner) return;
    const newRole = currentRole === 'employee' ? 'manager' : 'employee';
    try {
      await fetch(`${API_URL}/api/boss/members/role`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId, role: newRole })
      });
      fetchData();
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
    try {
      const url = personnelForm.id 
        ? `${API_URL}/api/boss/personnel/${personnelForm.id}`
        : `${API_URL}/api/boss/personnel`;
      const method = personnelForm.id ? 'PUT' : 'POST';
      
      await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, name: personnelForm.name, department_id: personnelForm.department_id })
      });
      setShowPersonnelModal(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDeletePersonnel = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/boss/personnel/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleSaveConnection = async () => {
    if (!connForm.personnel_id) return alert('Vui lòng chọn nhân sự');
    try {
      await fetch(`${API_URL}/api/boss/personnel/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company_id: company.company_id, 
          personnel_id: connForm.personnel_id, 
          user_id: connForm.user_id || null, 
          enno: connForm.enno || null 
        })
      });
      setShowAddConnection(false);
      setConnForm({ personnel_id: '', user_id: '', enno: '' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await fetch(`${API_URL}/api/boss/personnel/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDisconnect = async (personnel_id: string, user_id: string | null) => {
    try {
      await fetch(`${API_URL}/api/boss/personnel/disconnect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, personnel_id, user_id })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  const renderPersonnelView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Họ và tên</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Bộ phận</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Trạng thái</Text>
        <Text style={[styles.cell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Hành động</Text>
      </View>
      {personnel.filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.department_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
        <View key={p.id} style={styles.tableRow}>
          <Text style={[styles.cell, {flex: 2}]}>{p.name}</Text>
          <Text style={[styles.cell, {flex: 2}]}>{p.department_name || '-'}</Text>
          <View style={{flex: 2, flexDirection: 'row', alignItems: 'center'}}>
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
          <View style={{flex: 1, flexDirection: 'row', justifyContent: 'center'}}>
            {canManage && (
              <>
                <TouchableOpacity onPress={() => { setPersonnelForm({id: p.id, name: p.name, department_id: p.department_id}); setShowPersonnelModal(true); }} style={{marginRight: 10}}>
                  <Ionicons name="pencil" size={18} color="#4a72b5" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeletePersonnel(p.id)}>
                  <Ionicons name="trash" size={18} color="#f28baf" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
      {canManage && (
        <TouchableOpacity style={styles.addBtnRow} onPress={() => { setPersonnelForm({id: null, name: '', department_id: null}); setShowPersonnelModal(true); }}>
          <Ionicons name="add-circle" size={20} color="#4a72b5" />
          <Text style={{color: '#4a72b5', fontWeight: 'bold', marginLeft: 5}}>Thêm nhân sự mới</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUsersView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Email / Tài khoản</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Tên nhân viên</Text>
        <Text style={[styles.cell, {flex: 1, fontWeight: 'bold'}]}>Vai trò</Text>
        <Text style={[styles.cell, {flex: 1, fontWeight: 'bold'}]}>Trạng thái</Text>
        <Text style={[styles.cell, {flex: 2, textAlign: 'center', fontWeight: 'bold'}]}>Hành động</Text>
      </View>
      {members.filter(m => !searchQuery || m.username?.toLowerCase().includes(searchQuery.toLowerCase()) || m.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) || m.role?.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
        <View key={m.user_id} style={styles.tableRow}>
          <Text style={[styles.cell, {flex: 2}]}>{m.user_email || 'N/A'} {m.user_id === user.id ? '(Bạn)' : ''}</Text>
          <Text style={[styles.cell, {flex: 2}]}>{m.username}</Text>
          <View style={{flex: 1}}>
            <View style={[styles.badge, m.role === 'owner' ? styles.badgeOwner : m.role === 'manager' ? styles.badgeManager : styles.badgeEmployee]}>
              <Text style={styles.badgeText}>{m.role}</Text>
            </View>
          </View>
          <View style={{flex: 1}}>
            <Text style={{color: m.status === 'active' ? '#4a72b5' : '#ffa500', fontWeight: 'bold'}}>
              {m.status === 'active' ? 'Đã duyệt' : 'Chờ duyệt'}
            </Text>
          </View>
          <View style={{flex: 2, flexDirection: 'row', justifyContent: 'center'}}>
            {m.status === 'pending' && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(m.user_id)}>
                <Text style={styles.actionText}>Duyệt</Text>
              </TouchableOpacity>
            )}
            {isOwner && m.role !== 'owner' && m.status === 'active' && (
              <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#eee'}]} onPress={() => handleChangeRole(m.user_id, m.role)}>
                <Text style={[styles.actionText, {color: '#555'}]}>{m.role === 'employee' ? 'Lên quản lý' : 'Hạ xuống NV'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const renderConnectionsView = () => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Tên nhân sự</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Tài khoản NV</Text>
        <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>Mã máy chấm công</Text>
        <Text style={[styles.cell, {flex: 1, textAlign: 'center', fontWeight: 'bold'}]}>Lưu</Text>
      </View>
      
      {showAddConnection && (
        <View style={[styles.tableRow, {backgroundColor: '#f5f8fd', zIndex: 999}]}>
          {/* Personnel Dropdown */}
          <View style={{flex: 2, position: 'relative', paddingRight: 10, zIndex: 3000}}>
            <SearchableDropdown
              data={personnel}
              value={connForm.personnel_id}
              onChange={(val) => setConnForm({...connForm, personnel_id: val})}
              placeholder="Chọn nhân sự..."
              searchPlaceholder="Tìm kiếm nhân sự..."
              keyExtractor={item => item.id}
              labelExtractor={item => item.name}
              showClear={false}
            />
          </View>
          
          {/* User Account Dropdown */}
          <View style={{flex: 2, position: 'relative', paddingRight: 10, zIndex: 2000}}>
            <SearchableDropdown
              data={members}
              value={connForm.user_id}
              onChange={(val) => setConnForm({...connForm, user_id: val})}
              placeholder="Chọn tài khoản..."
              searchPlaceholder="Tìm kiếm tài khoản..."
              keyExtractor={item => item.user_id}
              labelExtractor={item => `${item.username} (${item.user_email || 'N/A'})`}
              showClear={true}
            />
          </View>
          
          {/* Timeclock Dropdown */}
          <View style={{flex: 2, position: 'relative', paddingRight: 10, zIndex: 1000}}>
            <SearchableDropdown
              data={machineEmployees}
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
          <Text style={{color: '#4a72b5', fontWeight: 'bold', marginLeft: 5}}>Kết nối mới</Text>
        </TouchableOpacity>
      )}

      {/* Existing connections */}
      {personnel.filter(p => p.user_id || p.enno).filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.user_username?.toLowerCase().includes(searchQuery.toLowerCase()) || p.enno?.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
        <View key={p.id} style={styles.tableRow}>
          <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>{p.name}</Text>
          <Text style={[styles.cell, {flex: 2}]}>{p.user_username ? `${p.user_username} (${p.user_email || 'N/A'})` : '-'}</Text>
          <Text style={[styles.cell, {flex: 2}]}>
            {p.enno ? `${p.enno} - ${machineEmployees.find(m => m.enNo === p.enno)?.name || '?'}` : '-'}
          </Text>
          <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
            <TouchableOpacity onPress={() => {
              setConnForm({ personnel_id: p.id, user_id: p.user_id || '', enno: p.enno || '' });
              setShowAddConnection(true);
            }} style={{marginRight: 15}}>
              <Ionicons name="pencil" size={16} color="#4a72b5" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => handleDisconnect(p.id, p.user_id)}>
              <Ionicons name="trash" size={16} color="#f28baf" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quản lý Nhân viên</Text>
          <Text style={styles.subtitle}>Tổ chức và liên kết nhân sự, tài khoản</Text>
        </View>
        <TouchableOpacity 
          style={{backgroundColor: '#e2ecd2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#c4d7a8'}}
          onPress={() => {
            if (navigator && navigator.clipboard) {
              navigator.clipboard.writeText(company.join_code);
              alert('Đã copy mã mời: ' + company.join_code);
            } else {
              alert('Mã mời của bạn là: ' + company.join_code);
            }
          }}
        >
          <Text style={{color: '#5e802b', fontWeight: 'bold'}}>Lấy Mã Mời: {company.join_code}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'personnel' && styles.tabBtnActive]} onPress={() => setViewMode('personnel')}>
          <Text style={[styles.tabText, viewMode === 'personnel' && styles.tabTextActive]}>Danh sách nhân sự</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'users' && styles.tabBtnActive]} onPress={() => setViewMode('users')}>
          <Text style={[styles.tabText, viewMode === 'users' && styles.tabTextActive]}>Tài khoản NV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, viewMode === 'connections' && styles.tabBtnActive]} onPress={() => setViewMode('connections')}>
          <Text style={[styles.tabText, viewMode === 'connections' && styles.tabTextActive]}>Kết nối</Text>
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
      {viewMode === 'users' && renderUsersView()}
      {viewMode === 'connections' && renderConnectionsView()}

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
    backgroundColor: '#e2ecd2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionBtn: {
    backgroundColor: '#4a72b5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 5,
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
