import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../../db';
import { periodDates } from '../../db/schema';
import { PeriodPredictionService } from '../../services/periodPredictions';
import { StatCard } from '../components/StatCard';
import { CycleHistory } from '../components/CycleHistory';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../styles/theme';
interface CycleData {
  startDate: string;
  cycleLength: string | number;
  periodLength: number;
}

interface HistoryEntryWithDate extends CycleData {
  originalDate: string;
}

export default function Stats() {
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [averageCycleLength, setAverageCycleLength] = useState<number>(0);
  const [averagePeriodLength, setAveragePeriodLength] = useState<number>(0);
  const [cycleHistory, setCycleHistory] = useState<CycleData[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadStatistics();
      return () => {};
    }, [])
  );

  // Format date as "MMM DD" (e.g., "Apr 10")
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const loadStatistics = async () => {
    try {
      // Load period dates from the database
      const saved = await db.select().from(periodDates);
      
      if (saved.length === 0) {
        // Reset all states when there are no period dates
        setCompletedCycles(0);
        setAverageCycleLength(0);
        setAveragePeriodLength(0);
        setCycleHistory([]);
        return;
      }

      // Sort dates in descending order for grouping
      const sortedDates = saved.map(s => s.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      // Group consecutive days into periods
      const periods: string[][] = [];
      let currentPeriod: string[] = [sortedDates[0]];

      for (let i = 1; i < sortedDates.length; i++) {
        const dayDiff = Math.abs((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i-1]).getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff <= 7) {
          currentPeriod.push(sortedDates[i]);
        } else {
          periods.push(currentPeriod);
          currentPeriod = [sortedDates[i]];
        }
      }
      periods.push(currentPeriod);

      // Calculate completed cycles (periods - 1)
      const cycles = Math.max(0, periods.length - 1);
      setCompletedCycles(cycles);

      // Calculate average cycle length
      const cycleLength = PeriodPredictionService.getAverageCycleLength(sortedDates);
      setAverageCycleLength(cycleLength);

      // Calculate average period length
      const periodLengths = periods.map(period => period.length);
      const totalPeriodLength = periodLengths.reduce((sum, length) => sum + length, 0);
      const avgPeriodLength = Math.round(totalPeriodLength / periodLengths.length);
      setAveragePeriodLength(avgPeriodLength);
      
      // Generate cycle history data
      const history: HistoryEntryWithDate[] = [];
      
      console.log("Original periods:", periods);

      // The periods array is in descending order (newest to oldest)
      // We need to reverse it to get chronological order (oldest to newest)
      const chronologicalPeriods = [...periods].reverse();

      console.log("Chronological periods:", chronologicalPeriods);

      // Create an array of period start dates (first day of each period)
      const periodStartDates = chronologicalPeriods.map(period => {
        const sortedPeriod = [...period].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        return sortedPeriod[0];
      });

      // Sort period start dates in chronological order (oldest to newest)
      periodStartDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      console.log("Period start dates:", periodStartDates);

      // For each period, calculate its data
      for (let i = 0; i < chronologicalPeriods.length; i++) {
        const period = chronologicalPeriods[i];
        // Get the start date for this period
        const sortedPeriod = [...period].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const startDate = sortedPeriod[0];
        
        // Calculate cycle length
        let cycleLengthValue: string | number;
        
        // Check if this is the most recent period (last in the array after sorting)
        if (i === chronologicalPeriods.length - 1) {
          console.log(`Marking cycle starting on ${startDate} as "In progress"`);
          cycleLengthValue = "In progress";
        } else {
          const currentStartDate = periodStartDates[i];
          const nextStartDate = periodStartDates[i + 1];
          
          const daysBetween = Math.round(
            Math.abs((new Date(nextStartDate).getTime() - new Date(currentStartDate).getTime()) / (1000 * 60 * 60 * 24))
          );
          cycleLengthValue = daysBetween;
        }
        
        // Add to history with the original date for sorting
        const historyEntry = {
          startDate: formatDate(startDate),
          originalDate: startDate, // Store original date for sorting
          cycleLength: cycleLengthValue,
          periodLength: period.length
        };
        history.push(historyEntry);
      }
      
      // Sort history from most recent to oldest
      history.sort((a, b) => {
        const dateA = new Date(a.originalDate);
        const dateB = new Date(b.originalDate);
        return dateB.getTime() - dateA.getTime();
      });

      // Remove originalDate field before setting state
      const cleanHistory = history.map(({ originalDate, ...rest }) => rest);
      setCycleHistory(cleanHistory);
      
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  return (
    <ScrollView style={theme.globalStyles.container}>
      <View style={styles.myCyclesContainer}>
      <Text style={styles.heading}>My cycles</Text>
      <View style={styles.cardsContainer}>
        <View style={{flex: 1}}>
          <StatCard 
            title="Average cycle" 
            value={`${averageCycleLength} days`} 
            icon={<Feather name="calendar" size={20} color="#000" />} 
          />
        </View>
        <View style={{flex: 1}}>
          <StatCard 
            title="Period length" 
            value={`${averagePeriodLength} days`} 
            icon={<MaterialCommunityIcons name="water-outline" size={20} color="#000" />} 
          />
        </View>
      </View>
      </View>
      <CycleHistory cycles={cycleHistory} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({

  myCyclesContainer: {
    marginVertical: 16,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 20,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
});
