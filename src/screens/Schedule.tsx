import { useNavigate } from 'react-router-dom';
import ScheduleItem, { isLessonCurrent } from '../components/ScheduleItem';
import { NoteModal } from '../components/NoteModal';
import { AddCourseModal } from '../components/AddCourseModal';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { AllNotesModal } from '../components/AllNotesModal';
import { Schedule, OverridesResponse, Lesson } from '../types';
import { ProfileType } from '../types/profiles';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'; 
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { fetchData } from '../api'; 
import { useScheduleState } from '../hooks/useScheduleState';
import { getDayIndex, getWeekNumber } from '../utils/dateUtils';
import { useHistoryStorage } from '../hooks/useHistoryStorage';
import { HistoryModal } from '../components/HistoryModal';
import { dataStore } from '../utils/DataStore';

interface LessonData {
  notes: string;
  subgroup: number;
  lastUpdated?: number;
}

const DAYS_OF_WEEK = [ 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота' ];

function findGroupAnywhere(obj: any): string | undefined {
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
}

// 🔥 УНИВЕРСАЛЬНАЯ ФУНКЦИЯ: Группировка подгрупп только для СТУДЕНТОВ
function groupSubgroups(lessons: any[], isTeacherView: boolean): any[] {
  if (!lessons || !Array.isArray(lessons)) return lessons;
  
  // 🔥 ВАЖНО: Для преподавателей НЕ группируем подгруппы
  if (isTeacherView) {
    console.log('👨‍🏫 Режим преподавателя - пропускаем группировку подгрупп');
    return lessons;
  }
  
  const groupedLessons = [];
  const subgroupMap = new Map();
  
  // 🔥 КАРТА ПРЕПОДАВАТЕЛЕЙ ДЛЯ АВТОМАТИЧЕСКОГО ОПРЕДЕЛЕНИЯ ПОДГРУПП
  const teacherSubgroupMap = new Map();
  
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    
    // 🔥 ИСПРАВЛЕНИЕ: Ищем подгруппы в оригинальном расписании
    if (lesson && lesson.subgroupedLesson) {
      // Уже сгруппированный урок - оставляем как есть
      groupedLessons.push(lesson);
    } else if (lesson && lesson.commonLesson && lesson.commonLesson.teacher) {
      const lessonName = lesson.commonLesson.name;
      const teacher = lesson.commonLesson.teacher;
      
      // 🔥 АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ: Если у одного предмета несколько преподавателей - это подгруппы
      if (!subgroupMap.has(lessonName)) {
        subgroupMap.set(lessonName, {
          subgroupedLesson: {
            name: lessonName,
            subgroups: []
          }
        });
      }
      
      const groupedLesson = subgroupMap.get(lessonName);
      
      // 🔥 АВТОМАТИЧЕСКОЕ ПРИСВОЕНИЕ НОМЕРОВ ПОДГРУПП
      let subgroupIndex = 1;
      
      // Если преподаватель уже встречался для этого предмета - используем тот же номер
      const teacherKey = `${lessonName}_${teacher}`;
      if (teacherSubgroupMap.has(teacherKey)) {
        subgroupIndex = teacherSubgroupMap.get(teacherKey);
      } else {
        // Новый преподаватель для этого предмета - назначаем следующий номер
        const existingSubgroups = groupedLesson.subgroupedLesson.subgroups.length;
        subgroupIndex = existingSubgroups + 1;
        teacherSubgroupMap.set(teacherKey, subgroupIndex);
      }
      
      // Проверяем, нет ли уже такой подгруппы
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
        
        console.log(`🔥 Автоматически определена подгруппа: ${lessonName} - ${teacher} (п/г ${subgroupIndex})`);
      }
    } else {
      // Обычный урок
      groupedLessons.push(lesson);
    }
  }
  
  // 🔥 ФИЛЬТРАЦИЯ: Оставляем как подгруппы только те предметы, у которых действительно есть несколько подгрупп
  subgroupMap.forEach((groupedLesson, lessonName) => {
    if (groupedLesson.subgroupedLesson.subgroups.length > 1) {
      // Находим позицию для вставки (первое вхождение этого предмета)
      const firstIndex = lessons.findIndex(lesson => 
        lesson && lesson.commonLesson && lesson.commonLesson.name === lessonName
      );
      
      if (firstIndex !== -1) {
        groupedLessons[firstIndex] = groupedLesson;
        console.log(`✅ Сгруппирован предмет с подгруппами: ${lessonName}`, groupedLesson.subgroupedLesson.subgroups);
      }
    } else {
      // Если подгруппа всего одна - оставляем как обычный урок
      console.log(`⚠️ Предмет ${lessonName} имеет только одну подгруппу, оставляем как обычный урок`);
    }
  });
  
  console.log('🔥 Универсальная группировка подгрупп:', { original: lessons, grouped: groupedLessons });
  return groupedLessons;
}

export function normalizeLesson(lesson: any): Lesson {
  console.log('🔧 normalizeLesson input:', lesson);
  
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }

  // 🔥 ИСПРАВЛЕНИЕ: Обрабатываем случай, когда willBe: null из API
  if (lesson === null) {
    return { noLesson: {} };
  }

  const globalGroup = findGroupAnywhere(lesson);

  const common = lesson.CommonLesson || lesson.commonLesson;
  if (common) {
    const localGroup = findGroupAnywhere(common);
    const result = {
      commonLesson: {
        name: common.name || '',
        teacher: common.teacher || '',
        room: common.room || '',
        group: localGroup || globalGroup 
      }
    };
    console.log('🔧 Normalized common lesson:', result);
    return result;
  }

  const subgrouped = lesson.SubgroupedLesson || lesson.subgroupedLesson;
  if (subgrouped) {
    const result = {
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
    console.log('🔧 Normalized subgrouped lesson:', result);
    return result;
  }
  
  // 🔥 ДОБАВЛЕНО: Обработка прямых полей (как в вашем примере из API)
  if (lesson.name || lesson.teacher || lesson.room) {
    console.log('🔧 Обнаружены прямые поля урока:', lesson);
    
    // Если есть subgroup_index - это подгруппа
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
    
    // Иначе обычная пара
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || globalGroup
      }
    };
  }
  
  if (Object.keys(lesson).length === 0 || (lesson.noLesson)) {
     return { noLesson: {} };
  }

  if (globalGroup) {
    return { commonLesson: { name: '?', teacher: '?', room: '?', group: globalGroup } };
  }
  
  console.log('🔧 Неизвестный формат урока, возвращаем noLesson');
  return { noLesson: {} };
}

function getSavedLessonData(profileId: string, week: number, day: number, lesson: number): LessonData {
  const specificKey = `note_${profileId}_${week}_${day}_${lesson}`;
  const globalKey = `note_${week}_${day}_${lesson}`;

  try {
    let data = localStorage.getItem(specificKey);
    if (!data) {
        data = localStorage.getItem(globalKey);
    }
    return data ? JSON.parse(data) : { notes: '', subgroup: 0 };
  } catch (e) {
    return { notes: '', subgroup: 0 };
  }
}

function saveLessonData(profileId: string, week: number, day: number, lesson: number, data: LessonData) {
  const key = `note_${profileId}_${week}_${day}_${lesson}`;
  localStorage.setItem(key, JSON.stringify(data));
}

const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

// --- UI Components ---
function CustomCalendar({ isOpen, onClose, onSelectDate, currentDate }: { isOpen: boolean; onClose: () => void; onSelectDate: (date: Date) => void; currentDate: Date; }) { 
  const [viewDate, setViewDate] = useState(currentDate); 
  const [dateInput, setDateInput] = useState(format(currentDate, 'dd.MM.yyyy')); 
  const [isValid, setIsValid] = useState(true); 
  
  if (!isOpen) return null; 
  
  const monthStart = startOfMonth(viewDate); 
  const monthEnd = endOfMonth(viewDate); 
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }); 
  const firstDayOfMonth = getDay(monthStart); 
  const startPadding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
  
  const handleDayClick = (date: Date) => { 
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
        } else { 
          setIsValid(false); 
        } 
      } else { 
        setIsValid(false); 
      } 
    } else { 
      setIsValid(true); 
    } 
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
          {days.map((day) => ( 
            <button key={day.toString()} className={`calendar-day ${isSameDay(day, currentDate) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`} onClick={() => handleDayClick(day)} title={format(day, 'd MMMM yyyy', { locale: ru })}>{format(day, 'd')}</button> 
          ))} 
        </div> 
        <div className="calendar-footer"> 
          <button onClick={onClose} className="calendar-cancel-btn"><Icon name="close" />Закрыть</button> 
          <button onClick={handleTodayClick} className="calendar-today-btn"><Icon name="today" />Сегодня</button> 
        </div> 
      </div> 
    </div> 
  ); 
}

function DropdownMenu({ isOpen, onClose, onCheckOverrides, onOpenHistory, onAddCourse, onOpenNotes, onInstallApp }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCheckOverrides: () => void; 
  onOpenHistory: () => void; 
  onAddCourse: () => void; 
  onOpenNotes: () => void;
  onInstallApp: () => void;
}) { 
  const navigate = useNavigate(); 
  if (!isOpen) return null; 
  
  const handleMenuClick = (action: string) => { 
    onClose(); 
    if (action === 'overrides') { 
      onCheckOverrides(); 
    } else if (action === 'history') { 
      onOpenHistory(); 
    } else if (action === 'addCourse') { 
      onAddCourse(); 
    } else if (action === 'notes') {
      onOpenNotes();
    } else if (action === 'install') {
      onInstallApp();
    } else if (action === 'changeGroup') { 
      localStorage.removeItem('selectedId'); 
      localStorage.removeItem('userType'); 
      navigate('/', { replace: true }); 
    } else if (action === 'feedback') { 
      window.open('https://t.me/ttgt1bot', '_blank'); 
    } 
  }; 
  
  return ( 
    <div className="dropdown-backdrop" onClick={onClose}> 
      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}> 
        <button className="dropdown-item" onClick={() => handleMenuClick('overrides')}><Icon name="sync_alt" /><span>Проверить изменения</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('history')}><Icon name="history" /><span>История замен</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('notes')}><Icon name="description" /><span>Мои заметки</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('addCourse')}><Icon name="add_circle" /><span>Добавить курс</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('install')}><Icon name="download" /><span>Установить приложение</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('changeGroup')}><Icon name="group" /><span>Поменять группу</span></button> 
        <button className="dropdown-item" onClick={() => handleMenuClick('feedback')}><Icon name="feedback" /><span>Обратная связь</span></button> 
      </div> 
    </div> 
  ); 
}

// 🔥 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ ИЗМЕНЕНИЙ В ПОДГРУППАХ
function processSubgroupedOverride(originalLesson: Lesson, overrideWillBe: Lesson): Lesson {
  console.log('🔥 processSubgroupedOverride:', { originalLesson, overrideWillBe });
  
  // Если оригинальная пара не подгруппированная - просто возвращаем замену
  if (!originalLesson.subgroupedLesson) {
    return overrideWillBe;
  }

  const originalName = originalLesson.subgroupedLesson.name;
  
  // 🔥 ИСПРАВЛЕНИЕ: Если willBe null - это значит пару сняли для всех подгрупп
  if (!overrideWillBe || overrideWillBe.noLesson) {
    console.log('🔥 Пара снята для всех подгрупп');
    return { noLesson: {} };
  }

  // Если замена не подгруппированная - полная замена
  if (!overrideWillBe.subgroupedLesson) {
    return overrideWillBe;
  }

  const overrideName = overrideWillBe.subgroupedLesson.name;
  
  // Если названия предметов не совпадают - полная замена
  if (originalName !== overrideName) {
    return overrideWillBe;
  }

  // 🔥 ОСНОВНОЕ ИСПРАВЛЕНИЕ: Объединяем подгруппы с правильной логикой
  const originalSubgroups = originalLesson.subgroupedLesson.subgroups || [];
  const overrideSubgroups = overrideWillBe.subgroupedLesson.subgroups || [];
  
  console.log('🔥 Подгруппы:', { originalSubgroups, overrideSubgroups });
  
  // Создаем карту подгрупп из оригинала
  const originalSubgroupsMap = new Map();
  originalSubgroups.forEach(sub => {
    const key = sub.subgroup_index || 0;
    originalSubgroupsMap.set(key, { ...sub });
  });
  
  // 🔥 УНИВЕРСАЛЬНАЯ ОБРАБОТКА: Обновляем подгруппы из замены
  overrideSubgroups.forEach(overrideSub => {
    const key = overrideSub.subgroup_index || 0;
    
    // 🔥 УЛУЧШЕННОЕ ОПРЕДЕЛЕНИЕ СНЯТИЯ ПОДГРУППЫ
    const isCancelled = (
      (overrideSub.teacher === 'нет' || !overrideSub.teacher || overrideSub.teacher === 'null' || overrideSub.teacher === '' || overrideSub.teacher === 'null') ||
      (overrideSub.room === 'нет' || !overrideSub.room || overrideSub.room === 'null' || overrideSub.room === '' || overrideSub.room === 'null') ||
      (overrideSub.group === 'нет' || !overrideSub.group || overrideSub.group === 'null' || overrideSub.group === '' || overrideSub.group === 'null')
    );
    
    if (isCancelled) {
      console.log(`🔥 Удаляем подгруппу ${key} - пара снята`);
      originalSubgroupsMap.delete(key);
    } else {
      // Иначе обновляем данные подгруппы
      console.log(`🔥 Обновляем подгруппу ${key}`, overrideSub);
      originalSubgroupsMap.set(key, overrideSub);
    }
  });
  
  // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Если осталась хотя бы одна подгруппа - показываем пару
  if (originalSubgroupsMap.size === 0) {
    console.log('🔥 Все подгруппы удалены - пара снята полностью');
    return { noLesson: {} };
  }
  
  // Сортируем подгруппы по номеру для красивого отображения
  const sortedSubgroups = Array.from(originalSubgroupsMap.values())
    .sort((a, b) => (a.subgroup_index || 0) - (b.subgroup_index || 0));
  
  // Возвращаем объединенную подгруппированную пару
  const result = {
    subgroupedLesson: {
      name: originalName,
      subgroups: sortedSubgroups
    }
  };
  
  console.log('🔥 Результат обработки подгрупп:', result);
  return result;
}

// 🔥 УЛУЧШЕННЫЙ SNACKBAR С ССЫЛКОЙ
function Snackbar({ 
  message, 
  isVisible, 
  onClose, 
  link, 
  linkText 
}: { 
  message: string; 
  isVisible: boolean; 
  onClose: () => void; 
  link?: string | null;
  linkText?: string;
}) { 
  useEffect(() => { 
    if (isVisible) { 
      const timer = setTimeout(() => { 
        onClose(); 
      }, 5000);
      return () => clearTimeout(timer); 
    } 
  }, [isVisible, onClose]); 
  
  if (!isVisible) return null; 
  
  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (link) {
      window.open(link, '_blank');
    }
    onClose();
  };

  const handleContainerClick = () => {
    onClose();
  };
  
  return ( 
    <div 
      style={{ 
        position: 'fixed', 
        bottom: '100px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        backgroundColor: 'var(--color-surface)', 
        color: 'var(--color-text)', 
        padding: '0',
        borderRadius: '16px', 
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', 
        zIndex: 2000, 
        maxWidth: '320px', 
        width: '90%',
        animation: 'fadeIn 0.3s ease',
        border: '1px solid var(--color-border)',
        overflow: 'hidden'
      }}
      onClick={handleContainerClick}
    > 
      <div style={{ 
        padding: '16px 20px',
        borderBottom: link ? '1px solid var(--color-border)' : 'none'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '4px'
        }}>
          <Icon name="info" style={{ 
            fontSize: '20px', 
            color: 'var(--color-primary)',
            marginRight: '8px'
          }} />
          <span style={{ fontWeight: '600', fontSize: '16px' }}>Обновление</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '14px', lineHeight: '1.4' }}>
          {message} 
        </div>
      </div>
      
      {link && (
        <div style={{ padding: '12px 20px' }}>
          <button 
            onClick={handleLinkClick}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Icon name="open_in_new" style={{ fontSize: '18px', marginRight: '8px' }} />
            {linkText || 'Посмотреть на сайте'}
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isCheckingOverrides, setIsCheckingOverrides] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarLink, setSnackbarLink] = useState<string | null>(null);
  const [snackbarLinkText, setSnackbarLinkText] = useState<string>('Посмотреть на сайте');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  
  const currentProfileId = localStorage.getItem('selectedId') || 'default';
  const isTeacherView = appState.lastUsed === ProfileType.TEACHER; // 🔥 ДОБАВЛЕНО: Определяем режим преподавателя
  
  const { history, addHistoryEntry } = useHistoryStorage(currentProfileId);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeLimitReached, setSwipeLimitReached] = useState(false);

  const scrollToActiveDay = useCallback((dayIndex: number) => {
    if (!tabsRef.current) return;
    
    const tabButtons = tabsRef.current.querySelectorAll('.tab-button');
    if (tabButtons[dayIndex]) {
      const tabElement = tabButtons[dayIndex] as HTMLElement;
      const container = tabsRef.current;
      
      const tabLeft = tabElement.offsetLeft;
      const tabWidth = tabElement.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = tabLeft - (containerWidth / 2) + (tabWidth / 2);
      
      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    scrollToActiveDay(activeDayIndex);
  }, [activeDayIndex, scrollToActiveDay]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToActiveDay(activeDayIndex);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [activeDayIndex, scrollToActiveDay]);

  useEffect(() => {
    if (isCalendarOpen || isMenuOpen || isAddCourseOpen || isNotesModalOpen || isHistoryOpen || editingLessonIndex !== null) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isCalendarOpen, isMenuOpen, isAddCourseOpen, isNotesModalOpen, isHistoryOpen, editingLessonIndex]);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = (window.navigator as any).standalone || isStandalone;
    
    if (!isInstalled) {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        (window as any).deferredPrompt = e;
      };
      
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  // 🔥 ФУНКЦИЯ ДЛЯ ПОКАЗА СООБЩЕНИЙ С ССЫЛКОЙ
  const showMessageWithLink = (message: string, link: string, linkText: string) => {
    setSnackbarMessage(message);
    setSnackbarLink(link);
    setSnackbarLinkText(linkText);
    setShowSnackbar(true);
  };

  const showMessage = (message: string) => { 
    setSnackbarMessage(message); 
    setSnackbarLink(null);
    setShowSnackbar(true); 
  };

  const handleInstallApp = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ Пользователь установил приложение');
        showMessage('Приложение установлено!');
      } else {
        showMessage('Установка отменена');
      }
      
      (window as any).deferredPrompt = null;
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        showMessage('Нажмите "Поделиться" → "На экран «Домой»"');
      } else {
        showMessage('Нажмите "Три точки" → "На главный Экран"');
      }
    }
  };

  useEffect(() => { 
    const unsubscribe = dataStore.subscribe((newState) => { 
      setAppState(newState); 
    }); 
    return unsubscribe; 
  }, []);

  const handleAddProfile = () => { 
    navigate('/', { state: { fromAddProfile: true } }); 
  };

  const handleProfileSwitch = async (newType: ProfileType, newProfile: any) => {
    if (isSwitchingProfile) return;
    setIsSwitchingProfile(true);
    try {
      await dataStore.setLastUsed(newType);
      localStorage.setItem('selectedId', newProfile.id);
      localStorage.setItem('userType', newType);
      await loadProfileData(newProfile.id, newType);
      showMessage(`Переключено на: ${newProfile.name}`);
    } catch (error) {
      console.error('❌ Ошибка при переключении профиля:', error);
      showMessage('Ошибка при загрузке данных профиля');
    } finally { setIsSwitchingProfile(false); }
  };

  const loadProfileData = async (profileId: string, profileType: ProfileType) => {
    if (!profileId) return;
    setIsLoading(true);
    setError(null);
    try {
      const state = dataStore.getState();
      const cachedProfile = state.profiles[profileType];
      
      let isCacheValid = false;
      if (cachedProfile?.schedule) {
        isCacheValid = true;
        if (profileType === ProfileType.TEACHER) isCacheValid = false;
        if (cachedProfile.name === 'Студент' || cachedProfile.name === 'Преподаватель') isCacheValid = false;
      }

      if (isCacheValid && cachedProfile?.schedule) {
        console.log('✅ Используем валидный кэш');
        setFullSchedule(cachedProfile.schedule);
        setOverrides(cachedProfile.overrides || null);
        setIsLoading(false);
        return;
      }

      console.log('🔄 Загружаем свежие данные с сервера...');
      
      // 🔥 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК ПРИ ЗАГРУЗКЕ
      try {
        const [scheduleData, overridesData] = await Promise.all([
          fetchData(`/${profileId}/schedule`),
          fetchData(`/${profileId}/overrides`).catch(overridesError => {
            console.warn('⚠️ Не удалось загрузить замены, используем пустые данные:', overridesError);
            return { overrides: [] }; // Возвращаем пустые замены при ошибке
          })
        ]);

        let normalizedSchedule = scheduleData;
        if (scheduleData && scheduleData.weeks && Array.isArray(scheduleData.weeks)) {
          normalizedSchedule = {
            ...scheduleData,
            weeks: scheduleData.weeks.map((week: any) => {
              if (week && week.days && Array.isArray(week.days)) {
                return {
                  ...week,
                  days: week.days.map((day: any) => {
                    if (day && day.lessons && Array.isArray(day.lessons)) {
                      // 🔥 ИСПРАВЛЕНИЕ: Группируем подгруппы только для СТУДЕНТОВ
                      const groupedLessons = groupSubgroups(day.lessons, profileType === ProfileType.TEACHER);
                      return { ...day, lessons: groupedLessons.map(normalizeLesson) };
                    }
                    return { ...day, lessons: [] };
                  })
                };
              }
              return { ...week, days: [] };
            })
          };
          setFullSchedule(normalizedSchedule);
        }

        let normalizedOverrides = overridesData;
        if (overridesData) {
          if (overridesData.overrides && Array.isArray(overridesData.overrides)) {
            normalizedOverrides = {
              ...overridesData,
              overrides: overridesData.overrides.map((override: any) => ({
                ...override,
                shouldBe: normalizeLesson(override.shouldBe),
                willBe: normalizeLesson(override.willBe)
              }))
            };
          } else { 
            normalizedOverrides = { ...overridesData, overrides: [] }; 
          }
          setOverrides(normalizedOverrides);
          addHistoryEntry(normalizedOverrides);
        } else {
          // Если замены не загрузились, устанавливаем пустые
          setOverrides({ overrides: [] });
        }

        await dataStore.updateData(state => ({
          ...state,
          profiles: {
            ...state.profiles,
            [profileType]: {
              type: profileType,
              id: profileId,
              name: profileId, 
              schedule: normalizedSchedule,
              overrides: normalizedOverrides || { overrides: [] }
            }
          }
        }));
        console.log('✅ Данные обновлены и кэш исправлен');

      } catch (fetchError) {
        console.error('❌ Ошибка при загрузке данных с сервера:', fetchError);
        
        // 🔥 ПОКАЗЫВАЕМ ИНФОРМАТИВНОЕ СООБЩЕНИЕ ОБ ОШИБКЕ
        if (fetchError instanceof Error) {
          if (fetchError.message.includes('500')) {
            setError('Сервер временно недоступен. Используем кэшированные данные.');
          } else if (fetchError.message.includes('404')) {
            setError('Данные не найдены. Проверьте правильность группы/преподавателя.');
          } else {
            setError(`Ошибка загрузки: ${fetchError.message}`);
          }
        } else {
          setError('Неизвестная ошибка при загрузке данных');
        }
        
        // 🔥 ПЫТАЕМСЯ ИСПОЛЬЗОВАТЬ КЭШ ДАЖЕ ЕСЛИ ОН НЕ ВАЛИДЕН
        if (cachedProfile?.schedule) {
          console.log('🔄 Используем невалидный кэш из-за ошибки сервера');
          setFullSchedule(cachedProfile.schedule);
          setOverrides(cachedProfile.overrides || { overrides: [] });
        }
      }

    } catch (err) {
      console.error('❌ Общая ошибка при загрузке данных профиля:', err);
      setError('Не удалось загрузить расписание. Проверьте подключение к интернету.');
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      const selectedId = localStorage.getItem('selectedId');
      const userType = localStorage.getItem('userType') as ProfileType;
      if (!selectedId) { navigate('/'); return; }
      if (userType && userType !== appState.lastUsed) { await dataStore.setLastUsed(userType); }
      await loadProfileData(selectedId, userType || ProfileType.STUDENT);
    };
    initializeData();
  }, [navigate]);

  useEffect(() => {
    const performAutoCheck = async () => {
      const selectedId = localStorage.getItem('selectedId');
      if (!selectedId || !fullSchedule) return;
      try {
        const overridesData: OverridesResponse = await fetchData(`/${selectedId}/overrides`).catch(error => {
          console.warn('⚠️ Авто-проверка замен не удалась:', error);
          return null; // Возвращаем null при ошибке
        });
        
        if (!overridesData) return; // Пропускаем если ошибка
        
        const currentStr = JSON.stringify(overrides);
        let normalizedNew = null;
        if (overridesData && overridesData.overrides) {
           normalizedNew = {
            ...overridesData,
            overrides: overridesData.overrides.map((override: any) => ({
              ...override,
              shouldBe: normalizeLesson(override.shouldBe),
              willBe: normalizeLesson(override.willBe)
            }))
          };
        }
        const newStr = JSON.stringify(normalizedNew);
        if (normalizedNew && normalizedNew.overrides && normalizedNew.overrides.length > 0) {
          if (currentStr !== newStr) {
              console.log('⚡️ Найдены новые замены (auto)');
              setOverrides(normalizedNew);
              addHistoryEntry(normalizedNew);
              await dataStore.updateData(state => ({
                ...state,
                profiles: {
                  ...state.profiles,
                  [state.lastUsed]: { ...state.profiles[state.lastUsed], overrides: normalizedNew }
                }
              }));
              if (currentStr !== 'null') {
                 // 🔥 АВТО-ПРОВЕРКА БЕЗ КНОПКИ - ТОЛЬКО ПРОСТОЕ СООБЩЕНИЕ
                 showMessage(`Пришли новые замены (${normalizedNew.overrides.length})`);
              }
          }
        }
      } catch (error) { 
        console.error('❌ Ошибка авто-проверки замен:', error);
        // Не показываем ошибку пользователю для авто-проверки
      }
    };
    if (fullSchedule) { performAutoCheck(); }
    const intervalId = setInterval(performAutoCheck, 60000);
    return () => clearInterval(intervalId);
  }, [activeWeekIndex, currentProfileId, fullSchedule]);

  // 🔥 ИСПРАВЛЕННЫЙ useEffect ДЛЯ ПРИМЕНЕНИЯ ЗАМЕН С УНИВЕРСАЛЬНОЙ ОБРАБОТКОЙ ПОДГРУПП
  useEffect(() => {
    if (!fullSchedule) { 
      setDisplaySchedule(null); 
      return; 
    }
    
    if (!applyOverrides || !overrides || !overrides.overrides || overrides.overrides.length === 0) { 
      setDisplaySchedule(fullSchedule); 
      return; 
    }

    console.log('🔥 ПРИМЕНЯЕМ ЗАМЕНЫ:', overrides);
    
    const newSchedule = JSON.parse(JSON.stringify(fullSchedule)) as Schedule;
    const { weekNum, weekDay, overrides: overrideList } = overrides;

    if (newSchedule.weeks && newSchedule.weeks[weekNum] && newSchedule.weeks[weekNum].days && newSchedule.weeks[weekNum].days[weekDay]) {
      const dayLessons = newSchedule.weeks[weekNum].days[weekDay].lessons;
      
      if (dayLessons && Array.isArray(dayLessons)) {
        overrideList.forEach(override => {
          if (dayLessons[override.index] !== undefined) {
            const originalLesson = dayLessons[override.index];
            const overrideWillBe = override.willBe;
            
            console.log('🔥 Обрабатываем замену:', {
              index: override.index,
              original: originalLesson,
              willBe: overrideWillBe,
              shouldBe: override.shouldBe
            });
            
            // 🔥 ВАЖНО: Для преподавателей применяем замены как обычно, без специальной обработки подгрупп
            if (isTeacherView) {
              // 🔥 РЕЖИМ ПРЕПОДАВАТЕЛЯ: Простая замена без обработки подгрупп
              dayLessons[override.index] = overrideWillBe;
            } else {
              // 🔥 РЕЖИМ СТУДЕНТА: Универсальная обработка подгрупп
              if (originalLesson?.subgroupedLesson && overrideWillBe?.noLesson) {
                
                console.log('🔥 Обрабатываем снятие подгруппы:', originalLesson.subgroupedLesson.name);
                
                // Находим подгруппу по преподавателю из shouldBe
                const shouldBeTeacher = override.shouldBe.commonLesson?.teacher;
                if (shouldBeTeacher) {
                  // 🔥 УНИВЕРСАЛЬНЫЙ ПОИСК: Ищем подгруппу по преподавателю (сравниваем по фамилии)
                  const teacherLastName = shouldBeTeacher.split(' ')[0]; // Берем фамилию
                  
                  const remainingSubgroups = originalLesson.subgroupedLesson.subgroups.filter(
                    (sub: any) => !sub.teacher.includes(teacherLastName)
                  );
                  
                  if (remainingSubgroups.length > 0) {
                    // Оставляем остальные подгруппы
                    dayLessons[override.index] = {
                      subgroupedLesson: {
                        name: originalLesson.subgroupedLesson.name,
                        subgroups: remainingSubgroups
                      }
                    };
                    console.log('🔥 Оставлены подгруппы:', remainingSubgroups);
                  } else {
                    // Все подгруппы удалены - снимаем пару
                    dayLessons[override.index] = { noLesson: {} };
                    console.log('🔥 Все подгруппы удалены - пара снята полностью');
                  }
                } else {
                  // Обычная замена для остальных случаев
                  dayLessons[override.index] = overrideWillBe;
                }
              }
              // 🔥 ИСПРАВЛЕНИЕ: Специальная обработка для подгруппированных пар
              else if (originalLesson?.subgroupedLesson && overrideWillBe?.subgroupedLesson) {
                // Обрабатываем изменения в подгруппах
                dayLessons[override.index] = processSubgroupedOverride(originalLesson, overrideWillBe);
              } else if (overrideWillBe && overrideWillBe.noLesson) {
                // 🔥 ДОБАВЛЕНО: Если пару сняли полностью
                dayLessons[override.index] = overrideWillBe;
              } else {
                // Обычная замена для остальных случаев
                dayLessons[override.index] = overrideWillBe;
              }
            }
          }
        });
      }
    }
    setDisplaySchedule(newSchedule);
  }, [fullSchedule, overrides, applyOverrides, isTeacherView]);

  const handleTouchStart = (e: React.TouchEvent) => { setTouchStart(e.targetTouches[0].clientX); setSwipeLimitReached(false); };
  const handleTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || isAnimating) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      setIsAnimating(true);
      const wouldExceedLimit = isLeftSwipe && activeDayIndex >= 5;
      const wouldGoBeforeMonday = isRightSwipe && activeDayIndex <= 0;
      if (wouldExceedLimit || wouldGoBeforeMonday) {
        setSwipeLimitReached(true);
        scheduleListRef.current?.classList.add('swipe-limit');
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => { scheduleListRef.current?.classList.remove('swipe-limit'); setIsAnimating(false); }, 500);
        return;
      }
      scheduleListRef.current?.classList.add(isLeftSwipe ? 'slide-left' : 'slide-right');
      setTimeout(() => {
        setActiveDayIndex(prev => isLeftSwipe ? prev + 1 : prev - 1);
        setTimeout(() => { scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); setIsAnimating(false); }, 300);
      }, 150);
    }
    setTouchStart(null); setTouchEnd(null);
  }, [touchStart, touchEnd, isAnimating, activeDayIndex, setActiveDayIndex]);

  const handleDayChange = (newIndex: number) => {
    if (isAnimating || newIndex === activeDayIndex) return;
    if (newIndex > 5 || newIndex < 0) {
      setSwipeLimitReached(true);
      scheduleListRef.current?.classList.add('swipe-limit');
      setTimeout(() => { scheduleListRef.current?.classList.remove('swipe-limit'); setSwipeLimitReached(false); }, 500);
      return;
    }
    setIsAnimating(true);
    const direction = newIndex > activeDayIndex ? 'slide-left' : 'slide-right';
    scheduleListRef.current?.classList.add(direction);
    setTimeout(() => {
      setActiveDayIndex(newIndex);
      setTimeout(() => { scheduleListRef.current?.classList.remove('slide-left', 'slide-right'); setIsAnimating(false); }, 300);
    }, 150);
  };

  // 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ ПРОВЕРКИ ЗАМЕН - КНОПКА "ПОСМОТРЕТЬ НА САЙТЕ" ПОЯВЛЯЕТСЯ ВСЕГДА
  const checkOverrides = async () => {
  if (isCheckingOverrides) return;
  setIsCheckingOverrides(true);
  setIsMenuOpen(false);
  
  // 🔥 ДОБАВЛЕНО: Параметр для обхода кэша
  const timestamp = new Date().getTime();
  const websiteUrl = `https://ttgt.org/images/pdf/zamena.pdf?t=${timestamp}`;
  const linkText = 'Посмотреть на сайте';
  
  try {
    const selectedId = localStorage.getItem('selectedId');
    if (!selectedId) { 
      showMessageWithLink('Ошибка: не выбрана группа/преподаватель', websiteUrl, linkText);
      return; 
    }
    
    const newOverrides: OverridesResponse = await fetchData(`/${selectedId}/overrides`);
    
    if (newOverrides && newOverrides.overrides && newOverrides.overrides.length > 0) {
      const normalizedOverrides = {
        ...newOverrides,
        overrides: newOverrides.overrides.map((override: any) => ({
          ...override,
          shouldBe: normalizeLesson(override.shouldBe),
          willBe: normalizeLesson(override.willBe)
        }))
      };
      setOverrides(normalizedOverrides);
      addHistoryEntry(normalizedOverrides);
      await dataStore.updateData(state => ({
        ...state,
        profiles: { ...state.profiles, [state.lastUsed]: { ...state.profiles[state.lastUsed], overrides: normalizedOverrides } }
      }));
      
      showMessageWithLink(
        `Обнаружены изменения: ${newOverrides.overrides.length} замен`,
        websiteUrl,
        linkText
      );
    } else { 
      showMessageWithLink(
        'Изменений не обнаружено',
        websiteUrl, 
        linkText
      );
    }
  } catch (error) { 
    console.error('❌ Ошибка при проверке изменений:', error); 
    
    showMessageWithLink(
      'Ошибка при загрузке изменений',
      websiteUrl,
      linkText
    );
  } finally { 
    setIsCheckingOverrides(false); 
  }
};
  const toggleApplyOverrides = () => {
    const newValue = !applyOverrides;
    setApplyOverrides(newValue);
    if (newValue && overrides && overrides.overrides && overrides.overrides.length > 0) { showMessage('Замены применены'); } else if (!newValue) { showMessage('Показывается исходное расписание'); }
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

    saveLessonData(currentProfileId, activeWeekIndex, activeDayIndex, editingLessonIndex, { 
      notes, 
      subgroup,
      lastUpdated: targetDate.getTime() 
    });
    setDataVersion(v => v + 1);
  };

  const handleDateSelect = (date: Date) => { setSelectedDate(date); setActiveWeekIndex(getWeekNumber(date)); setActiveDayIndex(getDayIndex(date)); };
  
  const hasNoteForLesson = (lessonIndex: number): boolean => {
    const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, lessonIndex);
    return lessonData.notes.trim().length > 0;
  };

  useEffect(() => {
    const checkDate = () => {
      const now = new Date();
      const currentDateString = now.toDateString();
      const lastCheck = localStorage.getItem('last-date-check');
      if (lastCheck !== currentDateString) { resetToToday(); localStorage.setItem('last-date-check', currentDateString); }
    };
    checkDate();
    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, [resetToToday]);

  // 🔥 ИСПРАВЛЕННЫЙ lessonsToShow
  const lessonsToShow = useMemo(() => {
    const baseLessons = displaySchedule?.weeks?.[activeWeekIndex]?.days?.[activeDayIndex]?.lessons;
    
    // Для вторника - 6 пар (включая классный час как отдельную позицию)
    const lessonCount = activeDayIndex === 1 ? 6 : 5;
    
    const lessonsArray = Array.from({ length: lessonCount }, (_, i) => {
      if (activeDayIndex === 1) {
        // Для вторника:
        // Индексы 0,1,2 - 1,2,3 пары (baseLessons[0], [1], [2])
        // Индекс 3 - классный час (специальная позиция)
        // Индексы 4,5 - 4,5 пары (baseLessons[3], [4])
        
        if (i === 3) {
          // Позиция для классного часа - всегда пустая
          return { noLesson: {} };
        } else if (i < 3) {
          // 1,2,3 пары
          return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} };
        } else {
          // 4,5 пары (i=4,5 → baseLessons[3,4])
          const baseIndex = i - 1; // Смещаем на 1 из-за классного часа
          return (baseLessons && baseLessons[baseIndex]) ? baseLessons[baseIndex] : { noLesson: {} };
        }
      } else {
        // Для остальных дней - обычная логика
        return (baseLessons && baseLessons[i]) ? baseLessons[i] : { noLesson: {} };
      }
    });

    const myCourses = appState.customCourses.filter(
      c => c.weekIndex === activeWeekIndex && 
           c.dayIndex === activeDayIndex && 
           c.profileId === currentProfileId 
    );

    myCourses.sort((a, b) => a.lessonIndex - b.lessonIndex);

    myCourses.forEach(course => {
      const index = course.lessonIndex; 
      if (index >= 0 && index < lessonCount) {
        let targetIndex = index;
        if (activeDayIndex === 1 && index >= 3) {
          targetIndex = index + 1; // Смещаем для 4+ пар из-за классного часа
        }
        
        if (targetIndex >= 0 && targetIndex < lessonCount) {
          if (lessonsArray[targetIndex].noLesson || Object.keys(lessonsArray[targetIndex]).length === 0) {
            lessonsArray[targetIndex] = {
              commonLesson: {
                name: course.name,
                teacher: course.teacher,
                room: course.room,
                group: course.teacher 
              }
            };
            (lessonsArray[targetIndex] as any).customCourseId = course.id;
          }
        }
      }
    });

    return lessonsArray;
  }, [displaySchedule, activeWeekIndex, activeDayIndex, appState.customCourses, currentProfileId]);

  // 🔥 ИСПРАВЛЕННЫЙ renderLessons
  const renderLessons = () => {
    return lessonsToShow.map((lesson, index) => {
      const isTuesday = activeDayIndex === 1;
      const isCurrent = isLessonCurrent(index, activeDayIndex, isTuesday);
      const lessonData = getSavedLessonData(currentProfileId, activeWeekIndex, activeDayIndex, index);
      const customCourseId = lesson ? (lesson as any).customCourseId : undefined;
      
      // 🔥 Классный час на позиции 3
      if (isTuesday && index === 3) {
        return (
          <ScheduleItem 
            key="class-hour" 
            lesson={{ commonLesson: { name: 'Классный час', teacher: '', room: '' } }} 
            index={index}
            isCurrent={isCurrent} 
            isTuesday={true} 
            isClassHour={true} 
            onClick={() => {}} 
            activeDayIndex={activeDayIndex} 
          />
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

  return (
    <>
      <style>{` @import url('https://fonts.googleapis.com/css2?family=Material+Icons&display=swap'); `}</style>
      <div className="container">
        <div className="schedule-header">
          <h2 className="schedule-title">Расписание</h2>
          <button className="menu-button" onClick={() => setIsMenuOpen(true)}><Icon name="more_vert" /></button>
        </div>
        <ProfileSwitcher key={appState.lastUsed} profiles={appState.profiles} currentProfileType={appState.lastUsed} onSwitch={handleProfileSwitch} onAddProfile={handleAddProfile} isLoading={isSwitchingProfile} />
        
        <div className={`schedule-tabs-container ${swipeLimitReached ? 'limit-reached' : ''}`} ref={tabsContainerRef}>
          <div className="schedule-tabs" ref={tabsRef}>
            {DAYS_OF_WEEK.map((day, index) => (
              <button key={day} className={`tab-button ${activeDayIndex === index ? 'active' : ''} ${isAnimating ? 'no-transition' : ''} ${index === 5 && swipeLimitReached ? 'reached-limit' : ''}`} onClick={() => handleDayChange(index)} disabled={isAnimating || isSwitchingProfile}>
                <span className="tab-button-content">{day}{activeDayIndex === index && <div className="tab-indicator" />}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="schedule-list" data-version={dataVersion} ref={scheduleListRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ touchAction: 'pan-y' }}>
          {isLoading && (<div className="loading-state"><div className="loading-spinner"></div><p>Загрузка расписания...</p></div>)}
          {error && (<div className="error-state"><Icon name="error" style={{ fontSize: '24px', marginBottom: '8px' }} /><p>{error}</p><button onClick={() => window.location.reload()} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Перезагрузить</button></div>)}
          
          {!isLoading && !error && renderLessons()}

          {!error && (<div className="overrides-toggle-container" style={{ marginTop: '16px', marginBottom: '0' }}><button className={`overrides-toggle ${applyOverrides ? 'active' : ''}`} onClick={toggleApplyOverrides} disabled={isSwitchingProfile}><Icon name="swap_horiz" /><span>Учитывать замены</span>{applyOverrides && (overrides?.overrides?.length || 0) > 0 && (<span className="overrides-badge">{overrides!.overrides.length}</span>)}</button></div>)}
        </div>
        
        <DropdownMenu 
          isOpen={isMenuOpen} 
          onClose={() => setIsMenuOpen(false)} 
          onCheckOverrides={checkOverrides} 
          onOpenHistory={() => setIsHistoryOpen(true)} 
          onOpenNotes={() => setIsNotesModalOpen(true)}
          onInstallApp={handleInstallApp}
          onAddCourse={() => { setIsMenuOpen(false); setIsAddCourseOpen(true); }} 
        />
        
        <AddCourseModal 
            isOpen={isAddCourseOpen} 
            onClose={() => setIsAddCourseOpen(false)} 
            activeWeek={activeWeekIndex} 
            activeDay={activeDayIndex}
            schedule={fullSchedule}
            overrides={applyOverrides ? overrides : null}
            profileId={currentProfileId}
        />
        
        <CustomCalendar isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} onSelectDate={handleDateSelect} currentDate={selectedDate} />
        <NoteModal lesson={lessonToEdit} onClose={() => setEditingLessonIndex(null)} onSave={handleSaveNote} savedNote={currentLessonData.notes} savedSubgroup={currentLessonData.subgroup} />
        
        <Snackbar 
          message={snackbarMessage || ''} 
          isVisible={showSnackbar} 
          onClose={() => {
            setShowSnackbar(false);
            setSnackbarLink(null);
            setSnackbarLinkText('Посмотреть на сайте');
          }}
          link={snackbarLink}
          linkText={snackbarLinkText}
        />
        
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} isTeacherView={isTeacherView} />
        
        <AllNotesModal 
          isOpen={isNotesModalOpen} 
          onClose={() => setIsNotesModalOpen(false)} 
          profileId={currentProfileId} 
          schedule={fullSchedule}
        />
      
        <div className="week-switcher-container">
          <button className="back-button" onClick={() => navigate('/')} title="Назад"><Icon name="arrow_back" /></button>
          <button className="week-switcher-button" onClick={() => setActiveWeekIndex(prev => (prev === 0 ? 1 : 0))}><div className="week-text"><span className="week-name">{activeWeekIndex === 0 ? 'Первая' : 'Вторая'} неделя</span>{activeWeekIndex === getWeekNumber(new Date()) && <span className="week-current"><Icon name="schedule" style={{ fontSize: '14px' }} /> Текущая</span>}</div></button>
          <button className="calendar-button" onClick={() => setIsCalendarOpen(true)} title="Календарь"><Icon name="event" /></button>
        </div>
      </div>
    </>
  );
}