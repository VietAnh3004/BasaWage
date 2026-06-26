import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const EmployeeManagement = () => {
  const { user, company } = useAuth();
  const [members, setMembers] = useState([]);
  const [machineEmployees, setMachineEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkingUserId, setLinkingUserId] = useState(null);
  const [linkInput, setLinkInput] = useState('');

  const isOwner = company.role === 'owner';
  const canManage = company.role === 'owner' || company.role === 'manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch members
      const resMembers = await fetch(`${API_URL}/api/boss/members?company_id=${company.company_id}`);
      const dataMembers = await resMembers.json();
      if (dataMembers.members) setMembers(dataMembers.members);

      // Fetch machine employees to show in dropdown
      const resAttendance = await fetch(`${API_URL}/api/attendance?company_id=${company.company_id}`);
      const dataAttendance = await resAttendance.json();
      if (dataAttendance.employees) setMachineEmployees(dataAttendance.employees);
      
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (memberId) => {
    try {
      await fetch(`${API_URL}/api/boss/members/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeRole = async (memberId, currentRole) => {
    if (!isOwner) return;
    const newRole = currentRole === 'employee' ? 'manager' : 'employee';
    try {
      await fetch(`${API_URL}/api/boss/members/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId, role: newRole })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkEnNo = async (memberId, enNo) => {
    try {
      await fetch(`${API_URL}/api/boss/members/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.company_id, user_id: memberId, linked_enno: enNo })
      });
      setLinkingUserId(null);
      setLinkInput('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#4a72b5" style={{marginTop: 50}} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quản lý Nhân viên</Text>
          <Text style={styles.subtitle}>Danh sách thành viên trong công ty</Text>
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

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, {flex: 2}]}>Username</Text>
          <Text style={[styles.cell, {flex: 1}]}>Vai trò</Text>
          <Text style={[styles.cell, {flex: 1}]}>Trạng thái</Text>
          <Text style={[styles.cell, {flex: 2}]}>Mã Máy Chấm Công</Text>
          <Text style={[styles.cell, {flex: 2, textAlign: 'center'}]}>Hành động</Text>
        </View>

        {members.map((m, index) => (
          <View key={m.user_id} style={[styles.tableRow, { zIndex: linkingUserId === m.user_id ? 1000 : 1 }]}>
            <Text style={[styles.cell, {flex: 2, fontWeight: 'bold'}]}>{m.username} {m.user_id === user.id ? '(Bạn)' : ''}</Text>
            
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

            <View style={{flex: 2}}>
              {linkingUserId === m.user_id ? (
                <View style={styles.linkContainer}>
                  <TextInput 
                    style={styles.input} 
                    value={linkInput} 
                    onChangeText={setLinkInput}
                    placeholder="Nhập ID..."
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleLinkEnNo(m.user_id, linkInput)}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkingUserId(null)}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                  
                  {/* Dropdown for quick select */}
                  {machineEmployees.length > 0 && (
                    <View style={styles.dropdown}>
                      <Text style={{fontSize: 10, color: '#888', marginBottom: 5}}>Hoặc chọn từ máy:</Text>
                      <ScrollView style={{maxHeight: 100}}>
                        {machineEmployees.map(me => (
                          <TouchableOpacity key={me.enNo} style={styles.dropdownItem} onPress={() => setLinkInput(me.enNo)}>
                            <Text style={{fontSize: 12}}>{me.enNo} - {me.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={{marginRight: 10, color: m.linked_enno ? '#333' : '#aaa'}}>
                    {m.linked_enno || 'Chưa gán'}
                  </Text>
                  {canManage && (
                    <TouchableOpacity onPress={() => { setLinkingUserId(m.user_id); setLinkInput(m.linked_enno || ''); }}>
                      <Ionicons name="pencil" size={16} color="#4a72b5" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={{flex: 2, flexDirection: 'row', justifyContent: 'center'}}>
              {m.status === 'pending' && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(m.user_id)}>
                  <Text style={styles.actionText}>Duyệt</Text>
                </TouchableOpacity>
              )}
              
              {isOwner && m.role !== 'owner' && m.status === 'active' && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#eee'}]} onPress={() => handleChangeRole(m.user_id, m.role)}>
                  <Text style={[styles.actionText, {color: '#555'}]}>
                    {m.role === 'employee' ? 'Lên làm Sếp' : 'Hạ xuống NV'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 4,
    width: 80,
    fontSize: 12,
    marginRight: 5,
    backgroundColor: '#fff',
  },
  saveBtn: {
    backgroundColor: '#4a72b5',
    padding: 6,
    borderRadius: 4,
    marginRight: 5,
  },
  cancelBtn: {
    backgroundColor: '#f28baf',
    padding: 6,
    borderRadius: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 180,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 9999,
  },
  dropdownItem: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  }
});

export default EmployeeManagement;
