interface PredictionResult {
  days: number;
  date: string;
  cycleLength: number;
}

interface FertilityWindow {
  start: string;
  end: string;
  ovulationDay: string;
}

interface CycleInfo {
  phase: string;
  description: string;
  cycleDay: number;
  pregnancyChance: string;
}

export class PeriodPredictionService {
  static getAverageCycleLength(dates: string[]): number {
    if (dates.length < 2) return 28;
    
    const sortedDates = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const periods: string[][] = [];
    let currentPeriod: string[] = [sortedDates[0]];

    // Group consecutive days into periods
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

    // Calculate weighted average
    let weightedTotal = 0;
    let weightSum = 0;
    let cycles = 0;

    for (let i = 1; i < Math.min(periods.length, 6); i++) {
      const currentPeriodStart = new Date(periods[i-1][periods[i-1].length-1]);
      const prevPeriodStart = new Date(periods[i][periods[i].length-1]);
      
      const dayDiff = Math.floor(
        (currentPeriodStart.getTime() - prevPeriodStart.getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      
      const weight = Math.max(1 - ((cycles) * 0.2), 0.2);
      weightedTotal += dayDiff * weight;
      weightSum += weight;
      cycles++;
    }
    
    return cycles > 0 ? Math.round(weightedTotal / weightSum) : 28;
  }

  static getPrediction(startDate: string, allDates: string[]): PredictionResult {
    const cycleLength = this.getAverageCycleLength(allDates);
    const today = new Date();
    const nextPeriod = new Date(startDate);
    
    nextPeriod.setDate(nextPeriod.getDate() + cycleLength);
    
    const daysUntil = Math.ceil((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return { 
      days: daysUntil, 
      date: nextPeriod.toLocaleDateString(),
      cycleLength 
    };
  }

  static getCurrentCycleDay(startDate: string, currentDate?: string): number {
    const start = new Date(startDate);
    const current = currentDate ? new Date(currentDate) : new Date();
    
    const dayDiff = Math.floor(
      (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return dayDiff + 1; // Add 1 because the first day of period is day 1
  }

  static getOvulationDay(startDate: string, cycleLength?: number): string {
    const start = new Date(startDate);
    const length = cycleLength || 28;
    
    // Ovulation typically occurs 14 days before the next period
    const ovulationDayOffset = length - 14;
    const ovulationDate = new Date(start);
    ovulationDate.setDate(ovulationDate.getDate() + ovulationDayOffset);
    
    return ovulationDate.toLocaleDateString();
  }

  static getFertilityWindow(startDate: string, cycleLength?: number): FertilityWindow {
    const cycle = cycleLength || 28;
    const ovulationDay = this.getOvulationDay(startDate, cycle);
    const ovulationDate = new Date(ovulationDay);
    
    const startWindow = new Date(ovulationDate);
    startWindow.setDate(ovulationDate.getDate() - 5); // Fertility typically starts 5 days before ovulation
    
    return {
      start: startWindow.toLocaleDateString(),
      end: ovulationDay,
      ovulationDay
    };
  }

  static getCyclePhase(cycleDay: number): string {
    if (cycleDay <= 5) return 'Menstrual';
    if (cycleDay <= 10) return 'Follicular';
    if (cycleDay <= 14) return 'Ovulatory';
    if (cycleDay <= 28) return 'Luteal';
    return 'Extended';
  }

  static getPhaseDescription(phase: string): string {
    switch (phase) {
      case 'Menstrual':
        return 'Your period is happening. You might experience cramps, fatigue, and mood changes. Focus on rest and self-care.';
      case 'Follicular':
        return 'Energy levels start to rise with increasing estrogen. Good time for starting new projects and physical activity.';
      case 'Ovulatory':
        return 'Peak fertility window. You might notice increased energy, better mood, and heightened sex drive.';
      case 'Luteal':
        return 'Progesterone rises. You might experience PMS symptoms like bloating or mood changes. Focus on gentle exercise and comfort.';
      case 'Extended':
        return 'Your cycle has gone longer than typical. Consider tracking any symptoms and consulting your healthcare provider if this persists.';
      default:
        return '';
    }
  }

  static getPregnancyChance(cycleDay: number): string {
    if (cycleDay >= 11 && cycleDay <= 17) return 'High';
    if ((cycleDay >= 8 && cycleDay <= 10) || (cycleDay >= 18 && cycleDay <= 20)) return 'Medium';
    return 'Low';
  }

  static getPregnancyChanceDescription(chance: string): string {
    switch (chance) {
      case 'High':
        return 'This is your fertile window when conception is most likely to occur. Ovulation typically happens during this time.';
      case 'Medium':
        return 'There is a moderate chance of conception during this time as you approach or move away from your fertile window.';
      case 'Low':
        return 'Conception is less likely during this time. This includes menstrual days and the later luteal phase of your cycle.';
      default:
        return '';
    }
  }

  static getPossibleSymptoms(phase: string): string {
    switch (phase) {
      case 'Menstrual':
        return 'Cramps, bloating, fatigue, headaches, mood swings, back pain, breast tenderness, and heavy or light bleeding.';
      case 'Follicular':
        return 'Increased energy, improved mood, clearer skin, higher motivation, and generally feeling more positive and active.';
      case 'Ovulatory':
        return 'Increased libido, mild pelvic pain, changes in cervical mucus, breast tenderness, and heightened energy levels.';
      case 'Luteal':
        return 'PMS symptoms including bloating, mood changes, irritability, food cravings, breast tenderness, fatigue, and acne.';
      case 'Extended':
        return 'Irregular symptoms may occur. You might experience fatigue, mood changes, or other cycle-related symptoms.';
      default:
        return '';
    }
  }

  static getCycleInfo(startDate: string, currentDate?: string, cycleLength?: number): CycleInfo {
    const cycleDay = this.getCurrentCycleDay(startDate, currentDate);
    const phase = this.getCyclePhase(cycleDay);
    
    return {
      phase,
      description: this.getPhaseDescription(phase),
      cycleDay,
      pregnancyChance: this.getPregnancyChance(cycleDay)
    };
  }
} 