import { useNavigate } from 'react-router-dom';
import ScheduleItem, { isLessonCurrent } from '../components/ScheduleItem';
import { NoteModal } from '../components/NoteModal';
import { AddCourseModal } from '../components/AddCourseModal';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { AllNotesModal } from '../components/AllNotesModal';
import { Schedule, OverridesResponse, Lesson, CalendarEvent } from '../types';
import { ProfileType } from '../types/profiles';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'; 
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  getDay, 
  startOfWeek, 
  addDays, 
  parseISO, 
  differenceInCalendarDays, 
  isWithinInterval, 
  startOfDay, 
  endOfDay,
  subDays
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { scheduleApi } from '../api/api'; 
import { useScheduleState } from '../hooks/useScheduleState';
import { getDayIndex, getWeekNumber } from '../utils/dateUtils';
import { useHistoryStorage } from '../hooks/useHistoryStorage';
import { HistoryModal } from '../components/HistoryModal';
import { dataStore } from '../utils/DataStore';
import { useAppTour } from '../hooks/useAppTour';
import { PracticeBanner } from '../components/PracticeBanner';
import { PracticeDetailsModal } from '../components/PracticeDetailsModal';
import { AllEventsModal } from '../components/AllEventsModal'; 
import { RateModal } from '../components/RateModal'; 
import { findNextPractice, findUpcomingEvent, PracticeInfo } from '../utils/practiceUtils';
import { SupportModal } from '../components/SupportModal'; 
import { AboutModal } from '../components/AboutModal';
import './Schedule.css';

const CURRENT_APP_VERSION = '5.0.1';

interface LessonData {
  notes: string;
  subgroup: number;
  lastUpdated?: number;
}

const DAYS_OF_WEEK = [ 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница' ];

// Глобальный перехват ошибок для очистки битого кэша чанков
if (typeof window !== 'undefined') {
  window.addEventListener('error', async (e) => {
    const target = e.target as any;
    if (target && target.tagName === 'SCRIPT' && target.src && target.src.includes('/assets/')) {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      window.location.reload();
    }
  }, true);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getCourseFromGroupName(groupName: string): number | null {
  if (!groupName) return null;
  const match = groupName.match(/-(\d)/);
  return match ? parseInt(match[1], 10) : null;
}

function groupSubgroups(lessons: any[], isTeacherView: boolean): any[] {
  if (!lessons || !Array.isArray(lessons) || lessons.length === 0) return lessons;
  
  const groupedLessons: any[] = [];
  const lessonNameMap = new Map<string, any>();

  lessons.forEach((lesson) => {
    // 🔥 Защита от null
    if (!lesson || lesson.noLesson) {
      groupedLessons.push(lesson || { noLesson: {} });
      return;
    }

    const lessonObj = lesson.commonLesson || lesson.subgroupedLesson;
    if (!lessonObj) {
      groupedLessons.push(lesson);
      return;
    }

    const lessonName = lessonObj.name;
    if (!lessonNameMap.has(lessonName)) {
      lessonNameMap.set(lessonName, {
        subgroupedLesson: {
          name: lessonName,
          subgroups: []
        }
      });
    }

    const currentGrouped = lessonNameMap.get(lessonName);
    
    if (lesson.commonLesson) {
      let subIdx = lesson.commonLesson.subgroup_index || 0;
      const exists = currentGrouped.subgroupedLesson.subgroups.some((s: any) => 
        (s.subgroup_index === subIdx && subIdx !== 0) && 
        s.teacher === lesson.commonLesson.teacher && 
        s.group === lesson.commonLesson.group
      );
      
      if (!exists) {
        currentGrouped.subgroupedLesson.subgroups.push({
          teacher: lesson.commonLesson.teacher || '',
          room: lesson.commonLesson.room || '',
          subgroup_index: subIdx,
          group: lesson.commonLesson.group || ''
        });
      }
    } else if (lesson.subgroupedLesson) {
      (lesson.subgroupedLesson.subgroups || []).forEach((sub: any) => {
        let subIdx = sub.subgroup_index || sub.subgroup || 0;
        currentGrouped.subgroupedLesson.subgroups.push({ ...sub, subgroup_index: subIdx });
      });
    }
  });

  lessonNameMap.forEach((grouped) => {
    if (grouped.subgroupedLesson.subgroups.length > 1) {
      grouped.subgroupedLesson.subgroups = grouped.subgroupedLesson.subgroups.map((s: any, i: number) => ({
        ...s,
        subgroup_index: s.subgroup_index || i + 1
      }));
      groupedLessons.push(grouped);
    } else {
      const single = grouped.subgroupedLesson.subgroups[0];
      if (single) {
          groupedLessons.push({
            commonLesson: {
              name: grouped.subgroupedLesson.name,
              teacher: single.teacher,
              room: single.room,
              group: single.group,
              subgroup_index: (single.subgroup_index === 0 || !single.subgroup_index) ? null : single.subgroup_index
            }
          });
      }
    }
  });

  return groupedLessons;
}

export function normalizeLesson(lesson: any): Lesson {
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }

  const findGroupAnywhere = (obj: any): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (typeof obj === 'string') return obj; 
    const candidates = ['group', 'Group', 'studentGroup', 'StudentGroup', 'className', 'targetGroup', 'target'];
    for (const key of candidates) {
        const val = obj[key];
        if (val) {
            if (typeof val === 'string' && val.trim().length > 0) return val;
            if (typeof val === 'object' && val.name) return val.name;
            if (typeof val === 'object' && val.group) return val.group;
        }
    }
    if (obj.CommonLesson) return findGroupAnywhere(obj.CommonLesson);
    if (obj.commonLesson) return findGroupAnywhere(obj.commonLesson);
    if (obj.willBe) return findGroupAnywhere(obj.willBe);
    return undefined;
  };

  const globalGroup = findGroupAnywhere(lesson);
  const common = lesson.CommonLesson || lesson.commonLesson;
  if (common) {
    const localGroup = findGroupAnywhere(common);
    return {
      commonLesson: {
        name: common.name || '',
        teacher: common.teacher || '',
        room: common.room || '',
        group: localGroup || globalGroup,
        subgroup_index: common.subgroup_index || common.subgroup || 0
      }
    };
  }

  const subgrouped = lesson.SubgroupedLesson || lesson.subgroupedLesson;
  if (subgrouped) {
    return {
      subgroupedLesson: {
        name: subgrouped.name || '',
        subgroups: (subgrouped.subgroups || []).map((sub: any) => {
          const subLocalGroup = findGroupAnywhere(sub);
          return {
            teacher: sub.teacher || '',
            room: sub.room || '',
            subgroup_index: sub.subgroup_index || sub.subgroup || 0,
            group: subLocalGroup || globalGroup 
          };
        })
      }
    };
  }
    
  if (lesson.name || lesson.teacher || lesson.room) {
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || globalGroup,
        subgroup_index: lesson.subgroup_index || lesson.subgroup || 0
      }
    };
  }
    
  return { noLesson: {} };
}

function getSavedLessonData(profileId: string, week: number, day: number, lesson: number): LessonData {
  const specificKey = `note_${profileId}_${week}_${day}_${lesson}`;
  const globalKey = `note_${week}_${day}_${lesson}`;
  try {
    let data = localStorage.getItem(specificKey);
    if (!data) { data = localStorage.getItem(globalKey); }
    return data ? JSON.parse(data) : { notes: '', subgroup: 0 };
  } catch (e) { return { notes: '', subgroup: 0 }; }
}

function saveLessonData(profileId: string, week: number, day: number, lesson: number, data: LessonData) {
  const key = `note_${profileId}_${week}_${day}_${lesson}`;
  localStorage.setItem(key, JSON.stringify(data));
}

const Icon = ({ name, style = {}, className = '' }: { name: string; style?: React.CSSProperties, className?: string }) => (
  <span 
    className={`material-icons ${className}`} 
    style={{ 
      fontSize: 'inherit', 
      verticalAlign: 'middle', 
      ...style 
    }}
  >
    {name}
  </span>
);

function CustomCalendar({ isOpen, onClose, onSelectDate, currentDate, calendarEvents }: { isOpen: boolean; onClose: () => void; onSelectDate: (date: Date) => void; currentDate: Date; calendarEvents: CalendarEvent[]; }) { 
  const [viewDate, setViewDate] = useState(currentDate); 
  const [dateInput, setDateInput] = useState(format(currentDate, 'dd.MM.yyyy')); 
  const [isValid, setIsValid] = useState(true); 
   
  if (!isOpen) return null; 
   
  const monthStart = startOfMonth(viewDate); 
  const monthEnd = endOfMonth(viewDate); 
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }); 
  const firstDayOfMonth = getDay(monthStart); 
  const startPadding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
   
  const isDateHoliday = (date: Date) => {
    return (calendarEvents || []).some(event => {
      if (event.type !== 'holiday') return false;
      const start = startOfDay(parseISO(event.dateStart));
      const end = endOfDay(parseISO(event.dateEnd));
      return isWithinInterval(date, { start, end });
    });
  };

  const handleDayClick = (date: Date) => { 
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0 || dayOfWeek === 6 || isDateHoliday(date)) return; 

    onSelectDate(date); 
    setDateInput(format(date, 'dd.MM.yyyy')); 
    onClose(); 
  }; 
   
  const handleTodayClick = () => { 
    const today = new Date(); 
    setViewDate(today); 
    setDateInput(format(today, 'dd.MM.yyyy')); 
    onSelectDate(today); 
    onClose(); 
  }; 
   
  const handleDateInputChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const value = event.target.value; 
    let formattedValue = value.replace(/\D/g, ''); 
    if (formattedValue.length > 2) { 
      formattedValue = formattedValue.slice(0, 2) + '.' + formattedValue.slice(2); 
    } 
    if (formattedValue.length > 5) { 
      formattedValue = formattedValue.slice(0, 5) + '.' + formattedValue.slice(5, 9); 
    } 
    setDateInput(formattedValue); 
    const dateParts = formattedValue.split('.'); 
    if (dateParts.length === 3 && formattedValue.length === 10) { 
      const day = parseInt(dateParts[0]); 
      const month = parseInt(dateParts[1]) - 1; 
      const year = parseInt(dateParts[2]); 
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2100) { 
        const newDate = new Date(year, month, day); 
        if (!isNaN(newDate.getTime()) && newDate.getDate() === day && newDate.getMonth() === month && newDate.getFullYear() === year) { 
          setIsValid(true); 
          setViewDate(newDate); 
          onSelectDate(newDate); 
          onClose(); 
        } else { setIsValid(false); } 
      } else { setIsValid(false); } 
    } else { setIsValid(true); } 
  }; 
   
  const handleKeyDown = (event: React.KeyboardEvent) => { 
    if (event.key === 'Enter' && isValid && dateInput.length === 10) { 
      const dateParts = dateInput.split('.'); 
      const day = parseInt(dateParts[0]); 
      const month = parseInt(dateParts[1]) - 1; 
      const year = parseInt(dateParts[2]); 
      const newDate = new Date(year, month, day); 
      if (!isNaN(newDate.getTime())) { 
        setViewDate(newDate); 
        onSelectDate(newDate); 
        onClose(); 
      } 
    } 
  }; 
   
  return ( 
    <div className="calendar-backdrop" onClick={onClose}> 
      <div className="calendar-modal-modern" onClick={(e) => e.stopPropagation()}> 
        <div className="calendar-header-modern"> 
          <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="calendar-nav-btn"><Icon name="chevron_left" /></button> 
          <span className="calendar-month-year">{format(viewDate, 'LLLL yyyy', { locale: ru })}</span> 
          <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="calendar-nav-btn"><Icon name="chevron_right" /></button> 
        </div> 
           
        <div className="calendar-input-section"> 
          <div className="input-modern-wrapper">
             <Icon name="edit_calendar" style={{ opacity: 0.5, marginRight: '8px' }} />
             <input 
              type="text" 
              value={dateInput} 
              onChange={handleDateInputChange} 
              onKeyDown={handleKeyDown} 
              placeholder="дд.мм.гггг" 
            /> 
          </div>
          {!isValid && <div className="calendar-error-text">Неверная дата</div>} 
        </div> 

        <div className="calendar-weekdays-modern">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (<div key={day} className="calendar-weekday">{day}</div>))}
        </div> 

        <div className="calendar-days-modern"> 
          {Array.from({ length: startPadding }).map((_, i) => (<div key={`empty-${i}`} className="calendar-day empty"></div>))} 
          {days.map((day) => {
            const dayOfWeek = getDay(day);
            const isHoliday = isDateHoliday(day);
            const isDisabled = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;
            const isSelected = isSameDay(day, currentDate);
            const isToday = isSameDay(day, new Date());
             
            return ( 
              <button 
                key={day.toString()} 
                className={`calendar-day-modern ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`} 
                onClick={() => handleDayClick(day)} 
                disabled={isDisabled}
                title={isHoliday ? 'Каникулы' : format(day, 'd MMMM yyyy', { locale: ru })}
              >
                <span className="day-text">{format(day, 'd')}</span>
              </button> 
            );
          })} 
        </div> 

        <div className="calendar-footer-modern"> 
          <button onClick={onClose} className="calendar-btn-secondary"><Icon name="close" />Закрыть</button> 
          <button onClick={handleTodayClick} className="calendar-btn-primary"><Icon name="today" />Сегодня</button> 
        </div> 
      </div> 
    </div> 
  ); 
}

function DropdownMenu({ 
  isOpen, 
  onClose, 
  onCheckOverrides, 
  onAddCourse, 
  onInstallApp,
  onOpenAllEvents,
  onStartTour,
  onRateApp,
  onSupport,
  isTeacher,
  onOpenMonitoring,
  onOpenAbout,
  onShare
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCheckOverrides: () => void; 
  onAddCourse: () => void; 
  onInstallApp: () => void;
  onOpenAllEvents: () => void;
  onStartTour: () => void;
  onRateApp: () => void; 
  onSupport: () => void;
  isTeacher: boolean;
  onOpenMonitoring: () => void;
  onOpenAbout: () => void;
  onShare: () => void;
}) { 
  const navigate = useNavigate(); 
   
  if (!isOpen) return null; 
   
  const handleMenuClick = (action: string) => { 
    if (action !== 'help' && action !== 'install') onClose();
     
    if (action === 'overrides') { onCheckOverrides(); } 
    else if (action === 'addCourse') { onAddCourse(); } 
    else if (action === 'install') { onInstallApp(); } 
    else if (action === 'allEvents') { onOpenAllEvents(); }
    else if (action === 'monitoring') { onOpenMonitoring(); }
    else if (action === 'support') { onSupport(); } 
    else if (action === 'about') { onOpenAbout(); }
    else if (action === 'rate') { onRateApp(); } 
    else if (action === 'share') { onShare(); }
    else if (action === 'changeGroup') { 
      localStorage.removeItem('selectedId'); 
      localStorage.removeItem('userType'); 
      navigate('/', { replace: true }); 
    } else if (action === 'help') { onStartTour(); } 
  }; 
   
  return ( 
    <>
        <div className="dropdown-overlay" onClick={onClose} />
        <div className="dropdown-menu-attached" onClick={(e) => e.stopPropagation()}> 
            <button className="dropdown-item" onClick={() => handleMenuClick('overrides')}>
              <Icon name="sync_alt" /><span>Проверить изменения</span>
            </button> 

            {isTeacher && (
              <button className="dropdown-item" onClick={() => handleMenuClick('monitoring')}>
                <Icon name="visibility" /><span>Свободные пары у групп</span>
              </button>
            )}

            <button className="dropdown-item" onClick={() => handleMenuClick('allEvents')}>
              <Icon name="event_repeat" /><span>График событий</span>
            </button> 

            <button className="dropdown-item" onClick={() => handleMenuClick('addCourse')}>
              <Icon name="add_circle" /><span>Добавить курсы</span>
            </button> 

            <button className="dropdown-item" onClick={() => handleMenuClick('install')}>
              <Icon name="download" /><span>Установить приложение</span>
            </button> 

            <button className="dropdown-item" onClick={() => handleMenuClick('share')}>
              <Icon name="share" /><span>Поделиться</span>
            </button> 

            <button className="dropdown-item" onClick={() => handleMenuClick('changeGroup')}>
              <Icon name="group" /><span>Поменять группу</span>
            </button> 
            
            <button className="dropdown-item" onClick={() => handleMenuClick('support')}>
              <Icon name="contact_support" />
              <span>Техподдержка</span>
            </button> 

            <button className="dropdown-item" onClick={() => handleMenuClick('about')}>
              <Icon name="info" />
              <span>О приложении</span>
            </button>
        </div> 
    </>
  ); 
}

function TeacherMonitoringModal({ 
  isOpen, 
  onClose, 
  teacherSchedule, 
  initialDate
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  teacherSchedule: Schedule | null; 
  initialDate: Date;
}) {
  const [loading, setLoading] = useState(false);
  const [groupsData, setGroupsData] = useState<Record<string, Lesson[]>>({});
  const [viewDate, setViewDate] = useState(initialDate);

const uniqueGroups = useMemo(() => {
    if (!teacherSchedule || !teacherSchedule.weeks) return [];
    
    const groups = new Set<string>();
    
    teacherSchedule.weeks.forEach(week => {
      if (!week || !week.days) return; 
      
      week.days.forEach(day => {
        if (!day || !day.lessons) return; 
        
        day.lessons.forEach((lesson: any) => {
          if (lesson?.commonLesson?.group) {
            groups.add(lesson.commonLesson.group);
          }
          if (lesson?.subgroupedLesson?.subgroups) {
            lesson.subgroupedLesson.subgroups.forEach((s: any) => {
              if (s.group) groups.add(s.group);
            });
          }
        });
      });
    });
    
    return Array.from(groups).sort();
  }, [teacherSchedule]);

  const loadMonitoringData = useCallback(async () => {
    setLoading(true);
    const results: Record<string, Lesson[]> = {};
    const formattedDate = format(viewDate, 'yyyy-MM-dd');
    const targetDayIdx = getDayIndex(viewDate);
    const currentWeekNum = getWeekNumber(viewDate);

    try {
      await Promise.all(uniqueGroups.map(async (groupName) => {
        try {
          const data = await scheduleApi.getInfo(groupName, formattedDate, 0, "");
          if (data && data.schedule) {
            const weekData = data.schedule.weeks[currentWeekNum % 2];
            const baseLessons = weekData?.days?.[targetDayIdx]?.lessons || [];
            
            const overridesList = data.overrides?.overrides || [];
            const processedLessons = [...baseLessons];
            
            overridesList.forEach((ov: any) => {
              if (processedLessons[ov.index]) {
                processedLessons[ov.index] = normalizeLesson(ov.willBe);
              }
            });
            
            results[groupName] = processedLessons;
          }
        } catch (err) {
          results[groupName] = [];
        }
      }));
      setGroupsData(results);
    } finally {
      setLoading(false);
    }
  }, [uniqueGroups, viewDate]);

  useEffect(() => {
    if (isOpen && uniqueGroups.length > 0) {
      loadMonitoringData();
    }
  }, [isOpen, uniqueGroups, loadMonitoringData]);

  const handleDayShift = (direction: 'prev' | 'next') => {
    let nextDate = direction === 'next' ? addDays(viewDate, 1) : subDays(viewDate, 1);
    const day = getDay(nextDate);
    
    if (day === 0) nextDate = direction === 'next' ? addDays(nextDate, 1) : subDays(nextDate, 2);
    if (day === 6) nextDate = direction === 'next' ? addDays(nextDate, 2) : subDays(nextDate, 1);
    
    setViewDate(nextDate);
  };

  if (!isOpen) return null;

  const lessonSlots = [0, 1, 2, 3, 4];

  return createPortal(
    <div className="monitoring-overlay" onClick={onClose}>
      <div className="monitoring-card" onClick={e => e.stopPropagation()}>
        <div className="monitoring-header">
          <div className="monitoring-nav">
             <button onClick={() => handleDayShift('prev')} className="nav-arrow active"><Icon name="chevron_left" /></button>
             <div className="nav-title">
               <h3>Занятость групп</h3>
               <p>{format(viewDate, 'd MMMM, EEEE', { locale: ru })}</p>
             </div>
             <button onClick={() => handleDayShift('next')} className="nav-arrow active"><Icon name="chevron_right" /></button>
          </div>
        </div>

        <div className="monitoring-body">
          {loading ? (
            <div className="monitoring-loader">Загрузка данных групп...</div>
          ) : (
            <div className="monitoring-table-wrapper">
              <table className="monitoring-table">
                <thead>
                  <tr>
                    <th className="sticky-header">ГРУППА</th>
                    {lessonSlots.map(n => <th key={n} className="sticky-header">{n + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {uniqueGroups.map(group => (
                    <tr key={group}>
                      <td className="group-name-cell">{group}</td>
                      {lessonSlots.map((idx) => {
                        const lessons = groupsData[group] || [];
                        const lesson = lessons[idx];
                        const isFree = !lesson || lesson.noLesson || (Object.keys(lesson).length === 1 && lesson.noLesson);
                        return (
                          <td key={idx} className={`slot-cell ${isFree ? 'free' : 'busy'}`}>
                            {isFree ? 'Окно' : 'Пара'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <button className="monitoring-close-btn" onClick={onClose}>Вернуться</button>
      </div>
    </div>,
    document.body
  );
}

function Snackbar({ message, isVisible, onClose, link, linkText }: { message: string; isVisible: boolean; onClose: () => void; link?: string | null; linkText?: string; }) {
  useEffect(() => { 
    if (isVisible) { 
      const timer = setTimeout(() => { onClose(); }, 7000); 
      return () => clearTimeout(timer); 
    } 
  }, [isVisible, onClose]); 
   
  if (!isVisible) return null; 
   
  const handleLinkClick = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (link) { window.open(link, '_blank'); } 
    onClose(); 
  };
  const handleContainerClick = () => { onClose(); };
   
  return ( 
    <div 
      className="modern-snackbar"
      onClick={handleContainerClick}
    > 
      <div className="snackbar-left-border"></div>
      <div className="snackbar-content">
        <div className="snackbar-icon-area">
          <Icon name="cloud_sync" style={{ fontSize: '22px', color: '#fff' }} />
        </div>
        <div className="snackbar-text-area">
            <div className="snackbar-title">Уведомление</div>
            <div className="snackbar-text-area">
                <div className="snackbar-message">{message}</div>
            </div>
        </div>
      </div>
      {link && (
        <div className="snackbar-actions">
          <button onClick={handleLinkClick} className="snackbar-btn">
            {linkText || 'Перейти'} <Icon name="arrow_forward" style={{ fontSize: '16px', marginLeft: '6px' }} />
          </button>
        </div>
      )}
    </div> 
  ); 
}

// ==========================================
// OVERRIDE PROCESSING HELPERS
// ==========================================

/** Extract teacher last name (first word) for matching */
function getTeacherLastName(teacher: string): string {
  return (teacher || "").split(' ')[0].trim().toLowerCase();
}

/** Check if a lesson/subgroup is cancelled based on various indicators */
function isLessonCancelled(data: any): boolean {
  if (!data) return false;
  if (data.noLesson) return true;
  
  const teacher = (data.teacher || "").toLowerCase().trim();
  const room = (data.room || "").toLowerCase().trim();
  const group = (data.group || "").toLowerCase().trim();
  
  // Various cancellation indicators
  const cancelIndicators = ['нет', 'null', 'снят', 'снята', 'снято', 'отмена', 'отменено', ''];
  
  if (cancelIndicators.includes(teacher)) return true;
  if (teacher.includes('снят') || teacher.includes('отмен')) return true;
  if (room === 'нет' || room === 'null' || room.includes('снят')) return true;
  if (group === 'нет' || group === 'null') return true;
  
  return false;
}

/** Check if an override represents a cancellation */
function isOverrideCancellation(willBe: Lesson): boolean {
  if (willBe === null || willBe === undefined) return true;
  if (willBe.noLesson) return true;
  
  if (willBe.commonLesson) {
    const teacher = (willBe.commonLesson.teacher || "").toLowerCase();
    if (teacher === 'нет' || teacher.includes('снят') || teacher.includes('отмен')) return true;
    if (isLessonCancelled(willBe.commonLesson)) return true;
  }
  
  if (willBe.subgroupedLesson?.subgroups) {
    const allCancelled = willBe.subgroupedLesson.subgroups.every(s => isLessonCancelled(s));
    if (allCancelled) return true;
  }
  
  return false;
}

/** Deduplicate subgroups by teacher last name + group */
function deduplicateSubgroups(subgroups: any[]): any[] {
  const seen = new Map<string, any>();
  
  for (const sub of subgroups) {
    if (isLessonCancelled(sub)) continue;
    
    const key = `${getTeacherLastName(sub.teacher)}_${sub.group || ""}`;
    if (!seen.has(key)) {
      seen.set(key, { ...sub });
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Smart merge of override into base lesson.
 * Handles all scenarios:
 * 1. Full cancellation → noLesson
 * 2. Partial cancellation (one subgroup) → keep the other
 * 3. Teacher replacement → swap in correct subgroup
 * 4. Combined groups → merge groups for teacher
 * 5. Duplicate teachers → deduplicate
 */
function applyOverrideToLesson(
  baseLesson: Lesson,
  willBe: Lesson,
  shouldBe: Lesson,
  isTeacherView: boolean
): Lesson {
  console.log('[OVERRIDE] applyOverrideToLesson:', {
    baseType: baseLesson?.commonLesson ? 'common' : baseLesson?.subgroupedLesson ? 'subgrouped' : baseLesson?.noLesson ? 'noLesson' : baseLesson === null ? 'null' : 'unknown',
    willBeType: willBe?.commonLesson ? 'common' : willBe?.subgroupedLesson ? 'subgrouped' : willBe?.noLesson ? 'noLesson' : willBe === null ? 'null' : 'unknown',
    shouldBeType: shouldBe?.commonLesson ? 'common' : shouldBe?.subgroupedLesson ? 'subgrouped' : shouldBe?.noLesson ? 'noLesson' : shouldBe === null ? 'null' : 'unknown',
    isTeacherView,
    subgroupCount: baseLesson?.subgroupedLesson?.subgroups?.length || 0,
    willBeSubgroupIndex: willBe?.commonLesson?.subgroup_index
  });
  // If base is empty, just return willBe (or noLesson if cancelled)
  if (!baseLesson || baseLesson.noLesson) {
    if (isOverrideCancellation(willBe)) return { noLesson: {} };
    return willBe;
  }
  
  // ==========================================
  // SCENARIO 0: TOTAL REPLACEMENT
  // willBe.commonLesson with subgroup_index: null means "replace ENTIRE lesson"
  // This must be checked FIRST before any mixed-type logic
  // ==========================================
  if (willBe?.commonLesson && (!willBe.commonLesson.subgroup_index || willBe.commonLesson.subgroup_index === 0 || willBe.commonLesson.subgroup_index === null)) {
    return {
      commonLesson: {
        name: willBe.commonLesson.name,
        teacher: willBe.commonLesson.teacher,
        room: willBe.commonLesson.room,
        group: willBe.commonLesson.group || (baseLesson.commonLesson?.group || baseLesson.subgroupedLesson?.subgroups?.[0]?.group),
        subgroup_index: null
      }
    };
  }
  
  // ==========================================
  // SCENARIO: Cancellation
  // ==========================================
  if (isOverrideCancellation(willBe)) {
    // Teacher view: cancel entirely
    if (isTeacherView) {
      console.log('[OVERRIDE] Teacher view — cancel entire lesson');
      return { noLesson: {} };
    }
    
    // Determine WHAT to cancel:
    const cancelSubgroupIndex = shouldBe?.commonLesson?.subgroup_index;
    const teacherToCancel = getTeacherLastName(
      shouldBe?.commonLesson?.teacher || ""
    );
    
    console.log('[OVERRIDE] Cancellation:', { cancelSubgroupIndex, teacherToCancel, baseHasSubgroups: !!baseLesson?.subgroupedLesson?.subgroups });
    
    // If base has subgroups, try to filter out only the cancelled one
    if (baseLesson.subgroupedLesson?.subgroups) {
      const remaining = baseLesson.subgroupedLesson.subgroups.filter(s => {
        // PRIORITY 1: Match by teacher name (most reliable)
        if (teacherToCancel) {
          return getTeacherLastName(s.teacher) !== teacherToCancel;
        }
        // PRIORITY 2: Match by subgroup_index (fallback)
        if (cancelSubgroupIndex && cancelSubgroupIndex > 0) {
          return (s.subgroup_index || 0) !== cancelSubgroupIndex;
        }
        // No match criteria — keep all
        return true;
      });
      
      console.log('[OVERRIDE] Remaining subgroups:', remaining.length, remaining.map(s => s.teacher));
      
      // Nothing was filtered — return original lesson
      if (remaining.length === baseLesson.subgroupedLesson.subgroups.length) {
        return baseLesson;
      }
      if (remaining.length === 0) return { noLesson: {} };
      if (remaining.length === 1) {
        return {
          commonLesson: {
            name: baseLesson.subgroupedLesson.name,
            teacher: remaining[0].teacher,
            room: remaining[0].room,
            group: remaining[0].group,
            subgroup_index: null
          }
        };
      }
      return {
        subgroupedLesson: {
          name: baseLesson.subgroupedLesson.name,
          subgroups: remaining
        }
      };
    }
    
    // Base is common lesson - check if it matches the cancelled teacher
    if (baseLesson.commonLesson) {
      if (teacherToCancel && getTeacherLastName(baseLesson.commonLesson.teacher) === teacherToCancel) {
        return { noLesson: {} };
      }
    }
    
    return { noLesson: {} };
  }
  
  // ==========================================
  // SCENARIO: Full replacement (commonLesson → commonLesson)
  // ==========================================
  if (willBe.commonLesson && baseLesson.commonLesson) {
    const willBeSubgroup = willBe.commonLesson.subgroup_index;
    
    // willBe targets a specific subgroup - replace that one
    return {
      commonLesson: {
        name: willBe.commonLesson.name || baseLesson.commonLesson.name,
        teacher: willBe.commonLesson.teacher,
        room: willBe.commonLesson.room,
        group: willBe.commonLesson.group || baseLesson.commonLesson.group,
        subgroup_index: willBeSubgroup
      }
    };
  }
  
  // ==========================================
  // SCENARIO: Subgrouped replacement (subgroupedLesson → subgroupedLesson)
  // ==========================================
  if (willBe.subgroupedLesson && baseLesson.subgroupedLesson) {
    const willBeSubgroups = willBe.subgroupedLesson.subgroups || [];
    const baseSubgroups = [...(baseLesson.subgroupedLesson.subgroups || [])];
    
    // Process each willBe subgroup
    for (const wSub of willBeSubgroups) {
      if (isLessonCancelled(wSub)) {
        // Remove matching subgroup from base
        const idx = baseSubgroups.findIndex(s => 
          (s.subgroup_index || 0) === (wSub.subgroup_index || 0)
        );
        if (idx !== -1) baseSubgroups.splice(idx, 1);
      } else {
        // Replace or add subgroup
        const existingIdx = baseSubgroups.findIndex(s => 
          (s.subgroup_index || 0) === (wSub.subgroup_index || 0)
        );
        if (existingIdx !== -1) {
          baseSubgroups[existingIdx] = { ...wSub };
        } else {
          baseSubgroups.push({ ...wSub });
        }
      }
    }
    
    if (baseSubgroups.length === 0) return { noLesson: {} };
    
    // Deduplicate by teacher
    const deduped = deduplicateSubgroups(baseSubgroups);
    
    if (deduped.length === 0) return { noLesson: {} };
    if (deduped.length === 1) {
      return {
        commonLesson: {
          name: willBe.subgroupedLesson.name || baseLesson.subgroupedLesson.name,
          teacher: deduped[0].teacher,
          room: deduped[0].room,
          group: deduped[0].group,
          subgroup_index: null
        }
      };
    }
    
    return {
      subgroupedLesson: {
        name: willBe.subgroupedLesson.name || baseLesson.subgroupedLesson.name,
        subgroups: deduped.map((s, i) => ({ ...s, subgroup_index: i + 1 }))
      }
    };
  }
  
  // ==========================================
  // SCENARIO: Mixed (common → subgrouped or vice versa)
  // ==========================================
  if (willBe.commonLesson && baseLesson.subgroupedLesson) {
    const teacherToReplace = getTeacherLastName(
      shouldBe?.commonLesson?.teacher || 
      shouldBe?.subgroupedLesson?.subgroups?.[0]?.teacher || ""
    );
    
    // Find and replace the matching subgroup
    const remaining = baseLesson.subgroupedLesson.subgroups.filter(s => 
      getTeacherLastName(s.teacher) !== teacherToReplace
    );
    
    // Add the new teacher
    remaining.push({
      teacher: willBe.commonLesson.teacher,
      room: willBe.commonLesson.room,
      group: willBe.commonLesson.group,
      subgroup_index: willBe.commonLesson.subgroup_index || remaining.length + 1
    });
    
    const deduped = deduplicateSubgroups(remaining);
    
    if (deduped.length === 0) return { noLesson: {} };
    if (deduped.length === 1) {
      return {
        commonLesson: {
          name: willBe.commonLesson.name || baseLesson.subgroupedLesson.name,
          teacher: deduped[0].teacher,
          room: deduped[0].room,
          group: deduped[0].group,
          subgroup_index: null
        }
      };
    }
    
    return {
      subgroupedLesson: {
        name: willBe.commonLesson.name || baseLesson.subgroupedLesson.name,
        subgroups: deduped.map((s, i) => ({ ...s, subgroup_index: i + 1 }))
      }
    };
  }
  
  if (willBe.subgroupedLesson && baseLesson.commonLesson) {
    const willBeSubs = willBe.subgroupedLesson.subgroups || [];
    const combined = [
      { ...baseLesson.commonLesson, subgroup_index: baseLesson.commonLesson.subgroup_index || 1 },
      ...willBeSubs.map(s => ({ ...s, subgroup_index: s.subgroup_index || 2 }))
    ];
    
    const deduped = deduplicateSubgroups(combined);
    
    if (deduped.length === 0) return { noLesson: {} };
    if (deduped.length === 1) {
      return {
        commonLesson: {
          name: willBe.subgroupedLesson.name || baseLesson.commonLesson.name,
          teacher: deduped[0].teacher,
          room: deduped[0].room,
          group: deduped[0].group,
          subgroup_index: null
        }
      };
    }
    
    return {
      subgroupedLesson: {
        name: willBe.subgroupedLesson.name || baseLesson.commonLesson.name,
        subgroups: deduped.map((s, i) => ({ ...s, subgroup_index: i + 1 }))
      }
    };
  }
  
  // Fallback: return willBe as-is
  console.log('[OVERRIDE] Fallback: returning willBe as-is');
  return willBe;
}

// ==========================================
// SHARE MODAL COMPONENT
// ==========================================

function ShareModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const WEB_URL = 'https://schedulettgt-static.website.yandexcloud.net/';
  const ANDROID_URL = 'https://schedulettgt.ru/schedule/android/download';
  const [activeTab, setActiveTab] = useState<'web' | 'android'>('web');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = activeTab === 'web' ? WEB_URL : ANDROID_URL;
  const qrColor = activeTab === 'web' ? '6650a4' : '4CAF50';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch {
      const input = document.createElement('input');
      input.value = currentUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Расписание ТТЖТ',
          text: activeTab === 'web' ? 'Открой расписание ТТЖТ в браузере' : 'Скачай приложение ТТЖТ на Android',
          url: currentUrl
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        
        {/* Handle */}
        <div className="share-handle" />

        {/* Header */}
        <div className="share-header">
          <div className="share-icon-box">
            <span className="material-icons">share</span>
          </div>
          <h3>Поделиться</h3>
        </div>

        {/* Tabs */}
        <div className="share-tabs">
          <button 
            className={`share-tab ${activeTab === 'web' ? 'active' : ''}`}
            onClick={() => { setActiveTab('web'); setCopied(false); }}
          >
            <span className="material-icons">language</span>
            Веб-версия
          </button>
          <button 
            className={`share-tab ${activeTab === 'android' ? 'active' : ''}`}
            onClick={() => { setActiveTab('android'); setCopied(false); }}
          >
            <span className="material-icons">android</span>
            Android
          </button>
        </div>

        {/* Content */}
        <div className="share-content">
          {activeTab === 'web' ? (
            <div className="share-tab-content">
              <div className="share-qr-wrap">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(WEB_URL)}&bgcolor=ffffff&color=6650a4`} 
                  alt="QR Code веб-версии" 
                  width="180" 
                  height="180"
                />
              </div>
              <div className="share-link-box">
                <span className="share-link-text">{WEB_URL}</span>
              </div>
              <p className="share-hint">
                Отсканируйте QR-код камерой телефона, чтобы открыть расписание в браузере
              </p>
            </div>
          ) : (
            <div className="share-tab-content">
              <div className="share-qr-wrap android">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ANDROID_URL)}&bgcolor=ffffff&color=4CAF50`} 
                  alt="QR Code Android приложения" 
                  width="180" 
                  height="180"
                />
              </div>
              <div className="share-link-box">
                <span className="share-link-text">{ANDROID_URL}</span>
              </div>
              <p className="share-hint">
                Отсканируйте QR-код для скачивания APK-файла
              </p>
              <div className="share-warning">
                <span className="material-icons">info</span>
                <span>Приложение доступно только для Android. На iPhone/iPad работать не будет</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="share-actions">
          {navigator.share && (
            <button className="share-action-btn primary" onClick={handleNativeShare}>
              <span className="material-icons">ios_share</span>
              Поделиться
            </button>
          )}
          <button className="share-action-btn secondary" onClick={handleCopyLink}>
            <span className="material-icons">{copied ? 'check_circle' : 'content_copy'}</span>
            {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </button>
        </div>

        {/* Close */}
        <button className="share-close-btn" onClick={onClose}>Закрыть</button>
      </div>

      <style>{`
        .share-overlay {
          position: fixed; inset: 0; 
          background: rgba(0,0,0,0.7); 
          backdrop-filter: blur(8px); 
          display: flex; align-items: flex-end; justify-content: center; 
          z-index: 10000; 
          animation: fadeIn 0.2s ease;
        }
        .share-modal {
          background: var(--color-surface, #1e1e1e); 
          width: 100%; max-width: 480px; 
          border-radius: 28px 28px 0 0; 
          padding: 0 24px env(safe-area-inset-bottom, 24px); 
          animation: slideUp 0.3s ease;
          max-height: 90vh; overflow-y: auto;
        }
        .share-handle {
          width: 40px; height: 4px; 
          background: var(--color-border, #444); 
          border-radius: 2px; 
          margin: 16px auto 20px;
        }

        /* Header */
        .share-header {
          display: flex; align-items: center; gap: 16px; 
          margin-bottom: 24px;
        }
        .share-icon-box {
          width: 48px; height: 48px; 
          background: linear-gradient(135deg, var(--color-primary, #6650a4), #7c5ac4); 
          border-radius: 14px; 
          display: flex; align-items: center; justify-content: center; 
          color: white; flex-shrink: 0;
        }
        .share-icon-box span { font-size: 24px; }
        .share-header h3 {
          margin: 0; font-size: 24px; font-weight: 800; 
          color: var(--color-text, #fff);
        }

        /* Tabs */
        .share-tabs {
          display: flex; gap: 8px; 
          background: var(--color-surface-container, #2a2a2a); 
          border-radius: 14px; padding: 4px; 
          margin-bottom: 24px;
        }
        .share-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 16px; border: none; border-radius: 12px;
          background: transparent; color: var(--color-secondary-text, #999);
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: all 0.2s ease;
        }
        .share-tab span { font-size: 20px; }
        .share-tab.active {
          background: var(--color-primary, #6650a4); color: white;
          box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
        }
        .share-tab:not(.active):hover {
          background: rgba(255,255,255,0.05);
        }

        /* Content */
        .share-tab-content {
          display: flex; flex-direction: column; align-items: center; gap: 20px;
        }
        .share-qr-wrap {
          background: white; border-radius: 20px; padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .share-qr-wrap.android { box-shadow: 0 4px 20px rgba(76, 175, 80, 0.2); }
        .share-qr-wrap img { display: block; border-radius: 8px; }

        .share-link-box {
          width: 100%; padding: 14px 16px;
          background: var(--color-surface-container, #2a2a2a);
          border-radius: 12px; text-align: center;
          border: 1px solid var(--color-border, #333);
        }
        .share-link-text {
          font-size: 13px; font-weight: 600; 
          color: var(--color-secondary-text, #aaa);
          word-break: break-all;
          font-family: 'SF Mono', 'Consolas', monospace;
        }

        .share-hint {
          margin: 0; font-size: 15px; font-weight: 500;
          color: var(--color-secondary-text, #999);
          text-align: center; line-height: 1.5;
        }

        .share-warning {
          width: 100%; display: flex; align-items: flex-start; gap: 12px;
          padding: 16px; background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
          border-radius: 14px;
        }
        .share-warning span:first-child {
          color: #FF9800; font-size: 22px; flex-shrink: 0; margin-top: 1px;
        }
        .share-warning span:last-child {
          font-size: 14px; font-weight: 600; color: #FFB74D; line-height: 1.4;
        }

        /* Actions */
        .share-actions {
          display: flex; gap: 12px; margin: 24px 0 16px;
        }
        .share-action-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 18px 16px; border: none; border-radius: 16px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          transition: all 0.2s ease;
        }
        .share-action-btn span { font-size: 22px; }
        .share-action-btn.primary {
          background: var(--color-primary, #6650a4); color: white;
        }
        .share-action-btn.primary:hover { box-shadow: 0 4px 16px rgba(103, 58, 183, 0.4); }
        .share-action-btn.secondary {
          background: var(--color-surface-container, #2a2a2a); 
          color: var(--color-text, #fff);
          border: 1px solid var(--color-border, #333);
        }
        .share-action-btn.secondary:hover { background: var(--color-surface-hover, #333); }

        .share-close-btn {
          width: 100%; padding: 16px; border: none;
          background: transparent; color: var(--color-secondary-text, #888);
          font-size: 15px; font-weight: 600; cursor: pointer;
          border-radius: 12px; margin-bottom: 8px;
        }
        .share-close-btn:hover { background: var(--color-surface-container, #2a2a2a); }

        @media (prefers-color-scheme: light) {
          .share-modal { background: #ffffff; }
          .share-tabs { background: #f0f0f0; }
          .share-tab:not(.active) { color: #666; }
          .share-link-box { background: #f8f9fa; border-color: #eee; }
          .share-link-text { color: #666; }
          .share-hint { color: #666; }
          .share-action-btn.secondary { background: #f0f0f0; color: #333; border-color: #ddd; }
          .share-close-btn { color: #888; }
          .share-close-btn:hover { background: #f0f0f0; }
        }
      `}</style>
    </div>
  );
}

export function ScheduleScreen() {
  const navigate = useNavigate();
  const scheduleListRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
   
  const { activeDayIndex, setActiveDayIndex, activeWeekIndex, setActiveWeekIndex, applyOverrides, setApplyOverrides, selectedDate, setSelectedDate, resetToToday } = useScheduleState();
   
  const [appState, setAppState] = useState(() => dataStore.getState());

  // Online/Offline tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [fullSchedule, setFullSchedule] = useState<Schedule | null>(() => {
    const userType = localStorage.getItem('userType') as ProfileType || ProfileType.STUDENT;
    const profileKey = userType === ProfileType.TEACHER ? 'teacher' : 'student';
    return dataStore.getState().profiles[profileKey]?.schedule || null;
  });
  
  const [displaySchedule, setDisplaySchedule] = useState<Schedule | null>(fullSchedule);

  const [overrides, setOverrides] = useState<OverridesResponse | null>(() => {
    const userType = localStorage.getItem('userType') as ProfileType || ProfileType.STUDENT;
    const profileKey = userType === ProfileType.TEACHER ? 'teacher' : 'student';
    return dataStore.getState().profiles[profileKey]?.overrides || null;
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const profileId = localStorage.getItem('selectedId');
    if (!profileId) return [];
    return dataStore.getProfileMetadata(profileId).events || [];
  });
   
  const [isLoading, setIsLoading] = useState(() => !fullSchedule);
  
  const [isSupportLoading, setIsSupportLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarLink, setSnackbarLink] = useState<string | null>(null);
  const [snackbarLinkText, setSnackbarLinkText] = useState<string>('Посмотреть на сайте');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [isAllEventsModalOpen, setIsAllEventsModalOpen] = useState(false); 
  const [isRateModalOpen, setIsRateModalOpen] = useState(false); 
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false); 
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRateSubmitting, setIsRateSubmitting] = useState(false);
  
  const currentProfileId = localStorage.getItem('selectedId') || 'default';
  const isTeacherView = appState.lastUsed === ProfileType.TEACHER; 
   
  const { history, addEntry } = useHistoryStorage(currentProfileId);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeLimitReached, setSwipeLimitReached] = useState(false);

  const lastFetchRef = useRef<string>("");
  const fullScheduleRef = useRef<Schedule | null>(fullSchedule);
  const overridesRef = useRef<OverridesResponse | null>(overrides);
  const addEntryRef = useRef(addEntry);

  // Keep refs in sync with state to avoid stale closures
  useEffect(() => { fullScheduleRef.current = fullSchedule; }, [fullSchedule]);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);
  useEffect(() => { addEntryRef.current = addEntry; }, [addEntry]);

  const showMessage = useCallback((message: string) => { 
    setSnackbarMessage(message); 
    setSnackbarLink(null); 
    setShowSnackbar(true); 
  }, []);

  useEffect(() => {
    const purgeNativeCache = async () => {
      const storedVersion = localStorage.getItem('app_purge_ver');
      
      if (storedVersion !== CURRENT_APP_VERSION) {
        // Only delete old caches, not the current one
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter(n => !n.includes(CURRENT_APP_VERSION))
              .map(n => caches.delete(n))
          );
        }
        
        // Let the new SW take over via skipWaiting/clientsClaim in sw.js
        // Do NOT unregister SWs here — that causes a no-SW gap before reload
        localStorage.setItem('app_purge_ver', CURRENT_APP_VERSION);
      }
    };

    purgeNativeCache();
  }, []);

  // 🔥 TEST: Practice simulation via console
  const [testPracticeInfo, setTestPracticeInfo] = useState<PracticeInfo | null>(null);
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setTestPracticeInfo(e.detail);
      console.log('✅ Тестовая практика активирована:', e.detail.name);
    };
    window.addEventListener('testPractice', handler as EventListener);
    return () => window.removeEventListener('testPractice', handler as EventListener);
  }, []);

  const handleSupportSubmit = async (text: string) => {
    try {
      setIsSupportLoading(true);
      const payload = {
        stars: 0, 
        comment: `[SUPPORT] ${text}`, 
        teacher: isTeacherView ? (appState.profiles.teacher?.name || "N/A") : null,
        group: appState.profiles.student?.name || "N/A",
        platform: 'web-ttgt-support' 
      };

      await scheduleApi.postRate(payload);
      setIsSupportOpen(false);
      showMessage("Ваше обращение отправлено! ❤️");
    } catch(e) {
      setIsSupportOpen(false); 
      showMessage("Ваше обращение отправлено! ❤️");
    } finally {
      setIsSupportLoading(false);
    }
  };

  const handleNavigateToDate = useCallback((date: Date, message: string) => {
    setSelectedDate(date);
    const weekNum = getWeekNumber(date);
    setActiveWeekIndex(weekNum);
    const dayOfWeek = getDay(date);
    const dayIdx = dayOfWeek === 0 || dayOfWeek === 6 ? 0 : getDayIndex(date);
    setActiveDayIndex(dayIdx);
    showMessage(message);
  }, [setSelectedDate, setActiveWeekIndex, setActiveDayIndex, showMessage]);

  const loadProfileData = useCallback(async (profileId: string, profileType: ProfileType, date: Date = new Date()) => {
    if (!profileId) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    const metadata = dataStore.getProfileMetadata(profileId);
    
    const currentFetchKey = `${profileId}_${formattedDate}_${metadata.scheduleUpdate}_${metadata.eventsHash}`;
    if (lastFetchRef.current === currentFetchKey) return;
    lastFetchRef.current = currentFetchKey;

    const cachedProfile = dataStore.getState().profiles[profileType === ProfileType.TEACHER ? 'teacher' : 'student'];
    
    if (!cachedProfile?.schedule) {
      setIsLoading(true);
    }
    
    setError(null);
    try {
        const info = await scheduleApi.getInfo(profileId, formattedDate, metadata.scheduleUpdate || 0, metadata.eventsHash || "");
        
        if (info.schedule) {
            const normalizedSchedule = { 
              ...info.schedule, 
              weeks: (info.schedule.weeks || []).map((week: any) => ({
                ...week,
                days: (week.days || []).map((day: any) => ({
                    ...day,
                    lessons: (day.lessons || []).map((lesson: any) => 
                        lesson ? (groupSubgroups([normalizeLesson(lesson)], profileType === ProfileType.TEACHER)[0] || normalizeLesson(lesson)) : { noLesson: {} }
                    )
                }))
              }))
            };
            setFullSchedule(normalizedSchedule);
        }

        let events = info.events?.events || info.events || [];
        const studentId = dataStore.getState().profiles.student?.id;
        if (studentId && events.length === 0) {
            const groupEvents = await scheduleApi.getInfo(studentId, formattedDate, 0, "").catch(() => null);
            if (groupEvents) events = groupEvents.events?.events || groupEvents.events || [];
        }
        if (events && events.length > 0) { setCalendarEvents(events); }

        if (info.overrides) {
            const normalizedOverrides = {
                ...info.overrides,
                overrides: (info.overrides.overrides || []).map((o: any) => ({ 
                  ...o, 
                  shouldBe: normalizeLesson(o.shouldBe), 
                  willBe: normalizeLesson(o.willBe) 
                }))
            };
            setOverrides(normalizedOverrides);
            if (typeof addEntryRef.current === 'function') { addEntryRef.current(normalizedOverrides); }
        }

        await dataStore.updateProfileMetadata(profileId, { scheduleUpdate: info.schedule_update || metadata.scheduleUpdate, eventsHash: info.events?.sha256 || metadata.eventsHash, events: events });
        await dataStore.updateData(s => ({ ...s, profiles: { ...s.profiles, [profileType === ProfileType.TEACHER ? 'teacher' : 'student']: { ...s.profiles[profileType === ProfileType.TEACHER ? 'teacher' : 'student'], id: profileId, schedule: info.schedule || (fullScheduleRef.current as Schedule), overrides: info.overrides || (overridesRef.current as OverridesResponse) } } }));
    } catch (err) { 
        if (!cachedProfile?.schedule && !fullScheduleRef.current) {
            setError('Ошибка сети. Проверьте подключение.'); 
        } else {
            console.warn('Офлайн режим: используются кэшированные данные.');
        }
    } finally { 
        setIsLoading(false); 
    }
  }, []);

  const handleProfileSwitch = useCallback(async (newType: ProfileType, newProfile: any) => {
    if (isSwitchingProfile) return;
    setIsSwitchingProfile(true);
    if (newProfile.schedule) {
        setFullSchedule(newProfile.schedule);
        setOverrides(newProfile.overrides || null);
        const meta = dataStore.getProfileMetadata(newProfile.id);
        if (meta.events) setCalendarEvents(meta.events);
    }
    try {
      await dataStore.setLastUsed(newType);
      localStorage.setItem('selectedId', newProfile.id);
      localStorage.setItem('userType', newType);
      
      if (newType === ProfileType.TEACHER) {
          setApplyOverrides(true);
      }
      
      window.dispatchEvent(new Event('profileChanged'));
      lastFetchRef.current = ""; 
      await loadProfileData(newProfile.id, newType, selectedDate);
      showMessage(`Переключено на: ${newProfile.name}`);
    } catch (error) { showMessage('Ошибка при загрузке'); } finally { setIsSwitchingProfile(false); }
  }, [isSwitchingProfile, loadProfileData, selectedDate, showMessage, setApplyOverrides]);

const handleRateSubmit = async (stars: number, comment: string): Promise<boolean> => {
    if (isRateSubmitting) return false;

    if (localStorage.getItem('app_rated') === 'true') {
        setIsRateModalOpen(false);
        showMessage("Вы уже оценивали приложение! ✨");
        return true;
    }
    
    setIsRateSubmitting(true);
    const numericStars = Number(stars);

    try {
      const finalComment = comment.trim().length > 0 ? comment : "(без комментария)";

      const payload = { 
        stars: numericStars, 
        comment: finalComment, 
        teacher: isTeacherView ? (appState.profiles.teacher?.name || "N/A") : null, 
        group: appState.profiles.student?.name || "N/A", 
        platform: 'web-ttgt-app' 
      };
      
      const response = await scheduleApi.postRate(payload);
      if (response && response.error) throw new Error(response.error);

      localStorage.setItem('app_rated', 'true'); 

      if (numericStars > 3) {
        setIsRateModalOpen(false);
        showMessage("Спасибо! Мы получили ваш отзыв ❤️");
      } else {
        showMessage("Спасибо за отзыв!");
      }
      
      return true; 
    } catch(e) { 
      console.error("Rate submission failed:", e);
      
      if (numericStars > 3) {
        setIsRateModalOpen(false);
        showMessage("Спасибо! ❤️");
      }
      
      return false;
    } finally {
      setIsRateSubmitting(false);
    }
  };

  const handleRateOpen = () => {
    const isAlreadyRated = localStorage.getItem('app_rated') === 'true';
    if (isAlreadyRated) {
      showMessage("Вы уже оценивали наше приложение. Спасибо за поддержку! ✨");
    } else {
      setIsRateModalOpen(true);
    }
  };

  useEffect(() => {
    const launch = localStorage.getItem('app_first_launch');
    const alreadyRated = localStorage.getItem('app_rated') === 'true';
    if (!launch) { 
        localStorage.setItem('app_first_launch', Date.now().toString()); 
    } 
    else if (!alreadyRated && Date.now() - parseInt(launch) > 7*24*60*60*1000) {
      setTimeout(() => setIsRateModalOpen(true), 3000);
    }
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) { showMessage("Нажмите 'Поделиться' и 'На экран Домой'"); } 
      else { showMessage("Используйте меню браузера -> 'Установить'"); }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setDeferredPrompt(null); }
  }, [deferredPrompt, showMessage]);

  const { startTour } = useAppTour({ isReady: !isLoading && !!fullSchedule, setIsMenuOpen, autoStart: false });

  const scrollToActiveDay = useCallback((dayIndex: number) => {
    if (!tabsRef.current) return;
    const tabButtons = tabsRef.current.querySelectorAll('.tab-button');
    if (tabButtons[dayIndex]) {
      const tabElement = tabButtons[dayIndex] as HTMLElement;
      tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  useEffect(() => { 
    const timer = setTimeout(() => { scrollToActiveDay(activeDayIndex); }, 100); 
    return () => clearTimeout(timer); 
  }, [activeDayIndex, scrollToActiveDay]);

  useEffect(() => { 
    const unsubscribe = dataStore.subscribe((newState) => { 
      setAppState(newState); 
      setDataVersion(v => v + 1); 
    }); 
    return () => unsubscribe(); 
  }, []);

  const handleAddProfile = useCallback(() => { 
    navigate('/', { state: { fromAddProfile: true } }); 
  }, [navigate]);

  const handleTouchStart = (e: React.TouchEvent) => { 
    setTouchStart(e.targetTouches[0].clientX); 
    setSwipeLimitReached(false); 
  };
  
  const handleTouchMove = (e: React.TouchEvent) => { 
    setTouchEnd(e.targetTouches[0].clientX); 
  };
  
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || isAnimating) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > 50) {
        setIsAnimating(true);
        const newIndex = distance > 0 ? activeDayIndex + 1 : activeDayIndex - 1;
        if (newIndex > 4 || newIndex < 0) {
            setSwipeLimitReached(true);
            scheduleListRef.current?.classList.add('swipe-limit');
            setTimeout(() => { 
              scheduleListRef.current?.classList.remove('swipe-limit'); 
              setIsAnimating(false); 
            }, 500);
            return;
        }
        scheduleListRef.current?.classList.add(distance > 0 ? 'slide-left' : 'slide-right');
        setTimeout(() => {
              setActiveDayIndex(newIndex);
              const currentMonday = startOfWeek(selectedDate, { weekStartsOn: 1 });
              setSelectedDate(addDays(currentMonday, newIndex));
              setTimeout(() => { 
                scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); 
                setIsAnimating(false); 
              }, 300);
        }, 150);
    }
    setTouchStart(null); setTouchEnd(null);
  }, [touchStart, touchEnd, isAnimating, activeDayIndex, selectedDate, setActiveDayIndex, setSelectedDate]);

  const handleDayChange = (newIndex: number) => {
      if (isAnimating || newIndex === activeDayIndex) return;
      setIsAnimating(true);
      scheduleListRef.current?.classList.add(newIndex > activeDayIndex ? 'slide-left' : 'slide-right');
      setTimeout(() => {
          setActiveDayIndex(newIndex);
          const currentMonday = startOfWeek(selectedDate, { weekStartsOn: 1 });
          setSelectedDate(addDays(currentMonday, newIndex));
          setTimeout(() => { 
            scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); 
            setIsAnimating(false); 
          }, 300);
      }, 150);
  };

  const handleWeekSwitch = () => {
      const nextWeek = activeWeekIndex === 0 ? 1 : 0;
      setActiveWeekIndex(nextWeek);
      setSelectedDate(addDays(selectedDate, activeWeekIndex === 0 ? 7 : -7));
  };
   
  const handleDateSelect = useCallback((date: Date) => { 
      setSelectedDate(date);
      setActiveWeekIndex(getWeekNumber(date));
      setActiveDayIndex(getDay(date) === 0 || getDay(date) === 6 ? 0 : getDayIndex(date));
  }, [setSelectedDate, setActiveWeekIndex, setActiveDayIndex]);

  const checkOverrides = async () => {
    const selectedId = localStorage.getItem('selectedId');
    const userType = localStorage.getItem('userType') as ProfileType;
    if (!selectedId) return;
    
    if (!navigator.onLine) {
      showMessage("Офлайн режим — данные обновятся при подключении к интернету");
      return;
    }
    
    // Force refresh by clearing the fetch cache key
    lastFetchRef.current = "";
    
    setIsLoading(true);
    showMessage("Проверяем обновления...");
    
    try {
      await loadProfileData(selectedId, userType || ProfileType.STUDENT, new Date());
      showMessage("Расписание обновлено!");
    } catch (err) {
      showMessage("Не удалось обновить. Попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleApplyOverrides = () => {
    const newValue = !applyOverrides;
    setApplyOverrides(newValue);
    if (newValue && (overrides?.overrides?.length || 0) > 0) { 
      showMessage('Замены применены'); 
    } 
    else if (!newValue) { 
      showMessage('Исходное расписание'); 
    }
  };

  const handleSubgroupChange = (lessonIndex: number, subgroup: number) => {
    const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, lessonIndex);
    saveLessonData(currentProfileId, activeWeekIndex, activeDayIndex, lessonIndex, { ...lessonData, subgroup });
    setDataVersion(v => v + 1);
  };

  const handleSaveNote = (notes: string, subgroup: number) => {
    if (editingLessonIndex === null) return;
    const targetDate = new Date(selectedDate); 
    saveLessonData(currentProfileId, activeWeekIndex, activeDayIndex, editingLessonIndex, { notes, subgroup, lastUpdated: targetDate.getTime() });
    setDataVersion(v => v + 1);
  };

  const hasNoteForLesson = (lessonIndex: number): boolean => {
    const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, lessonIndex);
    return (lessonData.notes || '').trim().length > 0;
  };

  const hasInitialized = useRef(false);
  useEffect(() => {
    const initializeData = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      resetToToday();
      const todayDate = new Date();
      const selectedId = localStorage.getItem('selectedId');
      const userType = localStorage.getItem('userType') as ProfileType;
      
      if (!selectedId) { navigate('/'); return; }
      if (userType && userType !== appState.lastUsed) { await dataStore.setLastUsed(userType); }
      
      if (userType === ProfileType.TEACHER) {
          setApplyOverrides(true);
      }
      
      await loadProfileData(selectedId, userType || ProfileType.STUDENT, todayDate);
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDateTime = selectedDate.getTime();

  // 🔥 practiceInfo MUST be defined BEFORE the overrides useEffect
  const practiceInfo = useMemo<PracticeInfo | null>(() => {
    if (testPracticeInfo) return testPracticeInfo;
    
    if (isTeacherView && !appState.profiles.student?.id) return null;
    let info: PracticeInfo | null = null;
    const curDate = new Date(selectedDateTime), today = startOfDay(new Date());
    const activeEvent = (calendarEvents || []).find(ev => {
      try {
        return isWithinInterval(curDate, { start: startOfDay(parseISO(ev.dateStart)), end: endOfDay(parseISO(ev.dateEnd)) });
      } catch(e) { return false; }
    });
    
    if (activeEvent && activeEvent.type !== 'gia' && activeEvent.code !== 'III' && activeEvent.code !== 'D') {
        info = { name: activeEvent.title, type: activeEvent.type as any, code: activeEvent.code, dateStart: parseISO(activeEvent.dateStart), dateEnd: parseISO(activeEvent.dateEnd), daysUntil: differenceInCalendarDays(parseISO(activeEvent.dateStart), today), isActive: differenceInCalendarDays(parseISO(activeEvent.dateStart), today) <= 0 };
    } else if (!activeEvent) {
        const upcoming = findUpcomingEvent(calendarEvents, curDate, 4);
        if (upcoming && upcoming.type !== 'gia') { info = upcoming; info.isActive = info.daysUntil <= 0; }
        else if (overrides && overrides.isPractice && !['III', 'D'].includes(overrides.practiceCode || "")) {
            info = { name: overrides.practiceTitle || "Событие", type: 'practice', dateStart: overrides.dateStart ? parseISO(overrides.dateStart) : curDate, dateEnd: overrides.dateEnd ? parseISO(overrides.dateEnd) : null, daysUntil: differenceInCalendarDays(overrides.dateStart ? parseISO(overrides.dateStart) : curDate, today), isActive: differenceInCalendarDays(overrides.dateStart ? parseISO(overrides.dateStart) : curDate, today) <= 0 };
        }
    }
    return info;
  }, [calendarEvents, selectedDateTime, overrides, isTeacherView, appState.profiles.student, testPracticeInfo]);

  useEffect(() => {
    const userType = localStorage.getItem('userType') as ProfileType;
    if (hasInitialized.current && currentProfileId) {
        loadProfileData(currentProfileId, userType || ProfileType.STUDENT, new Date(selectedDateTime));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateTime, currentProfileId]);

// 🔥 ЭФФЕКТ ДЛЯ ПРИМЕНЕНИЯ ЗАМЕН (ПЕРЕПИСАН С УЧЁТОМ ВСЕХ ВАРИАНТОВ)
  useEffect(() => {
    if (!fullSchedule) { setDisplaySchedule(null); return; }
    
    const newSchedule = JSON.parse(JSON.stringify(fullSchedule)) as Schedule;
    const currentWeekData = newSchedule.weeks?.[activeWeekIndex % 2];
    if (!currentWeekData || !currentWeekData.days) { setDisplaySchedule(newSchedule); return; }
    
    const curDate = new Date(selectedDateTime);
    
    let effectiveOverrides: any[] = [];
    let substitutesDateMatches = false;

    if (applyOverrides && overrides) {
        effectiveOverrides = [...(overrides.overrides || [])];
        substitutesDateMatches = overrides.day === curDate.getDate() && overrides.month === curDate.getMonth() && overrides.year === curDate.getFullYear();
    }

    // Teacher view: also include overrides from student profiles
    if (isTeacherView && applyOverrides) {
        const teacherName = appState.profiles.teacher?.name || "";
        const teacherLastName = teacherName.split(' ')[0]; 
        
        Object.entries(appState.profiles).forEach(([key, profile]: [string, any]) => {
            if (!profile || profile.id === currentProfileId) return; 
            
            const stOverrides = profile.overrides;
            if (stOverrides) {
                const stDateMatches = stOverrides.day === curDate.getDate() && stOverrides.month === curDate.getMonth() && stOverrides.year === curDate.getFullYear();
                
                if (stDateMatches && stOverrides.overrides) {
                    substitutesDateMatches = true;
                    stOverrides.overrides.forEach((stOv: any) => {
                        const willBe = normalizeLesson(stOv.willBe);
                        const teacherInOverride = willBe?.commonLesson?.teacher || "";
                        const subgroupTeachers = willBe?.subgroupedLesson?.subgroups?.map((s:any) => s.teacher) || [];
                        
                        const isRelevant = teacherInOverride.includes(teacherLastName) || 
                                       subgroupTeachers.some(t => t.includes(teacherLastName));
                        
                        if (isRelevant) {
                            if (!effectiveOverrides.some(o => o.index === stOv.index)) {
                                const enrichedWillBe = JSON.parse(JSON.stringify(willBe));
                                if (enrichedWillBe.commonLesson) { 
                                    enrichedWillBe.commonLesson.group = profile.name || "Группа"; 
                                }
                                effectiveOverrides.push({ ...stOv, willBe: enrichedWillBe, shouldBe: normalizeLesson(stOv.shouldBe) });
                            }
                        }
                    });
                }
            }
        });
    }

    if (substitutesDateMatches && effectiveOverrides.length > 0) {
      const day = currentWeekData.days[activeDayIndex];
      if (day && day.lessons) {
        effectiveOverrides.forEach(override => {
          if (day.lessons[override.index] !== undefined) {
              const baseLesson = day.lessons[override.index];
              const willBe = normalizeLesson(override.willBe);
              const shouldBe = normalizeLesson(override.shouldBe);

              // Apply the override using the smart merge function
              day.lessons[override.index] = applyOverrideToLesson(
                baseLesson, willBe, shouldBe, isTeacherView
              );

              // Mark as applied
              if (day.lessons[override.index]) {
                  (day.lessons[override.index] as any).isAppliedOverride = true;
                  // Only set noLesson if the result actually IS noLesson (all subgroups removed)
                  if (isOverrideCancellation(willBe) && day.lessons[override.index]?.noLesson) {
                      (day.lessons[override.index] as any).noLesson = true;
                  }
              }
          }
        });

        // 🔥 FIX: If a subgroup was cancelled from a subgroupedLesson,
        // and the remaining subgroup doesn't appear in any other override,
        // add it to the next available empty slot
        // ONLY for student view with subgroup cancellations — NOT for teacher view replacements
        if (!isTeacherView) {
          effectiveOverrides.forEach(override => {
            const result = day.lessons[override.index];
            if (!result || result.noLesson) return;
            
            // Only handle subgroupedLesson results (cancellation of one subgroup)
            if (!result.subgroupedLesson) return;
            
            const remainingSubgroups = result.subgroupedLesson.subgroups || [];
            if (remainingSubgroups.length === 0) return;
            
            const teacherNames = remainingSubgroups.map((s: any) => getTeacherLastName(s.teacher || ''));
            const hasOverrideForRemaining = effectiveOverrides.some(o => {
              if (o.index === override.index) return false;
              const willBeOv = normalizeLesson(o.willBe);
              const ovTeacher = willBeOv?.commonLesson?.teacher || '';
              return teacherNames.includes(getTeacherLastName(ovTeacher));
            });
            
            if (!hasOverrideForRemaining && remainingSubgroups.length === 1) {
              const nextEmptyIndex = day.lessons.findIndex((l: any, i: number) => 
                i > override.index && (!l || l.noLesson)
              );
              if (nextEmptyIndex !== -1 && !day.lessons[nextEmptyIndex]?.isAppliedOverride) {
                const sub = remainingSubgroups[0];
                day.lessons[nextEmptyIndex] = {
                  commonLesson: {
                    name: result.subgroupedLesson.name || '',
                    teacher: sub.teacher || '',
                    room: sub.room || '',
                    group: sub.group,
                    subgroup_index: null
                  },
                  isAppliedOverride: true
                };
              }
            }
          });
        }
      }
    }

    // 🔥 PRACTICE LOGIC: If group is on practice, hide regular lessons but keep replacements
    if (practiceInfo && practiceInfo.isActive && !isTeacherView) {
      const day = currentWeekData.days[activeDayIndex];
      if (day && day.lessons) {
        day.lessons.forEach((lesson, idx) => {
          // Keep lessons that were added by overrides (replacements)
          if (lesson && (lesson as any).isAppliedOverride) return;
          // Hide regular lessons (practice is active, no replacement)
          if (lesson && !lesson.noLesson) {
            day.lessons[idx] = { noLesson: {} };
          }
        });
      }
    }

    // 🔥 TEACHER VIEW: Auto-scan all groups for practice
    if (isTeacherView) {
      const PRACTICE_KEYWORDS = ['практика', 'аттестация', 'каникулы', 'гиа', 'ivity'];
      const day = currentWeekData.days[activeDayIndex];
      if (day && day.lessons) {
        day.lessons.forEach((lesson, idx) => {
          if (!lesson || lesson.noLesson || (lesson as any).isAppliedOverride) return;
          
          const lessonName = (lesson.commonLesson?.name || lesson.subgroupedLesson?.name || '').toLowerCase();
          const isPracticeLesson = PRACTICE_KEYWORDS.some(kw => lessonName.includes(kw));
          
          if (isPracticeLesson) {
            const lessonGroup = lesson.commonLesson?.group || lesson.subgroupedLesson?.subgroups?.[0]?.group || '';
            day.lessons[idx] = {
              commonLesson: {
                name: lesson.commonLesson?.name || lesson.subgroupedLesson?.name || 'Практика',
                teacher: '',
                room: '',
                group: lessonGroup,
                subgroup_index: null
              },
              isAppliedOverride: true
            };
          }
        });
      }
    }

    setDisplaySchedule(newSchedule);
    setDataVersion(v => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullSchedule, overrides, applyOverrides, calendarEvents, selectedDateTime, activeWeekIndex, activeDayIndex, isTeacherView, appState.profiles, currentProfileId, practiceInfo]);
  // 🔥 БЕЗОПАСНАЯ ФОРМИРОВКА СПИСКА УРОКОВ
  const lessonsToShow = useMemo(() => {
      const weekData = displaySchedule?.weeks?.[activeWeekIndex % 2];
      const baseLessons = weekData?.days?.[activeDayIndex]?.lessons;
      const lessonCount = activeDayIndex === 1 ? 6 : 5;
      
      const lessonsArray = Array.from({ length: lessonCount }, (_, i) => {
          let lesson;
          if (activeDayIndex === 1) {
              if (i === 3) return { noLesson: {} };
              else if (i < 3) lesson = baseLessons?.[i];
              else lesson = baseLessons?.[i - 1];
          } else {
              lesson = baseLessons?.[i];
          }
          
          // 🔥 ФИКС: Если lesson === null или undefined, возвращаем объект "Пары нет"
          return (lesson && typeof lesson === 'object') ? lesson : { noLesson: {} };
      });

      const myCourses = (appState.customCourses || []).filter(c => c.weekIndex === activeWeekIndex && c.dayIndex === activeDayIndex && c.profileId === currentProfileId);
      myCourses.forEach(course => {
        const index = course.lessonIndex;
        let targetIndex = activeDayIndex === 1 && index >= 3 ? index + 1 : index;
        if (targetIndex >= 0 && targetIndex < lessonCount) {
          if (!lessonsArray[targetIndex] || lessonsArray[targetIndex].noLesson) {
              lessonsArray[targetIndex] = { commonLesson: { name: course.name, teacher: course.teacher, room: course.room, group: course.teacher }, customCourseId: course.id } as any;
          }
        }
      });
      return lessonsArray;
  }, [displaySchedule, activeWeekIndex, activeDayIndex, appState.customCourses, currentProfileId]);

  const renderLessons = () => {
    return (lessonsToShow || []).map((lesson, index) => {
      const isTuesday = activeDayIndex === 1;
      const isCurrent = isLessonCurrent(index, activeDayIndex, isTuesday);
      const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, index);
      const customCourseId = (lesson as any)?.customCourseId;
      
      if (isTuesday && index === 3) { 
        return ( 
          <ScheduleItem key="class-hour" lesson={{ commonLesson: { name: 'Классный час', teacher: '', room: '', group: '' } }} index={index} isCurrent={isCurrent} isTuesday={true} isClassHour={true} onClick={() => {}} activeDayIndex={activeDayIndex} /> 
        ); 
      }
      return ( 
        <ScheduleItem 
          key={customCourseId || index} 
          lesson={lesson} 
          index={index} 
          isCurrent={isCurrent} 
          isTuesday={isTuesday} 
          hasNote={hasNoteForLesson(index)} 
          onSubgroupChange={handleSubgroupChange} 
          savedSubgroup={lessonData.subgroup} 
          isTeacherView={isTeacherView} 
          customCourseId={customCourseId} 
          activeDayIndex={activeDayIndex} 
          onClick={() => { if (lesson && !lesson.noLesson) setEditingLessonIndex(index); }} 
        /> 
      );
    });
  };

  const lessonToEdit = (lessonsToShow && editingLessonIndex !== null) ? lessonsToShow[editingLessonIndex] : null;
  const currentLessonData = editingLessonIndex !== null ? getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, editingLessonIndex) : { notes: '', subgroup: 0 };

  const handlePracticeClick = () => { if (practiceInfo) setIsPracticeModalOpen(true); };
  const currentWeekDates = useMemo(() => {
    const monday = startOfWeek(new Date(selectedDateTime), { weekStartsOn: 1 });
    return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  }, [selectedDateTime]);

  return (
    <>
      <div className="container" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Offline Indicator */}
        {!isOnline && (
          <div className="offline-banner">
            <span className="material-icons">cloud_off</span>
            <span>Офлайн режим — используются сохранённые данные</span>
          </div>
        )}

        <div className="schedule-header">
          <h2 className="schedule-title" style={{ fontWeight: 800 }}>Расписание</h2>
          <div style={{ position: 'relative' }}>
              <button id="tour-menu" className="menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <Icon name="more_vert" />
              </button>
              <DropdownMenu 
                  isOpen={isMenuOpen} 
                  onClose={() => setIsMenuOpen(false)} 
                  onCheckOverrides={checkOverrides} 
                  onInstallApp={handleInstallApp} 
                  onOpenAllEvents={() => setIsAllEventsModalOpen(true)} 
                  onStartTour={startTour} 
                  onRateApp={handleRateOpen} 
                  onAddCourse={() => setIsAddCourseOpen(true)} 
                  onSupport={() => setIsSupportOpen(true)}
                  isTeacher={isTeacherView}
                  onOpenMonitoring={() => setIsMonitoringOpen(true)}
                  onOpenAbout={() => setIsAboutOpen(true)}
                  onShare={() => setIsShareOpen(true)}
              />
          </div>
        </div>
        <div id="tour-profile">
            <ProfileSwitcher 
              key={appState.lastUsed} profiles={appState.profiles} currentProfileType={appState.lastUsed} 
              onSwitch={handleProfileSwitch} onAddProfile={handleAddProfile} isLoading={isSwitchingProfile} 
            />
        </div>
        <PracticeBanner info={practiceInfo} onClick={handlePracticeClick} />
        <PracticeDetailsModal isOpen={isPracticeModalOpen} onClose={() => setIsPracticeModalOpen(false)} info={practiceInfo} currentProfileId={currentProfileId} calendarEvents={calendarEvents} onNavigateToDate={handleNavigateToDate} />
        <div id="tour-days" className={`schedule-tabs-container ${swipeLimitReached ? 'limit-reached' : ''}`} ref={tabsContainerRef}>
          <div className="schedule-tabs" ref={tabsRef}>
            {DAYS_OF_WEEK.map((day, index) => (
              <button key={day} className={`tab-button ${activeDayIndex === index ? 'active' : ''}`} onClick={() => handleDayChange(index)} disabled={isAnimating || isSwitchingProfile}>
                <span className="tab-button-content">
                  <span className="tab-day-name">{day}</span>
                  <span className="tab-day-date">{currentWeekDates[index] ? format(currentWeekDates[index], 'd MMMM', { locale: ru }) : ''}</span>
                  {activeDayIndex === index && <div className="tab-indicator" />}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div id="tour-list" className="schedule-list" data-version={dataVersion} ref={scheduleListRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ touchAction: 'pan-y' }}>
          {isLoading ? (
            <div className="cat-loader-container">
              <div className="cat-wrapper">
                <div className="cat-svg-container">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 733 673" className="cat-body">
                    <path d="M111.002 139.5C270.502 -24.5001 471.503 2.4997 621.002 139.5C770.501 276.5 768.504 627.5 621.002 649.5C473.5 671.5 246 687.5 111.002 649.5C-23.9964 611.5 -48.4982 303.5 111.002 139.5Z"></path>
                    <path d="M184 9L270.603 159H97.3975L184 9Z"></path>
                    <path d="M541 0L627.603 150H454.397L541 0Z"></path>
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 158 564" className="cat-tail">
                    <path d="M5.97602 76.066C-11.1099 41.6747 12.9018 0 51.3036 0V0C71.5336 0 89.8636 12.2558 97.2565 31.0866C173.697 225.792 180.478 345.852 97.0691 536.666C89.7636 553.378 73.0672 564 54.8273 564V564C16.9427 564 -5.4224 521.149 13.0712 488.085C90.2225 350.15 87.9612 241.089 5.97602 76.066Z"></path>
                  </svg>
                  <div className="cat-text-container">
                    <span className="cat-bigzzz">Z</span>
                    <span className="cat-zzz">Z</span>
                  </div>
                </div>
                <div className="wallContainer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 500 126" className="cat-wall">
                    <line strokeWidth="6" y2="3" x2="450" y1="3" x1="50"></line>
                    <line strokeWidth="6" y2="85" x2="400" y1="85" x1="100"></line>
                    <line strokeWidth="6" y2="122" x2="375" y1="122" x1="125"></line>
                    <line strokeWidth="6" y2="43" x2="500" y1="43"></line>
                    <line strokeWidth="6" y2="1.99391" x2="115.5" y1="43.0061" x1="115.5"></line>
                    <line strokeWidth="6" y2="2.00002" x2="189" y1="43.0122" x1="189"></line>
                    <line strokeWidth="6" y2="2.00612" x2="262.5" y1="43.0183" x1="262.5"></line>
                    <line strokeWidth="6" y2="2.01222" x2="336" y1="43.0244" x1="336"></line>
                    <line strokeWidth="6" y2="2.01833" x2="409.5" y1="43.0305" x1="409.5"></line>
                    <line strokeWidth="6" y2="43" x2="153" y1="84.0122" x1="153"></line>
                    <line strokeWidth="6" y2="43" x2="228" y1="84.0122" x1="228"></line>
                    <line strokeWidth="6" y2="43" x2="303" y1="84.0122" x1="303"></line>
                    <line strokeWidth="6" y2="43" x2="378" y1="84.0122" x1="378"></line>
                    <line strokeWidth="6" y2="84" x2="192" y1="125.012" x1="192"></line>
                    <line strokeWidth="6" y2="84" x2="267" y1="125.012" x1="267"></line>
                    <line strokeWidth="6" y2="84" x2="342" y1="125.012" x1="342"></line>
                  </svg>
                </div>
              </div>
              <p style={{ marginTop: '20px', color: 'var(--color-text)', opacity: 0.7, fontWeight: 500, textAlign: 'center' }}>Загрузка расписания...</p>
            </div>
          ) : error ? (<div className="error-state"><p>{error}</p><button onClick={() => window.location.reload()}>Обновить</button></div>) : renderLessons()}
          {!error && (<div className="overrides-toggle-container"><button className={`overrides-toggle ${applyOverrides ? 'active' : ''}`} onClick={toggleApplyOverrides} disabled={isSwitchingProfile}><Icon name="swap_horiz" /><span>Учитывать замены</span></button></div>)}
        </div>
        <AddCourseModal isOpen={isAddCourseOpen} onClose={() => setIsAddCourseOpen(false)} activeWeek={activeWeekIndex} activeDay={activeDayIndex} schedule={fullSchedule} overrides={applyOverrides ? overrides : null} profileId={currentProfileId} />
        <CustomCalendar isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} onSelectDate={handleDateSelect} currentDate={selectedDate} calendarEvents={calendarEvents} />
        <NoteModal lesson={lessonToEdit} onClose={() => setEditingLessonIndex(null)} onSave={handleSaveNote} savedNote={currentLessonData.notes} savedSubgroup={currentLessonData.subgroup} />
        
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} isTeacherView={isTeacherView} />
        <AllNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} profileId={currentProfileId} schedule={fullSchedule} />
        <AllEventsModal isOpen={isAllEventsModalOpen} onClose={() => setIsAllEventsModalOpen(false)} calendarEvents={calendarEvents} onNavigateToDate={handleNavigateToDate} groupName={appState.profiles.student?.name} />
        <RateModal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} onSubmit={handleRateSubmit} />
        
        <TeacherMonitoringModal 
          isOpen={isMonitoringOpen} 
          onClose={() => setIsMonitoringOpen(false)} 
          teacherSchedule={fullSchedule} 
          initialDate={selectedDate}
        />

        <SupportModal 
          isOpen={isSupportOpen} 
          onClose={() => setIsSupportOpen(false)} 
          onSubmit={handleSupportSubmit} 
          isLoading={isSupportLoading} 
        />

        <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
        
        <AboutModal 
          isOpen={isAboutOpen} 
          onClose={() => setIsAboutOpen(false)} 
        />

        <Snackbar message={snackbarMessage || ''} isVisible={showSnackbar} onClose={() => { setShowSnackbar(false); setSnackbarLink(null); }} link={snackbarLink} linkText={snackbarLinkText} />

        <div id="tour-nav-panel" className="week-switcher-container">
          <button className="back-button" onClick={() => navigate('/')} title="Назад"><Icon name="arrow_back" /></button>
          <button className="week-switcher-button" onClick={handleWeekSwitch}>
            <div className="week-text">
              <span className="week-name">{activeWeekIndex === 0 ? 'Первая' : 'Вторая'} неделя</span>
              {activeWeekIndex === getWeekNumber(new Date()) ? ( <span className="week-current">Текущая</span> ) : ( <span className="week-current" style={{ color: 'var(--color-primary)' }}>Следующая</span> )}
            </div>
          </button>
          <button className="calendar-button" onClick={() => setIsCalendarOpen(true)} title="Календарь"><Icon name="event" /></button>
        </div>
      </div>
    </>
  );
}