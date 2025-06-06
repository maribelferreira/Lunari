import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { DateData } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, router } from 'expo-router';
import { db } from '../../db';
import { periodDates } from '../../db/schema';
import { PeriodPredictionService } from '../../services/periodPredictions';
import { BaseCalendar } from '../components/BaseCalendar';
import { CalendarLegend } from '../components/CalendarLegend';
import { CycleDetails } from '../components/CycleDetails';
import { MarkedDates, formatDateString } from '../types/calendarTypes';

// Export a function to navigate to the period calendar screen
export function openPeriodModal() {
  router.push('/period-calendar');
}

export default function CalendarScreen() {
  const [selectedDates, setSelectedDates] = useState<MarkedDates>({});
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [baseMarkedDates, setBaseMarkedDates] = useState<MarkedDates>({});
  const [firstPeriodDate, setFirstPeriodDate] = useState<string | null>(null);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateString(new Date()));
  const [currentDate] = useState(formatDateString(new Date()));
  const [currentMonth, setCurrentMonth] = useState('');
  const [calendarKey, setCalendarKey] = useState(Date.now());
  const params = useLocalSearchParams();
  
  // Check if we should navigate to the period calendar screen from URL params
  useEffect(() => {
    if (params.openPeriodModal === 'true') {
      router.push('/period-calendar');
    }
  }, [params.openPeriodModal]);
  
  // Load period dates from database
  const loadData = async () => {
    const saved = await db.select().from(periodDates);
    
    const dates = saved.reduce((acc: MarkedDates, curr) => { 
      acc[curr.date] = { 
        selected: true, 
        customStyles: { 
          container: { 
            backgroundColor: '#FF597B',
            borderRadius: 16,
          },
          text: {
            color: '#FFFFFF'  // Make text white for period days
          }
        } 
      };
      return acc;
    }, {} as MarkedDates);
    
    setSelectedDates(dates);
    
    if (saved.length > 0) {
      // Sort dates in descending order for grouping
      const sortedDates = saved.map(s => s.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
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

      // Get the start date of the most recent period
      const mostRecentPeriod = periods[0];
      const mostRecentStart = mostRecentPeriod[mostRecentPeriod.length - 1]; // Get the earliest date in the period
      
      setFirstPeriodDate(mostRecentStart);
      
      // Generate predictions and marked dates
      generateMarkedDates(dates, mostRecentStart);
    } else {
      setFirstPeriodDate(null);
      setCycleDay(null);
      setMarkedDates({});
    }
  };

  // Generate all marked dates including predictions
  const generateMarkedDates = (periodDates: MarkedDates, startDate: string) => {
    if (!startDate) return;
    
    const allMarkedDates = { ...periodDates };
    const cycleLength = PeriodPredictionService.getAverageCycleLength(Object.keys(periodDates));
    
    // Generate predictions for the next 3 months
    for (let i = 0; i < 3; i++) {
      // Create date from startDate, ensuring we use a consistent date format
      const startDateParts = startDate.split('-');
      const year = parseInt(startDateParts[0]);
      const month = parseInt(startDateParts[1]) - 1; // JS months are 0-indexed
      const day = parseInt(startDateParts[2]);
      
      // Create a new date at noon to avoid timezone issues
      const nextPeriodDate = new Date(year, month, day + cycleLength * (i + 1), 12, 0, 0);
      const nextPeriodDateString = formatDateString(nextPeriodDate);
      
      // Mark 5 days of predicted period
      for (let j = 0; j < 5; j++) {
        const predictedDay = new Date(nextPeriodDate);
        predictedDay.setDate(predictedDay.getDate() + j);
        const predictedDayString = formatDateString(predictedDay);
        
        // Only apply prediction style if this is not an actual period date
        if (!allMarkedDates[predictedDayString] || !allMarkedDates[predictedDayString].selected) {
          allMarkedDates[predictedDayString] = {
            customStyles: {
              container: {
                borderWidth: 1.5,
                borderRadius: 16,
                borderStyle: 'dashed',
                borderColor: '#FF597B',
                backgroundColor: 'transparent',
              },
              text: {
                color: '#FF597B'
              }
            }
          };
        }
      }
    }
    
    // Mark today with a gray background, but preserve period styling if it's a period day
    if (allMarkedDates[currentDate] && allMarkedDates[currentDate].selected) {
      // This is both today and a period day - keep period background but add border
      allMarkedDates[currentDate] = {
        ...allMarkedDates[currentDate],
        customStyles: {
          ...allMarkedDates[currentDate].customStyles,
          container: {
            ...allMarkedDates[currentDate].customStyles?.container,
            borderWidth: 2,
            borderColor: 'black',
          },
          // Ensure text is white for period days
          text: {
            color: '#FFFFFF'
          }
        }
      };
    } else {
      // This is just today, not a period day
      allMarkedDates[currentDate] = {
        ...allMarkedDates[currentDate],
        customStyles: {
          ...(allMarkedDates[currentDate]?.customStyles || {}),
          container: {
            ...(allMarkedDates[currentDate]?.customStyles?.container || {}),
            backgroundColor: allMarkedDates[currentDate]?.customStyles?.container?.backgroundColor || '#E6E6E6',
            borderRadius: 16,
          }
        }
      };
    }
    
    // Store base marked dates (without selection highlight)
    setBaseMarkedDates(allMarkedDates);
  };

  // Update cycle day info for selected date
  const updateSelectedDateInfo = (date: string) => {
    if (!firstPeriodDate) return;
    
    const selectedDateObj = new Date(date);
    const startDateObj = new Date(firstPeriodDate);
    
    // Only calculate cycle day if selected date is after first period
    if (selectedDateObj >= startDateObj) {
      const cycleInfo = PeriodPredictionService.getCycleInfo(firstPeriodDate, date);
      setCycleDay(cycleInfo.cycleDay);
    } else {
      setCycleDay(null);
    }
  };

  // Reload data when tab is focused
  useFocusEffect(
    useCallback(() => {
      const reloadData = async () => {
        await loadData();
        // Reset to current date whenever tab is focused
        const today = formatDateString(new Date());
        setSelectedDate(today);
        setCalendarKey(Date.now()); // Force calendar re-render
      };
      reloadData();
      return () => {};
    }, [])
  );

  // Initial load
  useEffect(() => {
    loadData();
    updateSelectedDateInfo(selectedDate);
    
    // Set initial month display
    const date = new Date(selectedDate);
    setCurrentMonth(`${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`);
  }, []);
  
  // Update cycle info when selected date changes
  useEffect(() => {
    updateSelectedDateInfo(selectedDate);
  }, [selectedDate, firstPeriodDate]);

  // Update selected date highlight
  const updateSelectedDateHighlight = useCallback(() => {
    if (!selectedDate) return baseMarkedDates;
    
    // Create a new object with all the base marked dates
    const updatedMarkedDates = { ...baseMarkedDates };
    
    // Check if this is a period date (which should have white text)
    const isPeriodDate = updatedMarkedDates[selectedDate]?.customStyles?.container?.backgroundColor === '#FF597B';
    
    // Add the highlight style only to the currently selected date
    updatedMarkedDates[selectedDate] = {
      ...updatedMarkedDates[selectedDate],
      customStyles: {
        ...(updatedMarkedDates[selectedDate]?.customStyles || {}),
        container: {
          ...(updatedMarkedDates[selectedDate]?.customStyles?.container || {}),
          borderWidth: 2,
          borderColor: 'black',
          borderRadius: 16,
        },
        // Only override text color if it's not already a period date
        text: isPeriodDate 
          ? { color: '#FFFFFF' } 
          : updatedMarkedDates[selectedDate]?.customStyles?.text
      }
    };
    
    return updatedMarkedDates;
  }, [selectedDate, baseMarkedDates]);

  // Update marked dates when selected date or base marked dates change
  useEffect(() => {
    setMarkedDates(updateSelectedDateHighlight());
  }, [selectedDate, baseMarkedDates, updateSelectedDateHighlight]);

  // Handle saving period dates
  const savePeriodDates = async (dates: MarkedDates) => {
    try {
      await db.delete(periodDates);
      
      const dateInserts = Object.keys(dates).map(date => ({
        date
      }));
      
      if (dateInserts.length > 0) {
        await db.insert(periodDates).values(dateInserts);
      }
      
      loadData(); // Reload data after saving
    } catch (error) {
      console.error('Error saving dates:', error);
    }
  };

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const onMonthChange = (month: DateData) => {
    setCurrentMonth(`${new Date(month.dateString).toLocaleString('default', { month: 'long' })} ${new Date(month.dateString).getFullYear()}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.calendarContainer}>
          <BaseCalendar
            mode="view"
            key={calendarKey}
            current={selectedDate}
            markedDates={markedDates}
            onDayPress={onDayPress}
            onMonthChange={onMonthChange}
          />
        </View>
        
        <CalendarLegend />
        
        <CycleDetails 
          selectedDate={selectedDate}
          cycleDay={cycleDay}
        />
        
        {/* Add bottom padding to prevent content from being cut off */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 16,
  },
  calendarContainer: {
    paddingTop: 4,
  },
  bottomPadding: {
    height: 10, // Add extra padding at the bottom to ensure content isn't cut off
  },
});
