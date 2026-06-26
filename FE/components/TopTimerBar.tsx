import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TopTimerBar = () => {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons name="document-text-outline" size={18} color="#ccc" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="What are you working on right now?"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.actionsContainer}>
        <View style={styles.tagsContainer}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="folder-outline" size={16} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="pricetag-outline" size={16} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.billableButton}>
            <View style={styles.billableDot} />
            <Text style={styles.billableText}>Billable</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timerControls}>
          <Text style={styles.timerText}>00:00:00</Text>
          <TouchableOpacity style={styles.startBtn}>
            <Text style={styles.startBtnText}>Start timer</Text>
            <Ionicons name="play" size={14} color="#000" style={{ marginLeft: 5 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualBtn}>
            <Text style={styles.manualBtnText}>Enter manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    outlineStyle: 'none' as any,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 15,
  },
  billableButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billableDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8aa8db',
    marginRight: 6,
  },
  billableText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#aaa',
    marginRight: 20,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8aa8db',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 10,
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  manualBtn: {
    backgroundColor: '#f4f6f8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  manualBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default TopTimerBar;
