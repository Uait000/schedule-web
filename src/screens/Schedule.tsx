// src/screens/Schedule.tsx
/**
 * ============================================================================
 * ТТЖТ РАСПИСАНИЕ - SCHEDULE SCREEN (v2.9.2-ultra-fix)
 * ============================================================================
 * Разработчик: Gemini (AI Technical Lead)
 * * КРИТИЧЕСКИЕ ОБНОВЛЕНИЯ:
 * 1. [TEACHER AUTO-LOAD FIX]: Замены у преподавателя теперь работают СРАЗУ.
 * 2. [CROSS-PROFILE SYNC]: Мгновенный поиск фамилии по всем кэшированным группам.
 * 3. [NATIVE CACHE FIX]: Программная разрегистрация Service Worker для PWA.
 * 4. [SUBGROUP LOGIC]: Корректная работа Л-1-2 (слияние) и Д-1-1 (фильтрация).
 * ============================================================================
 */

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
  endOfDay 
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { scheduleApi } from '../api'; 
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
import { ActiveSubscriptionsModal } from '../components/ActiveSubscriptionsModal'; 
import { SupportModal } from '../components/SupportModal'; 

/**
 * 🔥 ВЕРСИЯ ПРИЛОЖЕНИЯ (МЕНЯТЬ ПРИ КАЖДОМ ДЕПЛОЕ)
 * Текущая версия: 2.9.2
 */
const CURRENT_APP_VERSION = '2.9.2';

interface LessonData {
  notes: string;
  subgroup: number;
  lastUpdated?: number;
}

const DAYS_OF_WEEK = [ 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница' ];

/**
 * Глобальный перехватчик ошибок ресурсов (404 Assets Recovery)
 */
if (typeof window !== 'undefined') {
  window.addEventListener('error', async (e) => {
    const target = e.target as any;
    if (target && target.tagName === 'SCRIPT' && target.src && target.src.includes('/assets/')) {
      console.warn('Критическая ошибка ресурсов. Запуск принудительного восстановления...');
      
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
  if (!lessons || !Array.isArray(lessons)) return lessons;
  if (isTeacherView) return lessons;
   
  const groupedLessons = [];
  const subgroupMap = new Map();
  const teacherSubgroupMap = new Map();
   
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    if (lesson && lesson.subgroupedLesson) {
      groupedLessons.push(lesson);
    } else if (lesson && lesson.commonLesson && lesson.commonLesson.teacher) {
      const lessonName = lesson.commonLesson.name;
      const teacher = lesson.commonLesson.teacher;
       
      if (!subgroupMap.has(lessonName)) {
        subgroupMap.set(lessonName, {
          subgroupedLesson: {
            name: lessonName,
            subgroups: []
          }
        });
      }
       
      const groupedLesson = subgroupMap.get(lessonName);
      let subgroupIndex = 1;
      const teacherKey = `${lessonName}_${teacher}`;
      if (teacherSubgroupMap.has(teacherKey)) {
        subgroupIndex = teacherSubgroupMap.get(teacherKey);
      } else {
        const existingSubgroups = groupedLesson.subgroupedLesson.subgroups.length;
        subgroupIndex = existingSubgroups + 1;
        teacherSubgroupMap.set(teacherKey, subgroupIndex);
      }
       
      const existingSubgroup = groupedLesson.subgroupedLesson.subgroups.find(
        (sub: any) => sub.subgroup_index === subgroupIndex
      );
       
      if (!existingSubgroup) {
        groupedLesson.subgroupedLesson.subgroups.push({
          teacher: teacher,
          room: lesson.commonLesson.room || '',
          subgroup_index: subgroupIndex,
          group: lesson.commonLesson.group || ''
        });
      }
    } else {
      groupedLessons.push(lesson);
    }
  }
   
  subgroupMap.forEach((groupedLesson, lessonName) => {
    if (groupedLesson.subgroupedLesson.subgroups.length > 1) {
      const firstIndex = lessons.findIndex(lesson => 
        lesson && lesson.commonLesson && lesson.commonLesson.name === lessonName
      );
      if (firstIndex !== -1) {
        groupedLessons[firstIndex] = groupedLesson;
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
    if (!obj) return undefined;
    if (typeof obj === 'string') return obj; 
    if (typeof obj !== 'object') return undefined;
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
  <span className={`material-icons ${className}`} style={{ fontSize: 'inherit', verticalAlign: 'middle', ...style }}>{name}</span>
);

function FloatingNotificationBanner({ isEnabled, onToggle, isSupported, onClose }: { isEnabled: boolean; onToggle: () => void; isSupported: boolean; onClose: () => void }) {
    if (!isSupported) return null;
    
    return (
        <div className="floating-notification-banner">
            <div className="notif-content">
                <div className="notif-icon-box">
                    <Icon name={isEnabled ? "notifications_active" : "notifications_off"} className="gradient-icon" style={{ fontSize: '26px' }} />
                </div>
                <div className="notif-text">
                    <span className="notif-title">{isEnabled ? 'Уведомления активны' : 'Включить уведомления?'}</span>
                    <span className="notif-desc">{isEnabled ? 'Вы получаете оповещения о заменах' : 'Не пропускайте важные изменения'}</span>
                </div>
            </div>
            <div className="notif-actions">
                <button className={`notif-btn ${isEnabled ? 'secondary' : 'primary'}`} onClick={onToggle}>
                    {isEnabled ? 'Выкл' : 'Вкл'}
                </button>
                <button className="notif-close-btn" onClick={onClose}>
                    <Icon name="close" />
                </button>
            </div>
        </div>
    );
}

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
    return calendarEvents.some(event => {
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
  onOpenHistory, 
  onAddCourse, 
  onOpenNotes, 
  onInstallApp,
  onOpenAllEvents,
  onStartTour,
  onRateApp,
  onSubscribePush,
  isPushEnabled,
  onOpenSubsList, 
  onSupport 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCheckOverrides: () => void; 
  onOpenHistory: () => void; 
  onAddCourse: () => void; 
  onOpenNotes: () => void;
  onInstallApp: () => void;
  onOpenAllEvents: () => void;
  onStartTour: () => void;
  onRateApp: () => void; 
  onSubscribePush: () => void;
  isPushEnabled: boolean; 
  onOpenSubsList: () => void; 
  onSupport: () => void;
}) { 
  const navigate = useNavigate(); 
   
  if (!isOpen) return null; 
   
  const handleMenuClick = (action: string) => { 
    if (action !== 'help' && action !== 'install') onClose();
     
    if (action === 'overrides') { onCheckOverrides(); } 
    else if (action === 'history') { onOpenHistory(); } 
    else if (action === 'addCourse') { onAddCourse(); } 
    else if (action === 'notes') { onOpenNotes(); } 
    else if (action === 'install') { onInstallApp(); } 
    else if (action === 'allEvents') { onOpenAllEvents(); }
    else if (action === 'subsList') { onOpenSubsList(); } 
    else if (action === 'support') { onSupport(); } 
    else if (action === 'rate') { onRateApp(); } 
    else if (action === 'push') { onSubscribePush(); } 
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
            <button className="dropdown-item" onClick={() => handleMenuClick('overrides')}><Icon name="sync_alt" /><span>Проверить изменения</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('allEvents')}><Icon name="event_repeat" /><span>График событий</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('history')}><Icon name="history" /><span>История замен</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('notes')}><Icon name="description" /><span>Мои заметки</span></button> 
            
            <button className="dropdown-item" onClick={() => handleMenuClick('subsList')}>
                <Icon name="checklist_rtl" />
                <span>Список подписок</span>
            </button>

            <button className="dropdown-item" onClick={() => handleMenuClick('push')}>
                <Icon name={isPushEnabled ? "notifications_active" : "notifications"} />
                <span>{isPushEnabled ? 'Выключить пуши' : 'Включить пуши'}</span>
            </button>

            <button className="dropdown-item" onClick={() => handleMenuClick('addCourse')}><Icon name="add_circle" /><span>Добавить курс</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('install')}><Icon name="download" /><span>Установить приложение</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('rate')}><Icon name="star_outline" /><span>Оценить приложение</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('changeGroup')}><Icon name="group" /><span>Поменять группу</span></button> 
            <button className="dropdown-item" onClick={() => handleMenuClick('help')}><Icon name="help_outline" /><span>Как пользоваться?</span></button>
            
            <button className="dropdown-item" onClick={() => handleMenuClick('support')}>
              <Icon name="contact_support" />
              <span>Техподдержка</span>
            </button> 
        </div> 
    </>
  ); 
}

function processSubgroupedOverride(originalLesson: Lesson, overrideWillBe: Lesson): Lesson {
  if (!originalLesson.subgroupedLesson) return overrideWillBe;
  if (!overrideWillBe || overrideWillBe.noLesson) return { noLesson: {} };
  if (!overrideWillBe.subgroupedLesson) return overrideWillBe;

  const originalName = originalLesson.subgroupedLesson.name;
  const overrideName = overrideWillBe.subgroupedLesson.name;
  if (originalName !== overrideName) return overrideWillBe;

  const originalSubgroups = originalLesson.subgroupedLesson.subgroups || [];
  const overrideSubgroups = overrideWillBe.subgroupedLesson.subgroups || [];
   
  const originalSubgroupsMap = new Map();
  originalSubgroups.forEach(sub => {
    const key = sub.subgroup_index || 0;
    originalSubgroupsMap.set(key, { ...sub });
  });
   
  overrideSubgroups.forEach(overrideSub => {
    const key = overrideSub.subgroup_index || 0;
    const isCancelled = (
      (overrideSub.teacher === 'нет' || !overrideSub.teacher || overrideSub.teacher === 'null') ||
      (overrideSub.room === 'нет' || !overrideSub.room || overrideSub.room === 'null') ||
      (overrideSub.group === 'нет' || !overrideSub.group || overrideSub.group === 'null')
    );
     
    if (isCancelled) {
      originalSubgroupsMap.delete(key);
    } else {
      originalSubgroupsMap.set(key, overrideSub);
    }
  });
   
  if (originalSubgroupsMap.size === 0) return { noLesson: {} };
   
  const sortedSubgroups = Array.from(originalSubgroupsMap.values())
    .sort((a, b) => (a.subgroup_index || 0) - (b.subgroup_index || 0));
   
  return {
    subgroupedLesson: {
      name: originalName,
      subgroups: sortedSubgroups
    }
  };
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
            <div className="snackbar-title">Обновление</div>
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

export function ScheduleScreen() {
  const navigate = useNavigate();
  const scheduleListRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
   
  const { activeDayIndex, setActiveDayIndex, activeWeekIndex, setActiveWeekIndex, applyOverrides, setApplyOverrides, selectedDate, setSelectedDate, resetToToday } = useScheduleState();
   
  const [appState, setAppState] = useState(() => dataStore.getState());
  const [fullSchedule, setFullSchedule] = useState<Schedule | null>(null);
  const [displaySchedule, setDisplaySchedule] = useState<Schedule | null>(null);
  const [overrides, setOverrides] = useState<OverridesResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
   
  const [isLoading, setIsLoading] = useState(false);
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
  const [isSubsListOpen, setIsSubsListOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false); 
  
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(true);
  const [showPushBanner, setShowPushBanner] = useState(false); 

  const currentProfileId = localStorage.getItem('selectedId') || 'default';
  const isTeacherView = appState.lastUsed === ProfileType.TEACHER; 
   
  const { history, addEntry } = useHistoryStorage(currentProfileId);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeLimitReached, setSwipeLimitReached] = useState(false);

  const lastFetchRef = useRef<string>("");

  const showMessage = useCallback((message: string) => { 
    setSnackbarMessage(message); 
    setSnackbarLink(null); 
    setShowSnackbar(true); 
  }, []);

  useEffect(() => {
    const purgeNativeCache = async () => {
      const storedVersion = localStorage.getItem('app_purge_ver');
      
      if (storedVersion !== CURRENT_APP_VERSION) {
        console.warn('⚡️ Нативное обновление: полная очистка...');
        
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
        
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (let r of regs) await r.unregister();
        }
        
        localStorage.setItem('app_purge_ver', CURRENT_APP_VERSION);
        window.location.replace('/?refresh=' + Date.now());
      }
    };

    purgeNativeCache();
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

  const checkSubscriptionStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsPushSupported(false);
        return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const active = localStorage.getItem(`push_active_${currentProfileId}`) === 'true';
    const processed = localStorage.getItem(`push_banner_processed_${currentProfileId}`) === 'true';
    setIsPushEnabled(active);
    if (!active && !processed) { setShowPushBanner(true); } 
    else { setShowPushBanner(false); }
  }, [currentProfileId]);

  useEffect(() => { checkSubscriptionStatus(); }, [checkSubscriptionStatus]);

  const handlePushSubscription = async () => {
    if (!isPushSupported) { showMessage("Браузер не поддерживает уведомления"); return; }
    localStorage.setItem(`push_banner_processed_${currentProfileId}`, 'true');
    setShowPushBanner(false);

    if (isPushEnabled) {
        setIsPushEnabled(false);
        localStorage.setItem(`push_active_${currentProfileId}`, 'false');
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) { await scheduleApi.subscribePush(sub, currentProfileId, false); }
        } catch (e) { console.error(e); }
        showMessage("Отключено");
        return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        showMessage("Разрешите пуши");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
          const key = 'BIqO4RMd3S60fnef-Qx8ukxxZqTEsCyG-tvcvZAwyGef77_Nv0s56oxmuxSenjMH7nUsPoWb7xC7vyHVpWLZNPs';
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
          });
      }
      await scheduleApi.subscribePush(sub, currentProfileId, true);
      localStorage.setItem(`push_active_${currentProfileId}`, 'true');
      setIsPushEnabled(true);
      showMessage("Включено! 🔔");
    } catch (err) { showMessage("Ошибка активации"); }
  };

  const closePushBanner = () => { localStorage.setItem(`push_banner_processed_${currentProfileId}`, 'true'); setShowPushBanner(false); };

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
    if (cachedProfile?.schedule) {
        setFullSchedule(cachedProfile.schedule);
        setOverrides(cachedProfile.overrides || null);
        const sid = dataStore.getState().profiles.student?.id;
        if (sid) {
            const smeta = dataStore.getProfileMetadata(sid);
            if (smeta.events) setCalendarEvents(smeta.events);
        } else if (metadata.events) {
            setCalendarEvents(metadata.events);
        }
    } else { setIsLoading(true); }
    setError(null);
    try {
        const info = await scheduleApi.getInfo(profileId, formattedDate, metadata.scheduleUpdate || 0, metadata.eventsHash || "");
        if (info.schedule) {
            const normalizedSchedule = { 
              ...info.schedule, 
              weeks: info.schedule.weeks.map((week: any) => ({
                ...week,
                days: week.days.map((day: any) => ({
                    ...day,
                    lessons: (day.lessons || []).map((lesson: any) => 
                        groupSubgroups([normalizeLesson(lesson)], profileType === ProfileType.TEACHER)[0] || normalizeLesson(lesson)
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
                overrides: (info.overrides.overrides || []).map((o: any) => ({ ...o, shouldBe: normalizeLesson(o.shouldBe), willBe: normalizeLesson(o.willBe) }))
            };
            setOverrides(normalizedOverrides);
            if (typeof addEntry === 'function') { addEntry(normalizedOverrides); }
        }
        await dataStore.updateProfileMetadata(profileId, { scheduleUpdate: info.schedule_update || metadata.scheduleUpdate, eventsHash: info.events?.sha256 || metadata.eventsHash, events: events });
        await dataStore.updateData(s => ({ ...s, profiles: { ...s.profiles, [profileType === ProfileType.TEACHER ? 'teacher' : 'student']: { ...s.profiles[profileType === ProfileType.TEACHER ? 'teacher' : 'student'], id: profileId, schedule: info.schedule || fullSchedule, overrides: info.overrides || overrides } } }));
    } catch (err) { 
        console.error("Load Error:", err); 
        if (!fullSchedule) setError('Ошибка сервера. Попробуйте позже.'); 
    } finally { setIsLoading(false); }
  }, [fullSchedule, overrides, addEntry]);

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
      
      // 🔥 ДЛЯ ПРЕПОДАВАТЕЛЯ: Сразу активируем замены при переключении
      if (newType === ProfileType.TEACHER) {
          setApplyOverrides(true);
      }
      
      window.dispatchEvent(new Event('profileChanged'));
      lastFetchRef.current = ""; 
      await loadProfileData(newProfile.id, newType, selectedDate);
      showMessage(`Переключено на: ${newProfile.name}`);
    } catch (error) { showMessage('Ошибка при загрузке'); } finally { setIsSwitchingProfile(false); }
  }, [isSwitchingProfile, loadProfileData, selectedDate, showMessage, setApplyOverrides]);

  const handleRateSubmit = async (stars: number, comment: string) => {
    try {
      const payload = { stars: Number(stars), comment: String(comment || ""), teacher: isTeacherView ? (appState.profiles.teacher?.name || "N/A") : null, group: appState.profiles.student?.name || "N/A", platform: 'web-ttgt-app' };
      await scheduleApi.postRate(payload);
      localStorage.setItem('app_rated', 'true'); 
      setIsRateModalOpen(false);
      showMessage("Спасибо! ❤️");
    } catch(e) { showMessage("Спасибо! ❤️"); }
  };

  useEffect(() => {
    const launch = localStorage.getItem('app_first_launch');
    if (!launch) { localStorage.setItem('app_first_launch', Date.now().toString()); } 
    else if (Date.now() - parseInt(launch) > 7*24*60*60*1000 && !localStorage.getItem('app_rated')) {
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

  useEffect(() => { const timer = setTimeout(() => { scrollToActiveDay(activeDayIndex); }, 100); return () => clearTimeout(timer); }, [activeDayIndex, scrollToActiveDay]);

  useEffect(() => { const unsubscribe = dataStore.subscribe((newState) => { setAppState(newState); setDataVersion(v => v + 1); }); return () => unsubscribe(); }, []);

  const handleAddProfile = useCallback(() => { navigate('/', { state: { fromAddProfile: true } }); }, [navigate]);

  const handleTouchStart = (e: React.TouchEvent) => { setTouchStart(e.targetTouches[0].clientX); setSwipeLimitReached(false); };
  const handleTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || isAnimating) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > 50) {
        setIsAnimating(true);
        const newIndex = distance > 0 ? activeDayIndex + 1 : activeDayIndex - 1;
        if (newIndex > 4 || newIndex < 0) {
            setSwipeLimitReached(true);
            scheduleListRef.current?.classList.add('swipe-limit');
            setTimeout(() => { scheduleListRef.current?.classList.remove('swipe-limit'); setIsAnimating(false); }, 500);
            return;
        }
        scheduleListRef.current?.classList.add(distance > 0 ? 'slide-left' : 'slide-right');
        setTimeout(() => {
              setActiveDayIndex(newIndex);
              const currentMonday = startOfWeek(selectedDate, { weekStartsOn: 1 });
              setSelectedDate(addDays(currentMonday, newIndex));
              setTimeout(() => { scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); setIsAnimating(false); }, 300);
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
          setTimeout(() => { scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); setIsAnimating(false); }, 300);
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

  const checkOverrides = () => {
    setSnackbarMessage("Проверьте актуальное расписание замен на официальном сайте ТТЖТ.");
    setSnackbarLink("https://ttgt.org/images/pdf/zamena.pdf");
    setSnackbarLinkText("Перейти");
    setShowSnackbar(true);
  };

  const toggleApplyOverrides = () => {
    const newValue = !applyOverrides;
    setApplyOverrides(newValue);
    if (newValue && (overrides?.overrides?.length || 0) > 0) { showMessage('Замены применены'); } 
    else if (!newValue) { showMessage('Исходное расписание'); }
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
    return lessonData.notes.trim().length > 0;
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
      
      // 🔥 ДЛЯ ПРЕПОДАВАТЕЛЯ: При заходе СРАЗУ включаем режим замен
      if (userType === ProfileType.TEACHER) {
          setApplyOverrides(true);
      }
      
      await loadProfileData(selectedId, userType || ProfileType.STUDENT, todayDate);
    };
    initializeData();
  }, [navigate, resetToToday, loadProfileData, setApplyOverrides]);

  const selectedDateTime = selectedDate.getTime();
  useEffect(() => {
    const userType = localStorage.getItem('userType') as ProfileType;
    if (hasInitialized.current && currentProfileId) {
        loadProfileData(currentProfileId, userType || ProfileType.STUDENT, new Date(selectedDateTime));
    }
  }, [selectedDateTime, currentProfileId, loadProfileData]);

  /**
   * 🔥 УЛУЧШЕННАЯ ЛОГИКА ПРИМЕНЕНИЯ ЗАМЕН
   */
  useEffect(() => {
    if (!fullSchedule) { setDisplaySchedule(null); return; }
    const newSchedule = JSON.parse(JSON.stringify(fullSchedule)) as Schedule;
    const currentWeekData = newSchedule.weeks?.[activeWeekIndex % 2];
    if (!currentWeekData) { setDisplaySchedule(newSchedule); return; }
    
    const curDate = new Date(selectedDateTime);
    
    // 🔥 Если преподаватель - замены должны искаться ВСЕГДА, но отображаться по флагу applyOverrides
    // Мы не возвращаем schedule до наложения, если мы в Teacher View и есть хоть какие-то данные
    if (!applyOverrides) { setDisplaySchedule(newSchedule); return; }
    
    let effectiveOverrides: any[] = [];
    let substitutesDateMatches = false;

    if (overrides) {
        effectiveOverrides = [...(overrides.overrides || [])];
        substitutesDateMatches = overrides.day === curDate.getDate() && overrides.month === curDate.getMonth() && overrides.year === curDate.getFullYear();
    }

    /**
     * 🔥 АВТО-ПОИСК ДЛЯ ПРЕПОДАВАТЕЛЯ ПО ВСЕМ КЭШИРОВАННЫМ ПРОФИЛЯМ
     */
    if (isTeacherView) {
        const teacherName = appState.profiles.teacher?.name || "";
        const teacherLastName = teacherName.split(' ')[0]; 
        
        // Перебираем все профили (студентов) в appState
        Object.entries(appState.profiles).forEach(([key, profile]: [string, any]) => {
            if (!profile || profile.id === currentProfileId) return; 
            
            const stOverrides = profile.overrides;
            if (stOverrides) {
                const stDateMatches = stOverrides.day === curDate.getDate() && stOverrides.month === curDate.getMonth() && stOverrides.year === curDate.getFullYear();
                
                if (stDateMatches && stOverrides.overrides) {
                    substitutesDateMatches = true;
                    stOverrides.overrides.forEach((stOv: any) => {
                        const willBe = normalizeLesson(stOv.willBe);
                        const teacherInOverride = willBe.commonLesson?.teacher || "";
                        const subgroupTeachers = willBe.subgroupedLesson?.subgroups.map((s:any) => s.teacher) || [];
                        
                        let isRelevant = teacherInOverride.includes(teacherLastName) || 
                                       subgroupTeachers.some(t => t.includes(teacherLastName));
                        
                        if (isRelevant) {
                            // Проверяем, нет ли уже такой замены (по индексу)
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
              const currentCell = day.lessons[override.index];
              const willBe = normalizeLesson(override.willBe);
              const shouldBe = normalizeLesson(override.shouldBe);

              const isCancellation = willBe.noLesson || (willBe.commonLesson?.teacher?.toLowerCase() === 'нет');

              if (isCancellation) {
                  if (currentCell && currentCell.subgroupedLesson) {
                      const teacherToRemove = (shouldBe.commonLesson?.teacher || "").split(' ')[0];
                      const safeSubs = currentCell.subgroupedLesson.subgroups.filter(
                          s => !s.teacher.includes(teacherToRemove)
                      );
                      
                      if (safeSubs.length > 0) {
                          day.lessons[override.index] = {
                              subgroupedLesson: { name: currentCell.subgroupedLesson.name, subgroups: safeSubs }
                          };
                      } else {
                          day.lessons[override.index] = { noLesson: {} };
                      }
                  } else {
                      day.lessons[override.index] = { noLesson: {} };
                  }
              } 
              else {
                  if (currentCell && (currentCell as any).isAppliedOverride) {
                      const baseSubs = currentCell.subgroupedLesson ? [...currentCell.subgroupedLesson.subgroups] : [currentCell.commonLesson];
                      const addedSubs = willBe.subgroupedLesson ? [...willBe.subgroupedLesson.subgroups] : [willBe.commonLesson];

                      const syncMap = new Map();
                      [...baseSubs, ...addedSubs].forEach(s => {
                          if (s && s.teacher && s.teacher !== 'нет') syncMap.set(s.subgroup_index || 0, s);
                      });

                      day.lessons[override.index] = {
                          subgroupedLesson: {
                              name: willBe.commonLesson?.name || willBe.subgroupedLesson?.name || "Урок",
                              subgroups: Array.from(syncMap.values()).sort((a,b) => (a.subgroup_index || 0) - (b.subgroup_index || 0))
                          }
                      };
                  } else {
                      day.lessons[override.index] = willBe;
                  }
              }
              if (day.lessons[override.index]) {
                  (day.lessons[override.index] as any).isAppliedOverride = true;
              }
          }
        });
      }
    }
    setDisplaySchedule(newSchedule);
    setDataVersion(v => v + 1); // 🔥 Форсируем рендер списка
  }, [fullSchedule, overrides, applyOverrides, calendarEvents, selectedDateTime, activeWeekIndex, activeDayIndex, isTeacherView, appState.profiles, currentProfileId]);

  const lessonsToShow = useMemo(() => {
      const weekData = displaySchedule?.weeks?.[activeWeekIndex % 2];
      const baseLessons = weekData?.days?.[activeDayIndex]?.lessons;
      const lessonCount = activeDayIndex === 1 ? 6 : 5;
      const lessonsArray = Array.from({ length: lessonCount }, (_, i) => {
          if (activeDayIndex === 1) {
              if (i === 3) return { noLesson: {} };
              else if (i < 3) return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} };
              else { const baseIndex = i - 1; return (baseLessons && baseLessons[baseIndex]) ? baseLessons[baseIndex] : { noLesson: {} }; }
          } else { return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} }; }
      });
      const myCourses = appState.customCourses.filter(c => c.weekIndex === activeWeekIndex && c.dayIndex === activeDayIndex && c.profileId === currentProfileId);
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
    return lessonsToShow.map((lesson, index) => {
      const isTuesday = activeDayIndex === 1;
      const isCurrent = isLessonCurrent(index, activeDayIndex, isTuesday);
      const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, index);
      const customCourseId = lesson ? (lesson as any).customCourseId : undefined;
      if (isTuesday && index === 3) { return ( <ScheduleItem key="class-hour" lesson={{ commonLesson: { name: 'Классный час', teacher: '', room: '', group: '' } }} index={index} isCurrent={isCurrent} isTuesday={true} isClassHour={true} onClick={() => {}} activeDayIndex={activeDayIndex} /> ); }
      return ( <ScheduleItem key={customCourseId || index} lesson={lesson} index={index} isCurrent={isCurrent} isTuesday={isTuesday} hasNote={hasNoteForLesson(index)} onSubgroupChange={handleSubgroupChange} savedSubgroup={lessonData.subgroup} isTeacherView={isTeacherView} customCourseId={customCourseId} activeDayIndex={activeDayIndex} onClick={() => { if (lesson && !lesson.noLesson) setEditingLessonIndex(index); }} /> );
    });
  };

  const lessonToEdit = (lessonsToShow && editingLessonIndex !== null) ? lessonsToShow[editingLessonIndex] : null;
  const currentLessonData = editingLessonIndex !== null ? getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, editingLessonIndex) : { notes: '', subgroup: 0 };

  const practiceInfo = useMemo<PracticeInfo | null>(() => {
    if (isTeacherView && !appState.profiles.student?.id) return null;
    let info: PracticeInfo | null = null;
    const curDate = new Date(selectedDateTime), today = startOfDay(new Date());
    const activeEvent = calendarEvents.find(ev => isWithinInterval(curDate, { start: startOfDay(parseISO(ev.dateStart)), end: endOfDay(parseISO(ev.dateEnd)) }));
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
  }, [calendarEvents, selectedDateTime, overrides, isTeacherView, appState.profiles.student]);

  const handlePracticeClick = () => { if (practiceInfo) setIsPracticeModalOpen(true); };
  const currentWeekDates = useMemo(() => {
    const monday = startOfWeek(new Date(selectedDateTime), { weekStartsOn: 1 });
    return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  }, [selectedDateTime]);

  return (
    <>
      <style>{` 
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Icons&display=block'); 
        :root { font-family: 'Inter', sans-serif !important; }
        .tab-button-content { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 0; }
        .tab-day-name { font-size: 14px; font-weight: 700; color: var(--color-text); opacity: 0.6; }
        .tab-day-date { font-size: 14px; font-weight: 700; color: var(--color-text); white-space: nowrap; opacity: 0.6; }
        .tab-button.active .tab-day-name, .tab-button.active .tab-day-date { color: #8c67f6; opacity: 1; }
        .tab-indicator { margin-top: 4px !important; height: 3px !important; border-radius: 4px !important; }
        .calendar-modal-modern { background: var(--color-surface); width: 90%; max-width: 360px; border-radius: 28px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); border: 1px solid var(--color-border); }
        .calendar-header-modern { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .calendar-month-year { font-size: 18px; font-weight: 800; text-transform: capitalize; color: var(--color-text); }
        .calendar-nav-btn { background: var(--color-surface-container); border: none; color: var(--color-text); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .calendar-input-section { margin-bottom: 24px; }
        .input-modern-wrapper { display: flex; align-items: center; background: var(--color-surface-container); padding: 0 16px; border-radius: 16px; border: 2px solid transparent; transition: all 0.2s; }
        .input-modern-wrapper:focus-within { border-color: var(--color-primary); background: var(--color-surface); }
        .input-modern-wrapper input { background: transparent; border: none; color: var(--color-text); padding: 14px 0; font-size: 16px; width: 100%; outline: none; font-family: 'monospace'; text-align: center; letter-spacing: 2px; }
        .calendar-weekdays-modern { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 12px; }
        .calendar-weekday { font-size: 13px; font-weight: 700; color: var(--color-primary); opacity: 0.8; }
        .calendar-days-modern { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 24px; }
        .calendar-day-modern { aspect-ratio: 1; border: none; background: transparent; color: var(--color-text); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; position: relative; }
        .calendar-day-modern.today { color: var(--color-primary); }
        .calendar-day-modern.selected { background: var(--color-primary) !important; color: white !important; }
        .calendar-day-modern.disabled { opacity: 0.2; cursor: not-allowed; }
        .calendar-footer-modern { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .calendar-btn-primary { background: var(--color-primary); color: white; padding: 14px; border-radius: 16px; border: none; font-weight: 700; cursor: pointer; }
        .calendar-btn-secondary { background: var(--color-surface-container); color: var(--color-text); padding: 14px; border-radius: 16px; border: none; font-weight: 700; cursor: pointer; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .cat-loader-container { width: fit-content; height: fit-content; display: flex; align-items: center; justify-content: center; margin: 50px auto; }
        .cat-wrapper { width: fit-content; height: fit-content; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .cat-svg-container { width: 100%; height: fit-content; display: flex; align-items: center; justify-content: center; position: relative; }
        .cat-body { width: 80px; fill: var(--color-text); }
        .cat-tail { position: absolute; width: 17px; top: 50%; animation: tail 0.5s ease-in infinite alternate-reverse; transform-origin: top; fill: var(--color-text); }
        .cat-wall { width: 300px; stroke: var(--color-border); }
        .cat-text-container { display: flex; flex-direction: column; width: 50px; position: absolute; margin: 0px 0px 100px 120px; }
        .cat-zzz { color: var(--color-primary); font-weight: 700; font-size: 15px; animation: zzz 2s linear infinite; }
        .cat-bigzzz { color: var(--color-primary); font-weight: 700; font-size: 25px; margin-left: 10px; animation: zzz 2.3s linear infinite; }
        @keyframes tail { 0% { transform: rotateZ(60deg); } 50% { transform: rotateZ(0deg); } 100% { transform: rotateZ(-20deg); } }
        @keyframes zzz { 0% { color: transparent; } 50% { color: var(--color-primary); } 100% { color: transparent; } }

        .floating-notification-banner {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 400px;
            background: rgba(30, 30, 30, 0.95); backdrop-filter: blur(12px); border-radius: 20px; padding: 14px 18px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between;
            z-index: 2000; border: 1px solid rgba(255,255,255,0.1); animation: slideDownFade 0.4s ease;
        }

        @media (prefers-color-scheme: light) {
             .floating-notification-banner { 
               background: rgba(255, 255, 255, 0.98) !important; border: 1px solid rgba(0,0,0,0.12) !important; 
               box-shadow: 0 12px 35px rgba(0,0,0,0.15) !important;
             }
             .notif-title { color: #000000 !important; font-weight: 800; }
             .notif-desc { color: #444444 !important; font-weight: 500; }
             .notif-close-btn { color: #625b71 !important; opacity: 1; }
        }

        @keyframes slideDownFade { from { opacity: 0; transform: translate(-50%, -30px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .notif-content { display: flex; align-items: center; gap: 14px; }
        .notif-icon-box { width: 40px; height: 40px; border-radius: 14px; background: rgba(140, 103, 246, 0.15); display: flex; align-items: center; justify-content: center; }
        .gradient-icon { background: -webkit-linear-gradient(135deg, #6200ea, #9d46ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .notif-text { display: flex; flex-direction: column; }
        .notif-title { font-weight: 700; font-size: 14px; color: #fff; }
        .notif-desc { font-weight: 500; font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 1px; }
        .notif-actions { display: flex; align-items: center; gap: 8px; }
        .notif-btn { padding: 8px 14px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; border: none; transition: all 0.2s; }
        .notif-btn.primary { background: #fff; color: #6200ea; }
        .notif-btn.secondary { background: rgba(255,255,255,0.15); color: #fff; }
        .notif-close-btn { background: transparent; border: none; color: rgba(255,255,255,0.5); display: flex; align-items: center; padding: 4px; cursor: pointer; }
        .dropdown-overlay { position: fixed; inset: 0; z-index: 1000; background: transparent; }
        
        .dropdown-menu-attached {
            position: absolute; top: 120%; right: 0; 
            background: var(--color-surface); border-radius: 18px; box-shadow: 0 10px 40px rgba(0,0,0,0.25);
            padding: 8px; width: 260px; z-index: 1001; border: 1px solid var(--color-border);
            animation: scaleIn 0.2s ease forwards; transform-origin: top right;
        }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        
        .dropdown-item {
            width: 100%; display: flex; align-items: center; padding: 12px 14px; border: none;
            background: transparent; font-size: 14px; font-weight: 700; cursor: pointer;
            border-radius: 12px; transition: all 0.15s; text-align: left; gap: 14px;
        }
        
        .dropdown-item .material-icons { font-size: 22px; color: #a88dff; }
        .dropdown-item span { color: var(--color-text); opacity: 0.9; }
        .dropdown-item:hover { background: var(--color-surface-container); transform: translateX(4px); }

        @media (prefers-color-scheme: dark) {
            .dropdown-menu-attached { background: rgba(26, 26, 26, 0.9); }
            .dropdown-item span { color: #ffffff; }
        }
        @media (prefers-color-scheme: light) {
            .dropdown-menu-attached { background: rgba(255, 255, 255, 0.9); }
            .dropdown-item span { color: #1a1a1a; }
        }

        .modern-snackbar { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 380px; background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(16px); color: #fff; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); z-index: 2100; overflow: hidden; animation: slideUpSnack 0.5s ease; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding-right: 6px; }
        @media (prefers-color-scheme: light) { .modern-snackbar { background: rgba(255, 255, 255, 0.85); color: #000; border: 1px solid rgba(0,0,0,0.05); } .snackbar-title { color: #000; } .snackbar-message { color: rgba(0,0,0,0.7); } .snackbar-btn { background: rgba(0,0,0,0.05); color: #000; } .snackbar-left-border { background: #6200ea; } }
        @keyframes slideUpSnack { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .snackbar-left-border { width: 4px; height: 40px; background: #fff; border-radius: 10px; margin-left: 16px; }
        .snackbar-content { display: flex; align-items: center; padding: 14px 16px; gap: 14px; flex: 1; }
        .snackbar-icon-area { width: 40px; height: 40px; background: linear-gradient(135deg, #6200ea, #9d46ff); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .snackbar-text-area { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .snackbar-title { font-weight: 800; font-size: 14px; margin-bottom: 2px; }
        .snackbar-message { font-size: 12px; opacity: 0.8; line-height: 1.3; }
        .snackbar-btn { padding: 8px 14px; background: rgba(255,255,255,0.15); border: none; border-radius: 14px; color: inherit; font-weight: 700; font-size: 12px; cursor: pointer; }
        .container { position: relative; }
      `}</style>
      <div className="container" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                  onOpenHistory={() => setIsHistoryOpen(true)} 
                  onOpenNotes={() => setIsNotesModalOpen(true)} 
                  onInstallApp={handleInstallApp} 
                  onOpenAllEvents={() => setIsAllEventsModalOpen(true)} 
                  onStartTour={startTour} 
                  onRateApp={() => setIsRateModalOpen(true)} 
                  onAddCourse={() => setIsAddCourseOpen(true)} 
                  onSubscribePush={handlePushSubscription}
                  isPushEnabled={isPushEnabled} 
                  onOpenSubsList={() => setIsSubsListOpen(true)}
                  onSupport={() => setIsSupportOpen(true)}
              />
          </div>
        </div>
        <div id="tour-profile">
            <ProfileSwitcher 
              key={appState.lastUsed} profiles={appState.profiles} currentProfileType={appState.lastUsed} 
              onSwitch={handleProfileSwitch} onAddProfile={handleAddProfile} isLoading={isSwitchingProfile} 
            />
        </div>
        {showPushBanner && (
            <FloatingNotificationBanner 
                isEnabled={isPushEnabled} onToggle={handlePushSubscription} 
                isSupported={isPushSupported} onClose={closePushBanner} 
            />
        )}
        <PracticeBanner info={practiceInfo} onClick={handlePracticeClick} />
        <PracticeDetailsModal isOpen={isPracticeModalOpen} onClose={() => setIsPracticeModalOpen(false)} info={practiceInfo} currentProfileId={currentProfileId} calendarEvents={calendarEvents} onNavigateToDate={handleNavigateToDate} />
        <div id="tour-days" className={`schedule-tabs-container ${swipeLimitReached ? 'limit-reached' : ''}`} ref={tabsContainerRef}>
          <div className="schedule-tabs" ref={tabsRef}>
            {DAYS_OF_WEEK.map((day, index) => (
              <button key={day} className={`tab-button ${activeDayIndex === index ? 'active' : ''}`} onClick={() => handleDayChange(index)} disabled={isAnimating || isSwitchingProfile}>
                <span className="tab-button-content">
                  <span className="tab-day-name">{day}</span>
                  <span className="tab-day-date">{format(currentWeekDates[index], 'd MMMM', { locale: ru })}</span>
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
        
        <ActiveSubscriptionsModal isOpen={isSubsListOpen} onClose={() => setIsSubsListOpen(false)} />
        <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} onSubmit={handleSupportSubmit} isLoading={isSupportLoading} />
        
        <Snackbar message={snackbarMessage || ''} isVisible={showSnackbar} onClose={() => { setShowSnackbar(false); setSnackbarLink(null); }} link={snackbarLink} linkText={snackbarLinkText} />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} isTeacherView={isTeacherView} />
        <AllNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} profileId={currentProfileId} schedule={fullSchedule} />
        <AllEventsModal isOpen={isAllEventsModalOpen} onClose={() => setIsAllEventsModalOpen(false)} calendarEvents={calendarEvents} onNavigateToDate={handleNavigateToDate} groupName={appState.profiles.student?.name} />
        <RateModal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} onSubmit={handleRateSubmit} />
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