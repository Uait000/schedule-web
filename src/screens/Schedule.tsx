import { useNavigate } from 'react-router-dom';
import ScheduleItem, { isLessonCurrent } from '../components/ScheduleItem';
import { NoteModal } from '../components/NoteModal';
import { Schedule, OverridesResponse, Lesson } from '../types'; // Удален Day
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'; 
import { getISOWeek, getDay, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { fetchData, API_BASE_URL } from '../api';

interface LessonData {
  notes: string;
  subgroup: number;
}

const DAYS_OF_WEEK = [ 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота' ];

export function normalizeLesson(lesson: Lesson) {
  if (lesson == null) {
    return { noLesson: {} };
  }
  
  return lesson;
}

function getWeekNumber(date: Date): number {
  const weekOfYear = getISOWeek(date);
  return weekOfYear % 2 === 0 ? 0 : 1;
}

function getDayIndex(date: Date): number {
  const day = getDay(date);
  return day === 0 ? 6 : day - 1;
}

function getLessonKey(week: number, day: number, lesson: number): string {
  return `note_${week}_${day}_${lesson}`;
}

function getSavedLessonData(week: number, day: number, lesson: number): LessonData {
  const key = getLessonKey(week, day, lesson);
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : { notes: '', subgroup: 0 };
  } catch (e) {
    return { notes: '', subgroup: 0 };
  }
}

function saveLessonData(week: number, day: number, lesson: number, data: LessonData) {
  const key = getLessonKey(week, day, lesson);
  localStorage.setItem(key, JSON.stringify(data));
}

const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

function CustomCalendar({ isOpen, onClose, onSelectDate, currentDate }: {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  currentDate: Date;
}) {
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
        if (!isNaN(newDate.getTime()) && 
            newDate.getDate() === day && 
            newDate.getMonth() === month && 
            newDate.getFullYear() === year) {
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

  const handleKeyPress = (event: React.KeyboardEvent) => {
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
          <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="calendar-nav-btn">
            <Icon name="chevron_left" />
          </button>
          <span className="calendar-month-year">
            {format(viewDate, 'LLLL yyyy', { locale: ru })}
          </span>
          <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="calendar-nav-btn">
            <Icon name="chevron_right" />
          </button>
        </div>

        <div style={{ 
          marginBottom: '16px', 
          padding: '0 8px' 
        }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-text)',
            marginBottom: '8px'
          }}>
            Введите дату:
          </label>
          <input
            type="text"
            value={dateInput}
            onChange={handleDateInputChange}
            onKeyPress={handleKeyPress}
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
          {!isValid && (
            <div style={{
              color: '#ff4444',
              fontSize: '12px',
              marginTop: '4px',
              textAlign: 'center'
            }}>
              Неверная дата
            </div>
          )}
        </div>

        <div className="calendar-weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-days">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty"></div>
          ))}
          {days.map((day) => (
            <button
              key={day.toString()}
              className={`calendar-day ${isSameDay(day, currentDate) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
              onClick={() => handleDayClick(day)}
              title={format(day, 'd MMMM yyyy', { locale: ru })}
            >
              {format(day, 'd')}
            </button>
          ))}
        </div>

        <div className="calendar-footer">
          <button onClick={onClose} className="calendar-cancel-btn">
            <Icon name="close" />
            Закрыть
          </button>
          <button onClick={handleTodayClick} className="calendar-today-btn">
            <Icon name="today" />
            Сегодня
          </button>
        </div>
      </div>
    </div>
  );
}

function DropdownMenu({ isOpen, onClose, onCheckOverrides }: { 
  isOpen: boolean; 
  onClose: () => void;
  onCheckOverrides: () => void;
}) {
  const navigate = useNavigate();
  
  if (!isOpen) return null;

  const handleMenuClick = (action: string) => {
    onClose();
    if (action === 'overrides') {
      onCheckOverrides();
    } else if (action === 'changeGroup') {
      localStorage.removeItem('selectedId');
      navigate('/');
    } else if (action === 'feedback') {
      window.open('https://t.me/ttgt1bot', '_blank');
    }
  };

  return (
    <div className="dropdown-backdrop" onClick={onClose}>
      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
        <button className="dropdown-item" onClick={() => handleMenuClick('overrides')}>
          <Icon name="sync_alt" />
          <span>Проверить изменения</span>
        </button>
        <button className="dropdown-item" onClick={() => handleMenuClick('changeGroup')}>
          <Icon name="group" />
          <span>Поменять группу</span>
        </button>
        <button className="dropdown-item" onClick={() => handleMenuClick('feedback')}>
          <Icon name="feedback" />
          <span>Обратная связь</span>
        </button>
      </div>
    </div>
  );
}

function Snackbar({ message, isVisible, onClose }: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 2000,
      maxWidth: '90%',
      textAlign: 'center',
      animation: 'fadeIn 0.3s ease'
    }}>
      {message}
    </div>
  );
}

export function ScheduleScreen() {
  const navigate = useNavigate();
  const scheduleListRef = useRef<HTMLDivElement>(null);
  
  const [fullSchedule, setFullSchedule] = useState<Schedule | null>(null);
  const [displaySchedule, setDisplaySchedule] = useState<Schedule | null>(null);
  const [overrides, setOverrides] = useState<OverridesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(() => getWeekNumber(new Date())); 
  const [activeDayIndex, setActiveDayIndex] = useState(() => getDayIndex(new Date())); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCheckingOverrides, setIsCheckingOverrides] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [applyOverrides, setApplyOverrides] = useState(() => {
    const saved = localStorage.getItem('applyOverrides');
    return saved ? JSON.parse(saved) : true;
  });

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50; 
    
    if (Math.abs(distance) < minSwipeDistance) return;

    if (distance > 0) {
      setActiveDayIndex(prev => (prev + 1) % DAYS_OF_WEEK.length);
    } else {
      setActiveDayIndex(prev => (prev - 1 + DAYS_OF_WEEK.length) % DAYS_OF_WEEK.length);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd]);

  useEffect(() => {
    if (!fullSchedule) {
      setDisplaySchedule(null);
      return;
    }

    if (!applyOverrides || !overrides || !overrides.overrides || overrides.overrides.length === 0) {
      setDisplaySchedule(fullSchedule);
      return;
    }

    const newSchedule = JSON.parse(JSON.stringify(fullSchedule)) as Schedule;
    const { weekNum, weekDay, overrides: overrideList } = overrides;
    
    if (newSchedule.weeks[weekNum] && newSchedule.weeks[weekNum].days[weekDay]) {
      overrideList.forEach(override => {
        if (newSchedule.weeks[weekNum].days[weekDay].lesson[override.index]) {
          newSchedule.weeks[weekNum].days[weekDay].lesson[override.index] = override.willBe;
        }
      });
    }

    setDisplaySchedule(newSchedule);
  }, [fullSchedule, overrides, applyOverrides]);

  const showMessage = (message: string) => {
    setSnackbarMessage(message);
    setShowSnackbar(true);
  };

  const checkOverrides = async () => {
    if (isCheckingOverrides) return;
    setIsCheckingOverrides(true);
    setIsMenuOpen(false);

    try {
      const selectedId = localStorage.getItem('selectedId');
      
      console.log('🔍 Проверка замен для:', { selectedId });
      
      if (!selectedId) {
        showMessage('Ошибка: не выбрана группа/преподаватель');
        return;
      }

      const newOverrides = await fetchData(`/${selectedId}/overrides`);
      
      console.log('✅ Получены замены:', newOverrides);
      
      setOverrides(newOverrides);

      // Сохраняем для всех пользователей
      const currentOverrides = localStorage.getItem('overrides');
      const overridesData = currentOverrides ? JSON.parse(currentOverrides) : {};
      overridesData[selectedId] = newOverrides;
      localStorage.setItem('overrides', JSON.stringify(overridesData));

      if (newOverrides.overrides && newOverrides.overrides.length > 0) {
        showMessage(`Обнаружены изменения: ${newOverrides.overrides.length} замен`);
      } else {
        showMessage('Изменений не обнаружено');
      }
    } catch (error) {
      console.error('❌ Ошибка при проверке изменений:', error);
      showMessage('Ошибка при загрузке изменений');
    } finally {
      setIsCheckingOverrides(false);
    }
  };

  const toggleApplyOverrides = () => {
    const newValue = !applyOverrides;
    setApplyOverrides(newValue); 
    localStorage.setItem('applyOverrides', JSON.stringify(newValue));
    
    if (newValue && overrides && overrides.overrides && overrides.overrides.length > 0) {
      showMessage('Замены применены');
    } else if (!newValue) {
      showMessage('Показывается исходное расписание');
    }
  };

  useEffect(() => {
    const selectedId = localStorage.getItem('selectedId');
    if (!selectedId) {
      navigate('/');
      return;
    }

    const schedulePromise = fetchData(`/${selectedId}/schedule`)
    
    // Загружаем замены для всех пользователей
    const storedOverridesRaw = localStorage.getItem('overrides');
    const storedOverrides = storedOverridesRaw ? JSON.parse(storedOverridesRaw)[selectedId] : null;
    
    const overridesPromise = storedOverrides 
      ? Promise.resolve(storedOverrides)
      : fetchData(`/${selectedId}/overrides`)

    Promise.all([schedulePromise, overridesPromise])
      .then(([scheduleData, overridesData]) => {
        if (scheduleData.weeks && Array.isArray(scheduleData.weeks)) {
          scheduleData.weeks = scheduleData.weeks.map((week: any)=>{
            week.days = week.days.map((day: any)=>{
              day.lesson = day.lesson.map(normalizeLesson)
              return day
            })
            return week
          })
          console.log('📅 Расписание:', scheduleData)
          setFullSchedule(scheduleData);
        } else {
          setError('Ошибка: Расписание пришло в неверном формате.');
        }
        
        // Обрабатываем замены для всех пользователей
        if (overridesData) {
          overridesData.overrides = overridesData.overrides.map((override: any)=>{
            override.shouldBe = normalizeLesson(override.shouldBe)
            override.willBe = normalizeLesson(override.willBe)
            return override
          })
          
          console.log('🔄 Замены:', overridesData)
          setOverrides(overridesData);

          // Сохраняем замены для всех пользователей
          if (!storedOverrides) {
            const currentOverrides = localStorage.getItem('overrides');
            const overridesDataObj = currentOverrides ? JSON.parse(currentOverrides) : {};
            overridesDataObj[selectedId] = overridesData;
            localStorage.setItem('overrides', JSON.stringify(overridesDataObj));
            console.log('💾 Сохранены замены для:', selectedId)
          }
        }
      })
      .catch(err => {
        console.error('Ошибка при загрузке данных!', err);
        setError('Не удалось загрузить расписание. Проверьте подключение к серверу.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [navigate]); 

  const hasNoteForLesson = (lessonIndex: number): boolean => {
    const lessonData = getSavedLessonData(activeWeekIndex, activeDayIndex, lessonIndex);
    return lessonData.notes.trim().length > 0;
  };

  const handleSaveNote = (notes: string, subgroup: number) => {
    if (editingLessonIndex === null) return;
    saveLessonData(activeWeekIndex, activeDayIndex, editingLessonIndex, { notes, subgroup });
    setDataVersion(v => v + 1);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setActiveWeekIndex(getWeekNumber(date));
    setActiveDayIndex(getDayIndex(date));
  };
  
  const lessonsToShow = useMemo(() => {
    const baseLessons = displaySchedule?.weeks?.[activeWeekIndex]?.days?.[activeDayIndex]?.lesson || [];
    const lessonsArray = Array.isArray(baseLessons) ? baseLessons : [];
    return lessonsArray.slice(0, 5).map(lesson=>lesson ? lesson : {noLesson: {}});
  }, [displaySchedule, activeWeekIndex, activeDayIndex]);
  
  const renderLessonsWithClassHour = () => {
    const isTuesday = activeDayIndex === 1;
    const isTodayActive = activeDayIndex === getDayIndex(new Date()) && 
                         activeWeekIndex === getWeekNumber(new Date());

    if (isTuesday) {
      const result = [];
      
      for (let i = 0; i < 3 && i < lessonsToShow.length; i++) {
        const isCurrent = isTodayActive && isLessonCurrent(i, true);
        result.push(
          <ScheduleItem 
            key={i}
            lesson={lessonsToShow[i]} 
            index={i} 
            isCurrent={isCurrent}
            isTuesday={true}
            hasNote={hasNoteForLesson(i)} 
            onClick={() => {
              if (!lessonsToShow[i].noLesson) {
                setEditingLessonIndex(i);
              }
            }}
          />
        );
      }
      
      const classHourIndex = 3;
      const isClassHourCurrent = isTodayActive && isLessonCurrent(classHourIndex, true);
      result.push(
        <ScheduleItem 
          key="class-hour"
          lesson={{ commonLesson: { name: 'Классный час', teacher: '', room: '' } }} 
          index={classHourIndex} 
          isCurrent={isClassHourCurrent}
          isTuesday={true}
          isClassHour={true}
          onClick={() => {}}
        />
      );
      
      if (lessonsToShow.length > 3) {
        const lessonIndex4 = 3;
        const displayIndex4 = 4;
        const isCurrent4 = isTodayActive && isLessonCurrent(displayIndex4, true);
        result.push(
          <ScheduleItem 
            key={displayIndex4}
            lesson={lessonsToShow[lessonIndex4]} 
            index={displayIndex4} 
            isCurrent={isCurrent4}
            isTuesday={true}
            hasNote={hasNoteForLesson(lessonIndex4)}
            onClick={() => {
              if (!lessonsToShow[lessonIndex4].noLesson) {
                setEditingLessonIndex(lessonIndex4);
              }
            }}
          />
        );

        if (lessonsToShow.length > 4) {
          const lessonIndex5 = 4;
          const displayIndex5 = 5;
          const isCurrent5 = isTodayActive && isLessonCurrent(displayIndex5, true);
          result.push(
            <ScheduleItem 
              key={displayIndex5}
              lesson={lessonsToShow[lessonIndex5]} 
              index={displayIndex5} 
              isCurrent={isCurrent5}
              isTuesday={true}
              hasNote={hasNoteForLesson(lessonIndex5)} 
              onClick={() => {
                if (!lessonsToShow[lessonIndex5].noLesson) {
                  setEditingLessonIndex(lessonIndex5);
                }
              }}
            />
          );
        }
      }
      
      return result;
    }
    
    return lessonsToShow.map((lesson, index) => {
      const isCurrent = isTodayActive && isLessonCurrent(index, false);
      
      return (
        <ScheduleItem 
          key={index} 
          lesson={lesson} 
          index={index} 
          isCurrent={isCurrent}
          hasNote={hasNoteForLesson(index)} 
          onClick={() => {
            if (!lesson.noLesson) {
              setEditingLessonIndex(index);
            }
          }}
        />
      );
    });
  };

  const lessonToEdit = editingLessonIndex !== null ? lessonsToShow[editingLessonIndex] : null;
  const currentLessonData = editingLessonIndex !== null ? getSavedLessonData(activeWeekIndex, activeDayIndex, editingLessonIndex) : { notes: '', subgroup: 0 };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Material+Icons&display=swap');
      `}</style>
      
      <div className="container">
        <div className="schedule-header">
          <h2 className="schedule-title">Расписание</h2>
          <button className="menu-button" onClick={() => setIsMenuOpen(true)}>
            <Icon name="more_vert" />
          </button>
        </div>

        <div className="schedule-tabs-container">
          <div className="schedule-tabs">
            {DAYS_OF_WEEK.map((day, index) => (
              <button
                key={day}
                className={activeDayIndex === index ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveDayIndex(index)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div 
          className="schedule-list" 
          data-version={dataVersion}
          ref={scheduleListRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-y' }}
        > 
          {isLoading && <p>Загрузка расписания...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          {!isLoading && !error && lessonsToShow.length > 0 ? (
              renderLessonsWithClassHour()
          ) : (
             !isLoading && !error && (
                <div className="lesson-card empty">
                   <span className="lesson-name">Нет расписания для этой недели/дня.</span>
                </div>
             )
          )}

          <div className="overrides-toggle-container" style={{ marginTop: '16px', marginBottom: '0' }}>
            <button 
              className={`overrides-toggle ${applyOverrides ? 'active' : ''}`}
              onClick={toggleApplyOverrides}
            >
              <Icon name="swap_horiz" />
              <span>Учитывать замены</span>
              {applyOverrides && overrides && overrides.overrides && overrides.overrides.length > 0 && (
                <span className="overrides-badge">{overrides.overrides.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="week-switcher-container">
          <button className="back-button" onClick={() => navigate('/')} title="Назад">
            <Icon name="arrow_back" />
          </button>
          
          <button 
            className="week-switcher-button"
            onClick={() => setActiveWeekIndex(prev => (prev === 0 ? 1 : 0))}
            disabled={!fullSchedule || (fullSchedule.weeks && fullSchedule.weeks.length < 2)}
          >
            <div className="week-text">
              <span className="week-name">{activeWeekIndex === 0 ? 'Первая' : 'Вторая'} неделя</span>
              {activeWeekIndex === getWeekNumber(new Date()) && (
                <span className="week-current">
                  <Icon name="schedule" style={{ fontSize: '14px' }} />
                  Текущая
                </span>
              )}
            </div>
          </button>

          <button className="calendar-button" onClick={() => setIsCalendarOpen(true)} title="Выбрать дату">
            <Icon name="event" />
          </button>
        </div>

        <DropdownMenu 
          isOpen={isMenuOpen} 
          onClose={() => setIsMenuOpen(false)} 
          onCheckOverrides={checkOverrides}
        />
        <CustomCalendar 
          isOpen={isCalendarOpen} 
          onClose={() => setIsCalendarOpen(false)} 
          onSelectDate={handleDateSelect} 
          currentDate={selectedDate} 
        />
        <NoteModal 
          lesson={lessonToEdit} 
          onClose={() => setEditingLessonIndex(null)} 
          onSave={handleSaveNote} 
          savedNote={currentLessonData.notes} 
          savedSubgroup={currentLessonData.subgroup} 
        />
        
        <Snackbar 
          message={snackbarMessage || ''} 
          isVisible={showSnackbar} 
          onClose={() => setShowSnackbar(false)} 
        />

        {/* Отладочная информация */}
        <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
          <p><strong>Прямое подключение к:</strong> {API_BASE_URL}</p>
          <p><strong>Тип пользователя:</strong> {localStorage.getItem('userType')}</p>
          <p><strong>ID:</strong> {localStorage.getItem('selectedId')}</p>
          <p><strong>Замены:</strong> {overrides?.overrides?.length || 0} шт.</p>
          <p><strong>Применяются замены:</strong> {applyOverrides ? 'Да' : 'Нет'}</p>
        </div>
      </div>
    </>
  );
}