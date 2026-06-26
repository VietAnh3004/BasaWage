import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchableDropdownProps {
  data: any[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  keyExtractor: (item: any) => string;
  labelExtractor: (item: any) => string;
  style?: any;
  showClear?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  data,
  value,
  onChange,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm kiếm...',
  keyExtractor,
  labelExtractor,
  style,
  showClear = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = data.find(item => keyExtractor(item) === value);

  const filteredData = data.filter(item => {
    if (!searchQuery) return true;
    const label = labelExtractor(item).toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        style={styles.dropdownBtn} 
        onPress={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: selectedItem ? '#333' : '#888' }}>
          {selectedItem ? labelExtractor(selectedItem) : placeholder}
        </Text>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#555" />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdownList}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#888" style={{marginRight: 5}} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
          </View>
          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            {showClear && (
              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={() => { onChange(null); setIsOpen(false); }}
              >
                <Text style={{ color: '#888', fontStyle: 'italic' }}>Bỏ chọn</Text>
              </TouchableOpacity>
            )}
            
            {filteredData.length === 0 ? (
              <Text style={{ padding: 10, color: '#888', textAlign: 'center' }}>Không tìm thấy kết quả</Text>
            ) : (
              filteredData.map(item => (
                <TouchableOpacity 
                  key={keyExtractor(item)} 
                  style={[styles.dropdownItem, value === keyExtractor(item) && styles.dropdownItemActive]} 
                  onPress={() => { onChange(keyExtractor(item)); setIsOpen(false); }}
                >
                  <Text style={{ color: value === keyExtractor(item) ? '#4a72b5' : '#333', fontWeight: value === keyExtractor(item) ? 'bold' : 'normal' }}>
                    {labelExtractor(item)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100, // needs high z-index
  },
  dropdownBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    maxHeight: 250,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    outlineWidth: 0
  },
  scrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownItemActive: {
    backgroundColor: '#f5f8fd',
  }
});

export default SearchableDropdown;
