
import { Lesson } from '../types';
import '../App.css'; 

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
  lesson: Lesson;
  index: number;
  onClick: () => void;
  isCurrent?: boolean;
  isTuesday?: boolean;
  isClassHour?: boolean;
  hasNote?: boolean; 
}


const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};


export const isLessonCurrent = (lessonIndex: number, isTuesday: boolean = false): boolean => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay(); 
  
  
  const currentDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const isCurrentDay = isTuesday ? currentDayIndex === 1 : currentDayIndex !== 1;
  
  if (!isCurrentDay) return false; 
  
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

const LessonContent = ({ lesson, isClassHour }: { lesson: Lesson, isClassHour?: boolean }) => {
  
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

  if (lesson.lesson === 'commonLesson' && lesson.commonLesson) {
    const { name, teacher, room } = lesson.commonLesson;
    return (
      <div className="lesson-content">
        <span className="lesson-name">{name}</span>
        <span className="lesson-details">
          {teacher}
          <br />
          Кабинет {room}
        </span>
      </div>
    );
  }

  if (lesson.lesson === 'subgroupedLesson' && lesson.subgroupedLesson) {
    const { name, subgroups } = lesson.subgroupedLesson;
    return (
      <div className="lesson-content">
        <span className="lesson-name">{name}</span>
        {subgroups.map((sub, i) => (
          <div key={i} className="lesson-subgroup">
            <span>{sub.subgroup_index || i + 1} п/г</span>
            <span className="lesson-details">
              {sub.teacher}
              <br />
              Кабинет {sub.room}
            </span>
          </div>
        ))}
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
  hasNote = false 
}: ScheduleItemProps) {
  const time = getLessonTime(index, isTuesday);
  
  
  const isEmpty = !isClassHour && (lesson.lesson === 'noLesson' || lesson.lesson === 'LESSON_NOT_SET' || lesson.noLesson);

  
  if (isClassHour) {
    return (
      <div className={`lesson-card class-hour ${isCurrent ? 'current-lesson' : ''}`}>
        <span className="lesson-index"></span>
        
        <LessonContent lesson={lesson} isClassHour={true} />

        <div className="lesson-time-with-icon">
          <span className="lesson-time">{time}</span>
        </div>
      </div>
    );
  }

  
  if (isEmpty) {
    return (
      <div className={`lesson-card empty ${isCurrent ? 'current-lesson' : ''}`}>
        <span className="lesson-index">{index + 1}.</span>
        
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
    <button className={`lesson-card clickable ${isCurrent ? 'current-lesson' : ''}`} onClick={onClick}>
      <span className="lesson-index">{index + 1}.</span>
      
      <LessonContent lesson={lesson} />

      <div className="lesson-time-with-icon">
        <span className="lesson-time">{time}</span>
        <div className="edit-icons">

          {hasNote && (
            <span className="note-icon" title="Есть заметка">
              <Icon name="sticky_note_2" style={{ fontSize: '18px' }} />
            </span>
          )}
          <span className="edit-icon">
            <Icon name="edit" style={{ fontSize: '18px' }} />
          </span>
        </div>
      </div>
    </button>
  );
}