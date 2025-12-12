// src/components/ScheduleItem.tsx

import { Lesson } from '../types';
import '../App.css'; 
import { dataStore } from '../utils/DataStore';
import { getCurrentDayIndex } from '../utils/dateUtils';

const LESSON_TIMES = [
  { start: '08:00', end: '09:30' },
  { start: '09:40', end: '11:10' },
  { start: '11:50', end: '13:20' },
  { start: '13:30', end: '15:00' },
  { start: '15:10', end: '16:40' },
];

const TUESDAY_SPECIAL_TIMES = [
  { start: '08:00', end: '09:30' },
  { start: '09:40', end: '11:10' },
  { start: '11:50', end: '13:20' },
  { start: '13:30', end: '14:15', isClassHour: true }, 
  { start: '14:25', end: '15:55' },
  { start: '16:05', end: '17:35' },
];

interface ScheduleItemProps {
  lesson: Lesson | null;
  index: number;
  onClick: () => void;
  isCurrent?: boolean;
  isTuesday?: boolean;
  isClassHour?: boolean;
  hasNote?: boolean; 
  isTeacherView?: boolean;
  onSubgroupChange?: (lessonIndex: number, subgroup: number) => void;
  savedSubgroup?: number;
  customTime?: string;
  customCourseId?: string;
  activeDayIndex?: number;
}

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const isLessonCurrent = (lessonIndex: number, activeDayIndex: number, isTuesday: boolean = false): boolean => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDayIndex = getCurrentDayIndex();
  
  if (activeDayIndex !== currentDayIndex) {
    return false;
  }
  
  const times = isTuesday ? TUESDAY_SPECIAL_TIMES : LESSON_TIMES;
  const lessonTime = times[lessonIndex];
  if (!lessonTime) return false;
  
  const startMinutes = timeToMinutes(lessonTime.start);
  const endMinutes = timeToMinutes(lessonTime.end);
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

export const getLessonTime = (index: number, isTuesday: boolean = false): string => {
  const times = isTuesday ? TUESDAY_SPECIAL_TIMES : LESSON_TIMES;
  const lessonTime = times[index];
  if (!lessonTime) return '...';
  
  return `${lessonTime.start}\n${lessonTime.end}`;
};

const getDisplayIndex = (index: number, isTuesday: boolean, isClassHour: boolean): string => {
  if (isClassHour) {
    return ''; 
  }
  
  if (isTuesday) {
    if (index < 3) {
      return `${index + 1}.`;
    } else {
      return `${index}.`;
    }
  }
  
  return `${index + 1}.`;
};

// 🔥 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ КАБИНЕТА
const RoomDisplay = ({ room }: { room: string }) => {
  if (!room || room.trim() === '' || room.trim() === '-' || room.trim() === '–') {
    return null;
  }
  
  // Если в поле room написано "ПРАКТИКА" или что-то длинное, не пишем слово "Кабинет"
  if (room.length > 5 || room.toLowerCase().includes('практика')) {
     return <span>{room}</span>;
  }

  return <span>Кабинет {room}</span>;
};

const LessonContent = ({ 
  lesson, 
  isClassHour, 
  isTeacherView = false,
}: { 
  lesson: Lesson | null,
  isClassHour?: boolean,
  isTeacherView?: boolean,
}) => {
  if (!lesson) {
    return (
      <div className="lesson-content">
        <span className="lesson-name">Нет данных</span>
      </div>
    );
  }
  
  if (isClassHour) {
    return (
      <div className="lesson-content">
        <span className="lesson-name">Классный час</span>
        <span className="lesson-details">
          13:30 – 14:15
        </span>
      </div>
    );
  }

  if (lesson.commonLesson) {
    const { name, teacher, room, group } = lesson.commonLesson;
    
    // 🔥 ПРОВЕРКА НА ПРАКТИКУ ДЛЯ СТИЛИЗАЦИИ
    const isPractice = name.toLowerCase().includes('практика') || name.toLowerCase().includes('аттестация') || name.toLowerCase().includes('гиа');

    return (
      <div className={`lesson-content ${isPractice ? 'practice-lesson' : ''}`}>
        <span className="lesson-name">{name}</span>
        <span className="lesson-details">
          {isTeacherView ? (
            <>
              {group && <span>Группа: {group}<br /></span>}
              <RoomDisplay room={room} />
            </>
          ) : (
            <>
              {teacher && <span>{teacher}<br /></span>}
              <RoomDisplay room={room} />
            </>
          )}
        </span>
      </div>
    );
  }

  if (lesson.subgroupedLesson) {
    const { name, subgroups } = lesson.subgroupedLesson;
    
    return (
      <div className="lesson-content">
        <span className="lesson-name">{name}</span>
        
        <div className="subgroups-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {subgroups.map((subgroup, idx) => (
                <div key={idx} className="lesson-details" style={{ lineHeight: '1.2' }}>
                    <span style={{ fontWeight: 'bold', opacity: 0.8 }}>{idx + 1} п/г </span>
                    {isTeacherView ? (
                      <>
                        {subgroup.group && <span>Гр. {subgroup.group} </span>}
                        {subgroup.room && <span style={{ whiteSpace: 'nowrap' }}> | <RoomDisplay room={subgroup.room} /></span>}
                      </>
                    ) : (
                      <>
                        {subgroup.teacher && <span>{subgroup.teacher} </span>}
                        {subgroup.room && <span style={{ whiteSpace: 'nowrap' }}> | <RoomDisplay room={subgroup.room} /></span>}
                      </>
                    )}
                </div>
            ))}
        </div>
      </div>
    );
  }

  if (lesson.noLesson) {
    return (
      <div className="lesson-content">
        <span className="lesson-name">Пары нет</span>
      </div>
    );
  }

  return (
    <div className="lesson-content">
      <span className="lesson-name">...</span>
    </div>
  );
}

const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

export default function ScheduleItem({ 
  lesson, 
  index, 
  onClick, 
  isCurrent = false, 
  isTuesday = false, 
  isClassHour = false,
  hasNote = false,
  isTeacherView = false,
  customTime,
  customCourseId,
  activeDayIndex = 0
}: ScheduleItemProps) {
  
  const time = customTime ? customTime.replace('-', '\n') : getLessonTime(index, isTuesday);
  
  const isEmpty = !isClassHour && (!lesson || lesson.noLesson || (!lesson.commonLesson && !lesson.subgroupedLesson));

  const isReallyCurrent = isLessonCurrent(index, activeDayIndex, isTuesday);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (customCourseId && window.confirm('Удалить этот курс?')) {
      dataStore.removeCustomCourse(customCourseId);
    }
  };
  
  const displayIndex = getDisplayIndex(index, isTuesday, isClassHour);
  
  // 🔥 ОПРЕДЕЛЯЕМ, ПРАКТИКА ЛИ ЭТО, ЧТОБЫ ДОБАВИТЬ СПЕЦИАЛЬНЫЙ КЛАСС
  // Теперь проверяем и commonLesson, и subgroupedLesson (на всякий случай)
  let isPractice = false;
  if (lesson) {
      const name = lesson.commonLesson?.name || lesson.subgroupedLesson?.name || '';
      isPractice = name.toLowerCase().includes('практика') || 
                   name.toLowerCase().includes('гиа') || 
                   name.toLowerCase().includes('каникулы') ||
                   name.toLowerCase().includes('аттестация');
  }

  if (isClassHour) {
    return (
      <div className={`lesson-card class-hour ${isReallyCurrent ? 'current-lesson' : ''}`}>
        <span className="lesson-index">{displayIndex}</span>
        
        <LessonContent 
          lesson={lesson} 
          isClassHour={true} 
          isTeacherView={isTeacherView}
        />

        <div className="lesson-time-with-icon">
          <span className="lesson-time">{time}</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`lesson-card empty ${isReallyCurrent ? 'current-lesson' : ''}`}>
        <span className="lesson-index">{displayIndex}</span>
        
        <div className="lesson-content">
          <span className="lesson-name">Пары нет</span>
        </div>
        
        <div className="lesson-time-with-icon">
          <span className="lesson-time">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <button 
        className={`lesson-card clickable ${isReallyCurrent ? 'current-lesson' : ''} ${isPractice ? 'practice-card' : ''}`} 
        onClick={onClick}

        style={isPractice ? { 
            borderLeft: '4px solid #7f5df8ff', 
            backgroundColor: 'var(--color-surface-container-high)' 
        } : {}}
    >
      <span className="lesson-index">{displayIndex}</span>
      
      <LessonContent 
        lesson={lesson} 
        isTeacherView={isTeacherView}
      />

      {customCourseId && (
        <div 
          className="delete-course-btn" 
          onClick={handleDelete}
          style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 10,
              background: 'rgba(255, 68, 68, 0.1)',
              color: '#ff4444',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
          }}
        >
          <Icon name="close" style={{ fontSize: '18px' }} />
        </div>
      )}

      <div className="lesson-time-with-icon">
        <span className="lesson-time">{time}</span>
        <div className="edit-icons">
          {hasNote && (
            <span className="note-icon" title="Есть заметка">
              <Icon name="sticky_note_2" style={{ fontSize: '18px' }} />
            </span>
          )}
          {!customCourseId && (
              <span className="edit-icon">
                <Icon name="edit" style={{ fontSize: '18px' }} />
              </span>
          )}
        </div>
      </div>
    </button>
  );
}