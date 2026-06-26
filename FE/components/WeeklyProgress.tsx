import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WeeklyProgress = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={16} color="#aaa" />
          <Text style={styles.searchText}>Search time entry</Text>
        </View>
        <View style={styles.controlsContainer}>
          <View style={styles.controlBtn}>
            <Ionicons name="menu-outline" size={16} color="#555" />
          </View>
          <View style={styles.controlBtn}>
            <Ionicons name="calendar-outline" size={16} color="#555" />
          </View>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.weekText}>This week</Text>
          <Text style={styles.totalTime}>27:56:03</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tymewise</Text>
            <Text style={[styles.statValue, { color: '#4a72b5' }]}>64%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Process Place</Text>
            <Text style={[styles.statValue, { color: '#f28baf' }]}>20%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>LittleDate</Text>
            <Text style={[styles.statValue, { color: '#f6a071' }]}>23%</Text>
          </View>
        </View>

        <View style={styles.barContainer}>
          <View style={[styles.barSegment, { flex: 0.64, backgroundColor: '#4a72b5' }]} />
          <View style={[styles.barSegment, { flex: 0.20, backgroundColor: '#f28baf' }]} />
          <View style={[styles.barSegment, { flex: 0.23, backgroundColor: '#f6a071' }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: 250,
  },
  searchText: {
    marginLeft: 10,
    color: '#aaa',
    fontSize: 14,
  },
  controlsContainer: {
    flexDirection: 'row',
  },
  controlBtn: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginLeft: 10,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  totalTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  barContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  barSegment: {
    height: '100%',
    marginRight: 4,
    borderRadius: 4,
  }
});

export default WeeklyProgress;
