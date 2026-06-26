import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TaskList = () => {
  const tasks = [
    { id: 1, task: 'Deleted templates', project: 'Tymewise', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: ['design'] },
    { id: 2, task: 'Deleted templates', project: 'Process place', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: [] },
    { id: 3, task: 'Employee onboarding for the main offic...', project: 'LittleDate', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: ['design', 'freelance'], extras: 2 },
    { id: 4, task: 'Sick leave request', project: 'LittleDate', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: [] },
    { id: 5, task: 'Request new hire', project: 'Process place', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: ['freelance'] },
    { id: 6, task: 'New client onboarding', project: 'Tymewise', entry: '01:23:17', time: '11:23 AM - 2:01 PM', rate: '$', tags: [] },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateText}>October 24, 2020</Text>
        <Text style={styles.totalTime}>07:56:03</Text>
      </View>

      <View style={styles.tableHeader}>
        <View style={styles.colCheckbox}><Ionicons name="square-outline" size={16} color="#ccc" /></View>
        <View style={styles.colTask}><Text style={styles.colHeaderText}>TASK</Text></View>
        <View style={styles.colProject}><Text style={styles.colHeaderText}>PROJECT</Text></View>
        <View style={styles.colEntry}><Text style={styles.colHeaderText}>ENTRY</Text></View>
        <View style={styles.colRate}><Text style={styles.colHeaderText}>RATE</Text></View>
        <View style={styles.colTags}><Text style={styles.colHeaderText}>TAGS</Text></View>
        <View style={styles.colAction}></View>
      </View>

      {tasks.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.colCheckbox}><Ionicons name="square-outline" size={16} color="#ccc" /></View>
          <View style={styles.colTask}>
            <Text style={styles.taskText} numberOfLines={1}>{item.task}</Text>
          </View>
          <View style={styles.colProject}>
            <Text style={styles.projectText}>{item.project}</Text>
          </View>
          <View style={styles.colEntry}>
            <Text style={styles.entryDuration}>{item.entry}</Text>
            <Text style={styles.entryTime}>{item.time}</Text>
          </View>
          <View style={styles.colRate}>
            <Text style={styles.rateText}>{item.rate}</Text>
          </View>
          <View style={styles.colTags}>
            <View style={styles.tagsContainer}>
              {item.tags.map((tag, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.extras && (
                <View style={styles.extraBadge}>
                  <Text style={styles.extraText}>{item.extras}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.colAction}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#ccc" />
          </View>
        </View>
      ))}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  totalTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  colHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
    alignItems: 'center',
  },
  colCheckbox: { width: 30, alignItems: 'center' },
  colTask: { flex: 2, paddingRight: 10 },
  colProject: { flex: 1.5 },
  colEntry: { flex: 2, flexDirection: 'row', alignItems: 'center' },
  colRate: { width: 50, alignItems: 'center' },
  colTags: { flex: 2 },
  colAction: { width: 40, alignItems: 'center' },
  taskText: {
    fontSize: 14,
    color: '#333',
  },
  projectText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  entryDuration: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 15,
  },
  entryTime: {
    fontSize: 12,
    color: '#999',
  },
  rateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#555',
  },
  extraBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  extraText: {
    fontSize: 11,
    color: '#555',
  },
});

export default TaskList;
