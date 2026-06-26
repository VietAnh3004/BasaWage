import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, currentPage === 1 && styles.btnDisabled]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? '#ccc' : '#4a72b5'} />
        <Text style={[styles.btnText, currentPage === 1 && styles.textDisabled]}>Trước</Text>
      </TouchableOpacity>
      
      <View style={styles.pageInfo}>
        <Text style={styles.pageText}>Trang {currentPage} / {totalPages}</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, currentPage === totalPages && styles.btnDisabled]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <Text style={[styles.btnText, currentPage === totalPages && styles.textDisabled]}>Sau</Text>
        <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? '#ccc' : '#4a72b5'} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f8fd',
    marginHorizontal: 10,
  },
  btnDisabled: {
    backgroundColor: '#fafafa',
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4a72b5',
    marginHorizontal: 5,
  },
  textDisabled: {
    color: '#ccc',
  },
  pageInfo: {
    paddingHorizontal: 15,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
});

export default Pagination;
