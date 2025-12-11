// src/components/HistoryModal.tsx

import React, { useMemo } from 'react'; // ❗️ Добавлен 'useMemo'
import { HistoryEntry, Lesson, Override } from '../types'; // ❗️ Убедитесь, что путь верный
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Иконка, как в Schedule.tsx
const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

/**
 * Хелпер для сравнения двух уроков (Lesson)
 * Нужен для "слияния" замен
 */
function isSameLesson(l1: Lesson, l2: Lesson): boolean {
  // Оба 'null' или 'noLesson'
  if ((l1?.noLesson || l1 === null) && (l2?.noLesson || l2 === null)) return true;
  
  const cl1 = l1?.commonLesson;
  const cl2 = l2?.commonLesson;
  if (cl1 && cl2) {
    return cl1.name === cl2.name && cl1.teacher === cl2.teacher && cl1.group === cl2.group;
  }

  const sl1 = l1?.subgroupedLesson;
  const sl2 = l2?.subgroupedLesson;
  if (sl1 && sl2) {
     return sl1.name === sl2.name;
  }

  // Один есть, другого нет
  return false;
}


/**
 * Отображает одну пару, решая, показать группу (для преподавателя) 
 * или преподавателя (для студента).
 */
const LessonDisplay: React.FC<{ lesson: Lesson; isTeacherView: boolean }> = ({ lesson, isTeacherView }) => {
  if (lesson?.noLesson || lesson === null) {
    return <span className="history-lesson no-lesson">Пары нет</span>;
  }

  if (lesson?.commonLesson) {
    const { name, teacher, room } = lesson.commonLesson;
    
    // Ищем группу и внутри (commonLesson.group) и снаружи (lesson.group)
    const group = lesson.commonLesson.group || (lesson as any).group;
    const detail = isTeacherView ? group : teacher;
    
    return (
      <span className="history-lesson">
        {name}
        {detail && ` (${detail})`}
        {room && ` [${room}]`}
      </span>
    );
  }

  if (lesson?.subgroupedLesson) {
     const { name, subgroups } = lesson.subgroupedLesson;
     const firstSub = subgroups?.[0];

     const group = (lesson as any).group || firstSub?.group;
     const detail = isTeacherView ? group : firstSub?.teacher;

     return (
      <span className="history-lesson">
        {name} (по подгруппам)
        {detail && ` (${detail})`}
      </span>
    );
  }

  return <span className="history-lesson no-lesson">Пары нет</span>;
};

/**
 * Отображает одну замену в 2-колоночном виде ("Было" / "Стало")
 */
const OverrideDisplay: React.FC<{ override: Override; isTeacherView: boolean }> = ({ override, isTeacherView }) => {
  return (
    <div className="history-override-item">
      <div className="history-lesson-index">
        <strong>{override.index + 1}-я пара</strong>
      </div>
      <div className="history-columns">
        <div className="history-column history-column-was">
          <div className="history-column-header">Было</div>
          <LessonDisplay lesson={override.shouldBe} isTeacherView={isTeacherView} />
        </div>
        <div className="history-column history-column-became">
          <div className="history-column-header">Стало</div>
          <LessonDisplay lesson={override.willBe} isTeacherView={isTeacherView} />
        </div>
      </div>
    </div>
  );
};

// Хелпер для форматирования даты
const formatDate = (entry: HistoryEntry) => {
  try {
    const date = new Date(entry.year!, entry.month!, entry.day!);
    return format(date, 'd MMMM yyyy, cccc', { locale: ru });
  } catch (e) {
    return 'Неверная дата';
  }
};

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  isTeacherView: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, isTeacherView }) => {
  
  // ❗️❗️ НОВАЯ ЛОГИКА "СЛИЯНИЯ" ЗАМЕН ❗️❗️
  const processedHistory = useMemo(() => {
    return history.map(entry => {
      // 1. Разделяем все замены по индексу пары
      const overridesByIndex = new Map<number, Override[]>();
      for (const override of entry.overrides) {
        if (!overridesByIndex.has(override.index)) {
          overridesByIndex.set(override.index, []);
        }
        overridesByIndex.get(override.index)!.push(override);
      }

      const finalOverrides: Override[] = [];

      // 2. Обрабатываем каждую группу пар
      for (const [index, overrides] of overridesByIndex.entries()) {
        if (overrides.length === 1) {
          // Если замена для этой пары только одна, просто добавляем ее
          finalOverrides.push(overrides[0]);
          continue;
        }

        // 3. Находим "начало цепочки" (A -> B, где A не null)
        // и "конец цепочки" (C -> D, где D не null)
        const starts = overrides.filter(o => o.shouldBe !== null && !o.shouldBe?.noLesson);
        const ends = overrides.filter(o => o.willBe !== null && !o.willBe?.noLesson);
        
        const usedEnds: Override[] = []; // Храним "концы", которые уже использовали

        // 4. Пытаемся "склеить"
        for (const start of starts) {
          // Ищем "конец" C -> D, у которого C == B (т.е. start.willBe == end.shouldBe)
          const end = ends.find(e => isSameLesson(start.willBe, e.shouldBe));
          
          if (end) {
            // Нашли цепочку! (A -> B) + (B -> D) = (A -> D)
            finalOverrides.push({
              index: index,
              shouldBe: start.shouldBe, // "Было" из "начала"
              willBe: end.willBe         // "Стало" из "конца"
            });
            usedEnds.push(end); // Помечаем этот "конец" как использованный
          } else {
            // У этого "начала" нет "конца" (e.g. A -> null), добавляем как есть
            finalOverrides.push(start);
          }
        }
        
        // 5. Добавляем "концы" (null -> D), которые не были частью цепочки
        for (const end of ends) {
          if (!usedEnds.includes(end)) {
            finalOverrides.push(end);
          }
        }
      }

      // 6. Сортируем итоговый список по номеру пары для красоты
      return { 
        ...entry, 
        overrides: finalOverrides.sort((a, b) => a.index - b.index) 
      };
    });
  }, [history]); // ❗️❗️ КОНЕЦ НОВОЙ ЛОГИКИ ❗️❗️

  if (!isOpen) return null;

  return (
    <div className="history-modal-backdrop" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="history-modal-header">
          <h3 className="history-modal-title">История замен</h3>
          <button onClick={onClose} className="history-modal-close-btn">
            <Icon name="close" />
          </button>
        </div>

        <div className="history-modal-content">
          {/* ❗️ Используем processedHistory */}
          {processedHistory.length === 0 ? (
            <div className="history-empty">
              <Icon name="history_toggle_off" style={{ fontSize: '48px' }} />
              <span>История замен пуста</span>
              <p>Новые замены будут появляться здесь после их проверки.</p>
            </div>
          ) : (
            <div className="history-list">
              {/* ❗️ Используем processedHistory */}
              {processedHistory.map((entry, index) => (
                <div key={index} className="history-entry-card">
                  <div className="history-entry-date">
                    {formatDate(entry)}
                  </div>
                  <div className="history-override-list">
                    {entry.overrides.map((override) => (
                      <OverrideDisplay 
                        key={override.index} 
                        override={override} 
                        isTeacherView={isTeacherView} 
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};