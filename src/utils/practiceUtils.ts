// src/utils/practiceUtils.ts
import { Schedule, Lesson } from '../types';
import { addDays, isBefore, isSameDay, differenceInCalendarDays, parseISO, isAfter, isWithinInterval } from 'date-fns';

export interface CalendarEvent {
  title: string;
  code: string;
  type: 'holiday' | 'attestation' | 'gia' | 'practice';
  dateStart: string; // YYYY-MM-DD
  dateEnd: string;   // YYYY-MM-DD
  weeks_count: number;
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
  attestation: ['промежуточная аттестация', '::', ':'],
  practice: ['производственная практика', 'учебная практика', 'преддипломная практика', '0', '8', 'x', 'х'],
  holiday: ['каникулы', '='],
  gia: ['государственная итоговая аттестация', 'гиа', 'iii', 'подготовка к гиа', 'd', 'д'],
  session: ['сессия', 'экзамены']
};

function getLessonName(lesson: Lesson): string {
  if (lesson.commonLesson) return lesson.commonLesson.name;
  if (lesson.subgroupedLesson) return lesson.subgroupedLesson.name;
  return '';
}

export function findUpcomingEvent(
  events: CalendarEvent[], 
  currentDate: Date, // Дата, выбранная пользователем в календаре
  lookaheadDays: number = 7 
): PracticeInfo | null {
  if (!events || events.length === 0) return null;

  const realToday = new Date();
  realToday.setHours(0, 0, 0, 0);
  
  const selectedViewDate = new Date(currentDate);
  selectedViewDate.setHours(0, 0, 0, 0);

  // 1. Ищем ивент, который активен ИМЕННО на выбранную в календаре дату
  // Либо ивент, который начнется в течение 7 дней от ВЫБРАННОЙ даты
  const targetEvent = events.find(event => {
    const start = parseISO(event.dateStart);
    const end = parseISO(event.dateEnd);
    
    // Проверяем: выбранная дата внутри интервала события?
    const isVisibleOnThisDate = isWithinInterval(selectedViewDate, { start, end });
    
    // Или выбранная дата — это "предпросмотр" за неделю до начала?
    const diffToViewDate = differenceInCalendarDays(start, selectedViewDate);
    const isUpcomingForView = diffToViewDate > 0 && diffToViewDate <= lookaheadDays;

    return isVisibleOnThisDate || isUpcomingForView;
  });

  if (targetEvent) {
    const start = parseISO(targetEvent.dateStart);
    const end = parseISO(targetEvent.dateEnd);
    
    // 🔥 СТАТУС ВСЕГДА СЧИТАЕМ ОТ РЕАЛЬНОГО СЕГОДНЯ (27.12.2025)
    const isActiveRelativeToday = isWithinInterval(realToday, { start, end });
    const daysUntilRelativeToday = differenceInCalendarDays(start, realToday);

    // Если мы уже перешли на дату ПОСЛЕ окончания этого ивента (напр. 12.01), 
    // то этот ивент нам больше не подходит.
    if (isAfter(selectedViewDate, end)) return null;

    return {
      name: targetEvent.title,
      type: targetEvent.type as PracticeType,
      code: targetEvent.code || '',
      dateStart: start,
      dateEnd: end,
      returnDate: addDays(end, 1), 
      daysUntil: daysUntilRelativeToday,
      isActive: isActiveRelativeToday
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
  const realToday = new Date();
  realToday.setHours(0, 0, 0, 0);

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
          else if (KEYWORDS.holiday.some(k => lessonName.includes(k))) { foundType = 'holiday'; code = '='; }
          else if (KEYWORDS.gia.some(k => lessonName.includes(k))) { foundType = 'gia'; code = 'III'; }

          if (foundType) {
            const diffDays = differenceInCalendarDays(checkDate, realToday);
            if (diffDays <= 7) {
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