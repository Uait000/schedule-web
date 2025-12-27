import { useNavigate } from 'react-router-dom';
import ScheduleItem, { isLessonCurrent } from '../components/ScheduleItem';
import { NoteModal } from '../components/NoteModal';
import { AddCourseModal } from '../components/AddCourseModal';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { AllNotesModal } from '../components/AllNotesModal';
import { Schedule, OverridesResponse, Lesson, CalendarEvent } from '../types';
import { ProfileType } from '../types/profiles';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'; 
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, startOfWeek, addDays, parseISO, differenceInCalendarDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
import { findNextPractice, findUpcomingEvent, PracticeInfo } from '../utils/practiceUtils';

interface LessonData {
  notes: string;
  subgroup: number;
  lastUpdated?: number;
}

const DAYS_OF_WEEK = [ 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница' ];

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
        group: localGroup || globalGroup 
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
            subgroup_index: sub.subgroup_index || 0,
            group: subLocalGroup || globalGroup 
          };
        })
      }
    };
  }
  
  if (lesson.name || lesson.teacher || lesson.room) {
    if (lesson.subgroup_index !== undefined) {
      return {
        subgroupedLesson: {
          name: lesson.name || '',
          subgroups: [{
            teacher: lesson.teacher || '',
            room: lesson.room || '',
            subgroup_index: lesson.subgroup_index || 1,
            group: lesson.group || ''
          }]
        }
      };
    }
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || globalGroup
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

const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontSize: 'inherit', verticalAlign: 'middle', ...style }}>{name}</span>
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
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}> 
        <div className="calendar-header"> 
          <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="calendar-nav-btn"><Icon name="chevron_left" /></button> 
          <span className="calendar-month-year">{format(viewDate, 'LLLL yyyy', { locale: ru })}</span> 
          <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="calendar-nav-btn"><Icon name="chevron_right" /></button> 
        </div> 
        <div style={{ marginBottom: '16px', padding: '0 8px' }}> 
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '8px' }}>Введите дату:</label> 
          <input 
            type="text" 
            value={dateInput} 
            onChange={handleDateInputChange} 
            onKeyDown={handleKeyDown} 
            placeholder="дд.мм.гггг" 
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              fontSize: '16px', 
              border: `2px solid ${isValid ? 'var(--color-border)' : '#ff4444'}`, 
              borderRadius: '12px', 
              backgroundColor: 'var(--color-surface-container)', 
              color: 'var(--color-text)', 
              boxSizing: 'border-box', 
              textAlign: 'center', 
              fontFamily: 'monospace', 
              fontWeight: '500' 
            }} 
          /> 
          {!isValid && <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>Неверная дата</div>} 
        </div> 
        <div className="calendar-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (<div key={day} className="calendar-weekday">{day}</div>))}</div> 
        <div className="calendar-days"> 
          {Array.from({ length: startPadding }).map((_, i) => (<div key={`empty-${i}`} className="calendar-day empty"></div>))} 
          {days.map((day) => {
            const dayOfWeek = getDay(day);
            const isHoliday = isDateHoliday(day);
            const isDisabled = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;
            
            return ( 
              <button 
                key={day.toString()} 
                className={`calendar-day ${isSameDay(day, currentDate) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`} 
                onClick={() => handleDayClick(day)} 
                disabled={isDisabled}
                title={isHoliday ? 'Каникулы' : format(day, 'd MMMM yyyy', { locale: ru })}
              >
                {format(day, 'd')}
              </button> 
            );
          })} 
        </div> 
        <div className="calendar-footer"> 
          <button onClick={onClose} className="calendar-cancel-btn"><Icon name="close" />Закрыть</button> 
          <button onClick={handleTodayClick} className="calendar-today-btn"><Icon name="today" />Сегодня</button> 
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
  onStartTour 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCheckOverrides: () => void; 
  onOpenHistory: () => void; 
  onAddCourse: () => void; 
  onOpenNotes: () => void;
  onInstallApp: () => void;
  onStartTour: () => void;
}) { 
  const navigate = useNavigate(); 
  
  if (!isOpen) return null; 
  
  const handleMenuClick = (action: string) => { 
    if (action !== 'help') onClose();
    
    if (action === 'overrides') { onCheckOverrides(); } 
    else if (action === 'history') { onOpenHistory(); } 
    else if (action === 'addCourse') { onAddCourse(); } 
    else if (action === 'notes') { onOpenNotes(); } 
    else if (action === 'install') { onInstallApp(); } 
    else if (action === 'changeGroup') { 
      localStorage.removeItem('selectedId'); 
      localStorage.removeItem('userType'); 
      navigate('/', { replace: true }); 
    } else if (action === 'feedback') { window.open('https://t.me/ttgt1bot', '_blank'); } 
    else if (action === 'help') { onStartTour(); } 
  }; 
  
  return ( 
    <div className="dropdown-backdrop" onClick={onClose}> 
      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}> 
        <button id="menu-item-overrides" className="dropdown-item" onClick={() => handleMenuClick('overrides')}><Icon name="sync_alt" /><span>Проверить изменения</span></button> 
        <button id="menu-item-history" className="dropdown-item" onClick={() => handleMenuClick('history')}><Icon name="history" /><span>История замен</span></button> 
        <button id="menu-item-notes" className="dropdown-item" onClick={() => handleMenuClick('notes')}><Icon name="description" /><span>Мои заметки</span></button> 
        <button id="menu-item-add-course" className="dropdown-item" onClick={() => handleMenuClick('addCourse')}><Icon name="add_circle" /><span>Добавить курс</span></button> 
        <button id="menu-item-install" className="dropdown-item" onClick={() => handleMenuClick('install')}><Icon name="download" /><span>Установить приложение</span></button> 
        <button id="menu-item-change-group" className="dropdown-item" onClick={() => handleMenuClick('changeGroup')}><Icon name="group" /><span>Поменять группу</span></button> 
        <button id="menu-item-help" className="dropdown-item" onClick={() => handleMenuClick('help')}><Icon name="help_outline" /><span>Как пользоваться?</span></button>
        <button id="menu-item-feedback" className="dropdown-item" onClick={() => handleMenuClick('feedback')}><Icon name="feedback" /><span>Обратная связь</span></button> 
      </div> 
    </div> 
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
      const timer = setTimeout(() => { onClose(); }, 5000);
      return () => clearTimeout(timer); 
    } 
  }, [isVisible, onClose]); 
  
  if (!isVisible) return null; 
  
  const handleLinkClick = (e: React.MouseEvent) => { e.stopPropagation(); if (link) { window.open(link, '_blank'); } onClose(); };
  const handleContainerClick = () => { onClose(); };
  
  return ( 
    <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', padding: '0', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', zIndex: 2000, maxWidth: '320px', width: '90%', animation: 'fadeIn 0.3s ease', border: '1px solid var(--color-border)', overflow: 'hidden' }} onClick={handleContainerClick}> 
      <div style={{ padding: '16px 20px', borderBottom: link ? '1px solid var(--color-border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
          <Icon name="info" style={{ fontSize: '20px', color: 'var(--color-primary)', marginRight: '8px' }} />
          <span style={{ fontWeight: '600', fontSize: '16px' }}>Обновление</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '14px', lineHeight: '1.4' }}>{message}</div>
      </div>
      {link && (<div style={{ padding: '12px 20px' }}><button onClick={handleLinkClick} style={{ backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="open_in_new" style={{ fontSize: '18px', marginRight: '8px' }} />{linkText || 'Посмотреть на сайте'}</button></div>)}
    </div> 
  ); 
}

// --- MAIN COMPONENT ---

export function ScheduleScreen() {
  const navigate = useNavigate();
  const scheduleListRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  
  const { activeDayIndex, setActiveDayIndex, activeWeekIndex, setActiveWeekIndex, applyOverrides, setApplyOverrides, selectedDate, setSelectedDate, resetToToday } = useScheduleState();
  
  const [appState, setAppState] = useState(() => dataStore.getState());
  useEffect(() => {
    const unsubscribe = dataStore.subscribe((newState) => {
      setAppState(prev => {
          const isSame = prev.lastUsed === newState.lastUsed && 
                        prev.profiles.student?.id === newState.profiles.student?.id &&
                        prev.profiles.teacher?.id === newState.profiles.teacher?.id;
          if (isSame) return prev;
          return newState;
      });
    });
    return () => unsubscribe();
  }, []);
  
  const [fullSchedule, setFullSchedule] = useState<Schedule | null>(null);
  const [displaySchedule, setDisplaySchedule] = useState<Schedule | null>(null);
  const [overrides, setOverrides] = useState<OverridesResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
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
  
  const currentProfileId = localStorage.getItem('selectedId') || 'default';
  const isTeacherView = appState.lastUsed === ProfileType.TEACHER; 
  
  const { history } = useHistoryStorage(currentProfileId);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeLimitReached, setSwipeLimitReached] = useState(false);

  const { startTour } = useAppTour({
    isReady: !isLoading && !!fullSchedule,
    setIsMenuOpen
  });

  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const scrollToActiveDay = useCallback((dayIndex: number) => {
    if (!tabsRef.current) return;
    const tabButtons = tabsRef.current.querySelectorAll('.tab-button');
    if (tabButtons[dayIndex]) {
      const tabElement = tabButtons[dayIndex] as HTMLElement;
      tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  const showMessage = (message: string) => { setSnackbarMessage(message); setSnackbarLink(null); setShowSnackbar(true); };

  const handleAddProfile = () => { navigate('/', { state: { fromAddProfile: true } }); };

  const handleProfileSwitch = async (newType: ProfileType, newProfile: any) => {
    if (isSwitchingProfile) return;
    setIsSwitchingProfile(true);
    try {
      await dataStore.setLastUsed(newType);
      localStorage.setItem('selectedId', newProfile.id);
      localStorage.setItem('userType', newType);
      
      window.dispatchEvent(new Event('profileChanged'));
      
      await loadProfileData(newProfile.id, newType, selectedDate);
      showMessage(`Переключено на: ${newProfile.name}`);
    } catch (error) { console.error('Error switching profile:', error); showMessage('Ошибка при загрузке'); } 
    finally { setIsSwitchingProfile(false); }
  };

  const loadProfileData = async (profileId: string, profileType: ProfileType, date: Date = new Date()) => {
    if (!profileId) return;
    setIsLoading(true);
    setError(null);
    const formattedDate = format(date, 'yyyy-MM-dd');
    
    try {
        const state = dataStore.getState();
        const cachedProfile = state.profiles[profileType];
        const metadata = dataStore.getProfileMetadata(profileId);

        if (cachedProfile?.schedule) setFullSchedule(cachedProfile.schedule);
        if (cachedProfile?.overrides) setOverrides(cachedProfile.overrides);
        if (metadata.events) setCalendarEvents(metadata.events);

        const response = await scheduleApi.getInfo(
            profileId, 
            formattedDate, 
            metadata.scheduleUpdate, 
            metadata.eventsHash || "" 
        );

        if (response.schedule) {
            let normalizedSchedule = response.schedule;
             if (response.schedule.weeks) {
                 normalizedSchedule = { ...response.schedule, weeks: response.schedule.weeks.map((week: any) => ({
                    ...week,
                    days: week.days.map((day: any) => ({
                        ...day,
                        lessons: day.lessons && Array.isArray(day.lessons) 
                            ? groupSubgroups(day.lessons, profileType === ProfileType.TEACHER).map(normalizeLesson)
                            : []
                    }))
                 }))};
             }
            setFullSchedule(normalizedSchedule);
            if (response.schedule_update) {
                dataStore.updateProfileMetadata(profileId, { scheduleUpdate: response.schedule_update });
            }
        }

        if (response.events) {
            setCalendarEvents(response.events.events);
            dataStore.updateProfileMetadata(profileId, { 
                events: response.events.events,
                eventsHash: response.events.sha256 
            });
        }

        if (response.overrides) {
            const normalizedOverrides = {
                ...response.overrides,
                overrides: response.overrides.overrides.map((override: any) => ({
                    ...override,
                    shouldBe: normalizeLesson(override.shouldBe),
                    willBe: normalizeLesson(override.willBe)
                }))
            };
            setOverrides(normalizedOverrides);
        }

        await dataStore.updateData(s => ({
            ...s,
            profiles: {
                ...s.profiles,
                [profileType]: {
                    ...s.profiles[profileType],
                    id: profileId,
                    schedule: response.schedule || fullSchedule || cachedProfile?.schedule,
                    overrides: response.overrides || overrides || cachedProfile?.overrides
                }
            }
        }));

    } catch (err) { 
        console.error(err); 
        if (!fullSchedule) setError('Не удалось загрузить данные.'); 
    } finally { setIsLoading(false); }
  };

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
  
  const handleDateSelect = (date: Date) => { 
     setSelectedDate(date);
     setActiveWeekIndex(getWeekNumber(date));
     setActiveDayIndex(getDay(date) === 0 || getDay(date) === 6 ? 0 : getDayIndex(date));
  };

  const checkOverrides = async () => {
    await loadProfileData(currentProfileId, isTeacherView ? ProfileType.TEACHER : ProfileType.STUDENT, selectedDate);
    showMessage("Данные обновлены");
  };

  const toggleApplyOverrides = () => {
    const newValue = !applyOverrides;
    setApplyOverrides(newValue);
    if (newValue && overrides && overrides.overrides && overrides.overrides.length > 0) { 
      showMessage('Замены применены'); 
    } else if (!newValue) { 
      showMessage('Показывается исходное расписание'); 
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
    const currentDayOfWeek = getDayIndex(targetDate); 
    const diff = activeDayIndex - currentDayOfWeek;
    targetDate.setDate(targetDate.getDate() + diff);
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
      const selectedId = localStorage.getItem('selectedId');
      const userType = localStorage.getItem('userType') as ProfileType;
      if (!selectedId) { navigate('/'); return; }
      if (userType && userType !== appState.lastUsed) { await dataStore.setLastUsed(userType); }
      await loadProfileData(selectedId, userType || ProfileType.STUDENT, selectedDate);
    };
    initializeData();
  }, [navigate]);

  useEffect(() => {
      if(!currentProfileId || !hasInitialized.current) return;
      const metadata = dataStore.getProfileMetadata(currentProfileId);
      scheduleApi.getInfo(
          currentProfileId, 
          dateKey, 
          metadata.scheduleUpdate, 
          metadata.eventsHash || ""
      ).then(res => {
          if (res && res.overrides) {
              const normalized = {
                ...res.overrides,
                overrides: res.overrides.overrides.map((o: any) => ({
                    ...o,
                    shouldBe: normalizeLesson(o.shouldBe),
                    willBe: normalizeLesson(o.willBe)
                }))
              };
              setOverrides(normalized);
          } else { setOverrides(null); }
          if (res && res.schedule) { setFullSchedule(res.schedule); }
      }).catch(err => {
          console.error('Info fetch error:', err);
          setOverrides(null);
      });
  }, [dateKey, currentProfileId]);

  useEffect(() => {
    if (!fullSchedule) { setDisplaySchedule(null); return; }
    const newSchedule = JSON.parse(JSON.stringify(fullSchedule)) as Schedule;
    const currentWeekData = newSchedule.weeks?.[activeWeekIndex % 2];
    const blockingEvent = calendarEvents.find(event => {
        if (event.type === 'attestation' || event.type === 'holiday') return false; 
        const start = startOfDay(parseISO(event.dateStart));
        const end = endOfDay(parseISO(event.dateEnd));
        return isWithinInterval(selectedDate, { start, end });
    });
    if (blockingEvent) {
         if (currentWeekData) {
             const day = currentWeekData.days[activeDayIndex];
             if (day) day.lessons = day.lessons.map(() => ({ 
                commonLesson: { name: blockingEvent.title, teacher: '—', room: '—', group: '' } 
             }));
         }
         setDisplaySchedule(newSchedule);
         return; 
    }
    if (!applyOverrides || !overrides) { setDisplaySchedule(newSchedule); return; }
    const isAttestation = overrides.practiceCode === '::' || overrides.practiceCode === ':';
    const isHoliday = overrides.practiceCode === '=' || overrides.practiceCode === '*';
    if (overrides.isPractice && overrides.isBlocking && !isAttestation && !isHoliday) {
        if (currentWeekData) {
            const day = currentWeekData.days[activeDayIndex];
            if (day) {
                const practicePlaceholder = { 
                    commonLesson: { name: overrides.practiceTitle || "Практика", teacher: "", room: overrides.practiceCode || "—", group: "" } 
                };
                day.lessons = day.lessons.map(() => practicePlaceholder);
            }
        }
    }
    const { overrides: overrideList } = overrides;
    if (overrideList && overrideList.length > 0 && currentWeekData) {
      const day = currentWeekData.days[activeDayIndex];
      if (day && day.lessons) {
        overrideList.forEach(override => {
          if (day.lessons[override.index] !== undefined) {
             const originalLesson = day.lessons[override.index];
             const overrideWillBe = override.willBe;
             if (isTeacherView) {
                day.lessons[override.index] = overrideWillBe;
             } else {
                 if (originalLesson?.subgroupedLesson && overrideWillBe?.noLesson) {
                    const shouldBeTeacher = override.shouldBe.commonLesson?.teacher;
                    if (shouldBeTeacher) {
                       const teacherLastName = shouldBeTeacher.split(' ')[0];
                       const remainingSubgroups = originalLesson.subgroupedLesson.subgroups.filter(
                          (sub: any) => !sub.teacher.includes(teacherLastName)
                       );
                       if (remainingSubgroups.length > 0) {
                          day.lessons[override.index] = { subgroupedLesson: { name: originalLesson.subgroupedLesson.name, subgroups: remainingSubgroups } };
                       } else { day.lessons[override.index] = { noLesson: {} }; }
                    } else { day.lessons[override.index] = overrideWillBe; }
                 } else if (originalLesson?.subgroupedLesson && overrideWillBe?.subgroupedLesson) {
                    day.lessons[override.index] = processSubgroupedOverride(originalLesson, overrideWillBe);
                 } else { day.lessons[override.index] = overrideWillBe; }
             }
          }
        });
      }
    }
    setDisplaySchedule(newSchedule);
  }, [fullSchedule, overrides, applyOverrides, calendarEvents, selectedDate.getTime(), activeWeekIndex, activeDayIndex, isTeacherView]);

  const lessonsToShow = useMemo(() => {
     const baseLessons = displaySchedule?.weeks?.[activeWeekIndex % 2]?.days?.[activeDayIndex]?.lessons;
     const lessonCount = activeDayIndex === 1 ? 6 : 5;
     const lessonsArray = Array.from({ length: lessonCount }, (_, i) => {
         if (activeDayIndex === 1) {
             if (i === 3) return { noLesson: {} };
             else if (i < 3) return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} };
             else { const baseIndex = i - 1; return (baseLessons && baseLessons[baseIndex]) ? baseLessons[baseIndex] : { noLesson: {} }; }
         } else { return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} }; }
     });
     const myCourses = appState.customCourses.filter(c => c.weekIndex === activeWeekIndex && c.dayIndex === activeDayIndex && c.profileId === currentProfileId);
     myCourses.sort((a, b) => a.lessonIndex - b.lessonIndex);
     myCourses.forEach(course => {
        const index = course.lessonIndex;
        if (index >= 0 && index < lessonCount) {
            let targetIndex = index;
            if (activeDayIndex === 1 && index >= 3) targetIndex = index + 1;
            if (targetIndex >= 0 && targetIndex < lessonCount) {
              if (lessonsArray[targetIndex].noLesson || Object.keys(lessonsArray[targetIndex]).length === 0) {
                 lessonsArray[targetIndex] = { commonLesson: { name: course.name, teacher: course.teacher, room: course.room, group: course.teacher } };
                 (lessonsArray[targetIndex] as any).customCourseId = course.id;
              }
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
      if (isTuesday && index === 3) {
        return ( <ScheduleItem key="class-hour" lesson={{ commonLesson: { name: 'Классный час', teacher: '', room: '', group: '' } }} index={index} isCurrent={isCurrent} isTuesday={true} isClassHour={true} onClick={() => {}} activeDayIndex={activeDayIndex} /> );
      }
      return ( <ScheduleItem key={customCourseId || index} lesson={lesson} index={index} isCurrent={isCurrent} isTuesday={isTuesday} hasNote={hasNoteForLesson(index)} onSubgroupChange={handleSubgroupChange} savedSubgroup={lessonData.subgroup} isTeacherView={isTeacherView} customCourseId={customCourseId} activeDayIndex={activeDayIndex} onClick={() => { if (lesson && !lesson.noLesson) setEditingLessonIndex(index); }} /> );
    });
  };

  const lessonToEdit = (lessonsToShow && editingLessonIndex !== null) ? lessonsToShow[editingLessonIndex] : null;
  const currentLessonData = editingLessonIndex !== null ? getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, editingLessonIndex) : { notes: '', subgroup: 0 };
  const isWeekCurrent = activeWeekIndex === getWeekNumber(new Date());

  const practiceInfo = useMemo<PracticeInfo | null>(() => {
    let info: PracticeInfo | null = null;
    const upcomingHoliday = findUpcomingEvent(calendarEvents, selectedDate, 4);
    if (upcomingHoliday) {
        info = upcomingHoliday;
    } else if (overrides && (overrides.isPractice || overrides.practiceTitle)) {
       const title = overrides.practiceTitle || "Событие";
       const code = overrides.practiceCode || "";
       let type: 'practice' | 'attestation' | 'holiday' | 'gia' | 'session' = 'practice';
       if (code === '::' || title.toLowerCase().includes('аттестация')) type = 'attestation';
       else if (['III', 'D'].includes(code)) type = 'gia';
       else if (code === '=') type = 'holiday';
       const dateStart = overrides.dateStart ? parseISO(overrides.dateStart) : selectedDate;
       const dateEnd = overrides.dateEnd ? parseISO(overrides.dateEnd) : null;
       const returnDate = overrides.returnDate ? parseISO(overrides.returnDate) : null;
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const daysUntil = differenceInCalendarDays(dateStart, today);
       info = { name: title, type: type, dateStart: dateStart, dateEnd: dateEnd, returnDate: returnDate, daysUntil: daysUntil, isActive: daysUntil <= 0 };
    } else {
       info = findNextPractice(displaySchedule, activeWeekIndex, selectedDate);
    }
    if (isTeacherView && info) {
        const nameLower = info.name.toLowerCase();
        const isAllowed = 
            nameLower.includes('промежуточная аттестация') || 
            nameLower.includes('каникулы') || 
            nameLower.includes('государственная итоговая аттестация') || 
            nameLower.includes('подготовка к государственной итоговой аттестации');
        return isAllowed ? info : null;
    }
    return info;
  }, [calendarEvents, selectedDate.getTime(), overrides, displaySchedule, activeWeekIndex, isTeacherView]);

  const handlePracticeClick = () => { if (practiceInfo) setIsPracticeModalOpen(true); };

  const currentWeekDates = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  }, [selectedDate]);

  return (
    <>
      <style>{` 
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Icons&display=block'); 

        :root {
          font-family: 'Inter', sans-serif !important;
        }

        .calendar-day.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; background: rgba(255,255,255,0.05); }
        
        .tab-button-content { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          gap: 1px; 
          padding: 4px 0;
          font-family: 'Inter', sans-serif;
        }

        .tab-day-name { 
          font-size: 14px; 
          font-weight: 700; 
          color: var(--color-text);
          opacity: 0.6;
        }

        .tab-day-date { 
          font-size: 14px; 
          font-weight: 700; 
          color: var(--color-text); 
          white-space: nowrap; 
          opacity: 0.6;
        }

        .tab-button.active .tab-day-name,
        .tab-button.active .tab-day-date { color: #8c67f6; opacity: 1; }
        .tab-indicator { margin-top: 4px !important; height: 3px !important; border-radius: 4px !important; }
      `}</style>
      <div className="container" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="schedule-header">
          <h2 className="schedule-title" style={{ fontWeight: 800 }}>Расписание</h2>
          <button id="tour-menu" className="menu-button" onClick={() => setIsMenuOpen(true)}><Icon name="more_vert" /></button>
        </div>
        <div id="tour-profile">
            <ProfileSwitcher key={appState.lastUsed} profiles={appState.profiles} currentProfileType={appState.lastUsed} onSwitch={handleProfileSwitch} onAddProfile={handleAddProfile} isLoading={isSwitchingProfile} />
        </div>
        <PracticeBanner info={practiceInfo} onClick={handlePracticeClick} />
        <PracticeDetailsModal isOpen={isPracticeModalOpen} onClose={() => setIsPracticeModalOpen(false)} info={practiceInfo} />
        <div id="tour-days" className={`schedule-tabs-container ${swipeLimitReached ? 'limit-reached' : ''}`} ref={tabsContainerRef}>
          <div className="schedule-tabs" ref={tabsRef}>
            {DAYS_OF_WEEK.map((day, index) => (
              <button key={day} className={`tab-button ${activeDayIndex === index ? 'active' : ''} ${isAnimating ? 'no-transition' : ''}`} onClick={() => handleDayChange(index)} disabled={isAnimating || isSwitchingProfile}>
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
          {isLoading && (<div className="loading-state"><div className="loading-spinner"></div><p>Загрузка данных...</p></div>)}
          {error && (<div className="error-state"><Icon name="error" style={{ fontSize: '24px', marginBottom: '8px' }} /><p>{error}</p><button onClick={() => window.location.reload()} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Обновить</button></div>)}
          {!isLoading && !error && renderLessons()}
          {!error && (<div className="overrides-toggle-container" style={{ marginTop: '16px', marginBottom: '0' }}><button className={`overrides-toggle ${applyOverrides ? 'active' : ''}`} onClick={toggleApplyOverrides} disabled={isSwitchingProfile}><Icon name="swap_horiz" /><span>Учитывать замены</span>{applyOverrides && (overrides?.overrides?.length || 0) > 0 && (<span className="overrides-badge">{overrides!.overrides.length}</span>)}</button></div>)}
        </div>
        <DropdownMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onCheckOverrides={checkOverrides} onOpenHistory={() => setIsHistoryOpen(true)} onOpenNotes={() => setIsNotesModalOpen(true)} onInstallApp={() => {}} onAddCourse={() => { setIsMenuOpen(false); setIsAddCourseOpen(true); }} onStartTour={startTour} />
        <AddCourseModal isOpen={isAddCourseOpen} onClose={() => setIsAddCourseOpen(false)} activeWeek={activeWeekIndex} activeDay={activeDayIndex} schedule={fullSchedule} overrides={applyOverrides ? overrides : null} profileId={currentProfileId} />
        <CustomCalendar isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} onSelectDate={handleDateSelect} currentDate={selectedDate} calendarEvents={calendarEvents} />
        <NoteModal lesson={lessonToEdit} onClose={() => setEditingLessonIndex(null)} onSave={handleSaveNote} savedNote={currentLessonData.notes} savedSubgroup={currentLessonData.subgroup} />
        <Snackbar message={snackbarMessage || ''} isVisible={showSnackbar} onClose={() => { setShowSnackbar(false); setSnackbarLink(null); }} link={snackbarLink} linkText={snackbarLinkText} />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} isTeacherView={isTeacherView} />
        <AllNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} profileId={currentProfileId} schedule={fullSchedule} />
        <div id="tour-nav-panel" className="week-switcher-container">
          <button className="back-button" onClick={() => navigate('/')} title="Назад"><Icon name="arrow_back" /></button>
          <button className="week-switcher-button" onClick={handleWeekSwitch}>
            <div className="week-text">
              <span className="week-name">{activeWeekIndex === 0 ? 'Первая' : 'Вторая'} неделя</span>
              {isWeekCurrent ? ( <span className="week-current"><Icon name="schedule" style={{ fontSize: '14px' }} /> Текущая</span> ) : ( <span className="week-current" style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-surface-variant)' }}> <Icon name="next_plan" style={{ fontSize: '14px' }} /> Следующая </span> )}
            </div>
          </button>
          <button className="calendar-button" onClick={() => setIsCalendarOpen(true)} title="Календарь"><Icon name="event" /></button>
        </div>
      </div>
    </>
  );
}