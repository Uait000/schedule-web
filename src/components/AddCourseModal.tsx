// src/components/AddCourseModal.tsx

import { useState, useEffect, useMemo } from 'react';
import { CustomCourse, Schedule, OverridesResponse } from '../types';
import { dataStore } from '../utils/DataStore';
import '../App.css';

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWeek: number;
  activeDay: number;
  schedule: Schedule | null;
  overrides: OverridesResponse | null; // 🔥 Новый проп: принимаем замены
  profileId: string;
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const WEEKS = ['Первая неделя', 'Вторая неделя'];

const TIMES = [
  '08:00 - 09:30',
  '09:40 - 11:10',
  '11:50 - 13:20',
  '13:30 - 15:00',
  '15:10 - 16:40'
];

const TUESDAY_TIMES = [
  '08:00 - 09:30',
  '09:40 - 11:10',
  '11:50 - 13:20',
  '13:30 - 14:15 (Кл. час)',
  '14:25 - 15:55'
];

export function AddCourseModal({ isOpen, onClose, activeWeek, activeDay, schedule, overrides, profileId }: AddCourseModalProps) {
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  
  const [selectedWeek, setSelectedWeek] = useState(activeWeek);
  const [selectedDay, setSelectedDay] = useState(activeDay >= 0 && activeDay < 6 ? activeDay : 0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedWeek(activeWeek);
      setSelectedDay(activeDay >= 0 && activeDay < 6 ? activeDay : 0);
      setSelectedSlot(null);
      setName('');
      setTeacher('');
      setRoom('');
    }
  }, [isOpen, activeWeek, activeDay]);

  // 🔥 УМНЫЙ РАСЧЕТ СВОБОДНЫХ МЕСТ (С УЧЕТОМ ЗАМЕН)
  const availableSlots = useMemo(() => {
    // 1. Берем базовые уроки
    const baseLessons = schedule?.weeks?.[selectedWeek]?.days?.[selectedDay]?.lessons || [];
    const freeSlots: number[] = [];

    // 2. Берем список замен для этой недели и дня
    // Проверяем, совпадают ли неделя и день в объекте замен с выбранными
    const activeOverrides = (overrides && overrides.weekNum === selectedWeek && overrides.weekDay === selectedDay) 
        ? overrides.overrides 
        : [];

    for (let i = 0; i < 5; i++) {
      // 3. Определяем, какой урок сейчас в этой ячейке
      let currentLesson = baseLessons[i];

      // Если есть замена на этот индекс (i), она перекрывает базовый урок
      const override = activeOverrides.find(o => o.index === i);
      if (override) {
          currentLesson = override.willBe;
      }

      // 4. Проверяем, пустой ли итоговый урок
      // Слот свободен, если урока нет ВООБЩЕ или у него стоит флаг noLesson
      const isEmpty = !currentLesson || currentLesson.noLesson || (Object.keys(currentLesson).length === 0);
      
      // Вторник, 4-й слот (индекс 3) всегда занят классным часом
      const isClassHour = selectedDay === 1 && i === 3;

      if (isEmpty && !isClassHour) {
        freeSlots.push(i);
      }
    }
    return freeSlots;
  }, [schedule, overrides, selectedWeek, selectedDay]);

  useEffect(() => {
    if (availableSlots.length > 0 && (selectedSlot === null || !availableSlots.includes(selectedSlot))) {
        setSelectedSlot(availableSlots[0]);
    }
  }, [availableSlots, selectedSlot]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name) {
      alert('Введите название курса');
      return;
    }
    if (selectedSlot === null) {
      alert('Нет свободных мест в этот день');
      return;
    }

    const newCourse: CustomCourse = {
      id: Date.now().toString(),
      profileId: profileId,
      name,
      teacher,
      room,
      weekIndex: selectedWeek,
      dayIndex: selectedDay,
      lessonIndex: selectedSlot
    };

    dataStore.addCustomCourse(newCourse);
    onClose();
  };

  const timeArray = selectedDay === 1 ? TUESDAY_TIMES : TIMES;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Добавить курс</h3>
        
        <div className="add-course-form">
          <div className="form-row">
             <div className="form-group">
                <label className="form-label">Неделя</label>
                <select 
                  className="form-select"
                  value={selectedWeek}
                  onChange={e => setSelectedWeek(Number(e.target.value))}
                >
                  {WEEKS.map((week, idx) => (
                    <option key={idx} value={idx}>{week}</option>
                  ))}
                </select>
             </div>
             <div className="form-group">
                <label className="form-label">День</label>
                <select 
                  className="form-select"
                  value={selectedDay}
                  onChange={e => setSelectedDay(Number(e.target.value))}
                >
                  {DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="form-group">
            <label className="form-label">Выберите свободную пару</label>
            <select 
                className="form-select"
                value={selectedSlot ?? ''}
                onChange={e => setSelectedSlot(Number(e.target.value))}
                disabled={availableSlots.length === 0}
            >
                {availableSlots.length > 0 ? (
                    availableSlots.map(index => (
                        <option key={index} value={index}>
                           {index + 1}. {timeArray[index]}
                        </option>
                    ))
                ) : (
                    <option disabled>Нет свободных окон</option>
                )}
            </select>
          </div>

          <div className="form-group">
            <input 
              className="form-input" 
              placeholder="Название пары" 
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

           <div className="form-row">
            <div className="form-group">
              <input 
                className="form-input" 
                placeholder="Кабинет (необяз.)" 
                value={room}
                onChange={e => setRoom(e.target.value)}
              />
            </div>
            <div className="form-group">
              <input 
                className="form-input" 
                placeholder="Преп./Группа" 
                value={teacher}
                onChange={e => setTeacher(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="add-course-btn" 
            onClick={handleSubmit}
            disabled={availableSlots.length === 0}
            style={{ opacity: availableSlots.length === 0 ? 0.5 : 1 }}
          >
            Добавить курс
          </button>
        </div>
      </div>
    </div>
  );
}