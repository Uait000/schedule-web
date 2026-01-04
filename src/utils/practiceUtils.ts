// src/utils/practiceUtils.ts
import { Schedule, Lesson } from '../types';
import { addDays, isBefore, isSameDay, differenceInCalendarDays, parseISO, isAfter, isWithinInterval, startOfDay } from 'date-fns';

export interface CalendarEvent {
  title: string;
  code: string;
  type: 'holiday' | 'attestation' | 'gia' | 'practice';
  dateStart: string; // YYYY-MM-DD
  dateEnd: string;   // YYYY-MM-DD
  weeks_count?: number;
}

export type PracticeType = 'practice' | 'attestation' | 'holiday' | 'gia' | 'session';

export interface PracticeInfo {
  name: string;
  type: PracticeType;
  code: string;
  dateStart: Date;
  dateEnd: Date | null;
  daysUntil: number; 
  isActive: boolean; 
  returnDate: Date | null;
}

const KEYWORDS = {
  attestation: ['промежуточная аттестация', '::', ':', 'экзамен'],
  practice: ['производственная практика', 'учебная практика', 'преддипломная практика', '0', '8', 'x', 'х', 'овс'],
  holiday: ['каникулы', '='],
  gia: ['государственная итоговая аттестация', 'гиа', 'iii', 'подготовка к гиа', 'd', 'д'],
};

function getLessonName(lesson: Lesson): string {
  if (lesson.commonLesson) return lesson.commonLesson.name;
  if (lesson.subgroupedLesson) return lesson.subgroupedLesson.name;
  return '';
}

export function findUpcomingEvent(
  events: CalendarEvent[], 
  currentDate: Date, 
  lookaheadDays: number = 7 
): PracticeInfo | null {
  if (!events || events.length === 0) return null;

  const realToday = startOfDay(new Date());
  const selectedViewDate = startOfDay(currentDate);

  // Ищем событие, которое охватывает выбранную дату или начнется скоро
  const targetEvent = events.find(event => {
    const start = startOfDay(parseISO(event.dateStart));
    const end = startOfDay(parseISO(event.dateEnd));
    
    const isVisibleOnThisDate = isWithinInterval(selectedViewDate, { start, end });
    const diffToViewDate = differenceInCalendarDays(start, selectedViewDate);
    const isUpcomingForView = diffToViewDate > 0 && diffToViewDate <= lookaheadDays;

    return isVisibleOnThisDate || isUpcomingForView;
  });

  if (targetEvent) {
    const start = startOfDay(parseISO(targetEvent.dateStart));
    const end = startOfDay(parseISO(targetEvent.dateEnd));
    
    return {
      name: targetEvent.title,
      type: targetEvent.type as PracticeType,
      code: targetEvent.code || '',
      dateStart: start,
      dateEnd: end,
      returnDate: addDays(end, 1), 
      daysUntil: differenceInCalendarDays(start, realToday),
      isActive: isWithinInterval(realToday, { start, end })
    };
  }

  return null;
}

export function findNextPractice(
  schedule: Schedule | null, 
  currentWeekIndex: number, 
  currentDate: Date
): PracticeInfo | null {
  if (!schedule || !schedule.weeks) return null;
  const realToday = startOfDay(new Date());

  for (let w = 0; w < 2; w++) {
    const targetWeekIndex = (currentWeekIndex + w) % 2;
    const weekData = schedule.weeks[targetWeekIndex];
    if (!weekData || !weekData.days) continue;

    for (let d = 0; d < weekData.days.length; d++) {
      const dayData = weekData.days[d];
      const checkDate = addDays(currentDate, (w * 7) + (d - (currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1)));
      
      if (isBefore(checkDate, realToday) && !isSameDay(checkDate, realToday)) continue;

      if (dayData.lessons) {
        for (const lesson of dayData.lessons) {
          if (!lesson) continue;
          const lessonName = getLessonName(lesson).toLowerCase();
          let foundType: PracticeType | null = null;
          let code = '';

          if (KEYWORDS.attestation.some(k => lessonName.includes(k))) { foundType = 'attestation'; code = '::'; }
          else if (lessonName.includes('учебная практика') || lessonName.includes(' 0')) { foundType = 'practice'; code = '0'; }
          else if (lessonName.includes('производственная') || lessonName.includes(' 8')) { foundType = 'practice'; code = '8'; }
          else if (lessonName.includes('преддипломная') || lessonName.includes(' x')) { foundType = 'practice'; code = 'X'; }
          else if (lessonName.includes('овс')) { foundType = 'practice'; code = 'ОВС'; }
          else if (KEYWORDS.holiday.some(k => lessonName.includes(k))) { foundType = 'holiday'; code = '='; }
          else if (KEYWORDS.gia.some(k => lessonName.includes(k))) { foundType = 'gia'; code = 'III'; }

          if (foundType) {
            const diffDays = differenceInCalendarDays(checkDate, realToday);
            if (diffDays <= 14) { // Увеличили окно поиска в расписании
               return {
                 name: getLessonName(lesson),
                 type: foundType,
                 code: code,
                 dateStart: checkDate,
                 dateEnd: null, 
                 returnDate: null,
                 daysUntil: diffDays,
                 isActive: isSameDay(checkDate, realToday)
               };
            }
          }
        }
      }
    }
  }
  return null;
}