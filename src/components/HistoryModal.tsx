// src/components/HistoryModal.tsx

import React, { useMemo } from 'react'; // ❗️ Добавлен 'useMemo'
import { HistoryEntry, Lesson, Override } from '../types'; // ❗️ Убедитесь, что путь верный
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Иконка, как в Schedule.tsx
const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

// 🔥 Дублируем функцию normalizeLesson здесь, если она не экспортируется
function normalizeLesson(lesson: any): Lesson {
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

/**
 * Хелпер для сравнения двух уроков (Lesson)
 * Нужен для "слияния" замен
 */
function isSameLesson(l1: Lesson, l2: Lesson): boolean {
  // Оба 'null' или 'noLesson'
  if (!l1 || !l2) return false;
  if ((l1.noLesson || (typeof l1 === 'object' && Object.keys(l1).length === 0)) && 
      (l2.noLesson || (typeof l2 === 'object' && Object.keys(l2).length === 0))) {
    return true;
  }
  
  const cl1 = l1.commonLesson;
  const cl2 = l2.commonLesson;
  if (cl1 && cl2) {
    return cl1.name === cl2.name && cl1.teacher === cl2.teacher && cl1.group === cl2.group;
  }

  const sl1 = l1.subgroupedLesson;
  const sl2 = l2.subgroupedLesson;
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
  // 🔥 ИСПРАВЛЕНО: правильно обрабатываем null и noLesson
  if (!lesson || lesson.noLesson || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return <span className="history-lesson no-lesson">Пары нет</span>;
  }

  if (lesson.commonLesson) {
    const { name, teacher, room, group } = lesson.commonLesson;
    
    // Ищем группу и внутри (commonLesson.group) и снаружи (lesson.group)
    const displayGroup = group || (lesson as any).group;
    const detail = isTeacherView ? displayGroup : teacher;
    
    return (
      <span className="history-lesson">
        {name || 'Без названия'}
        {detail && detail !== '' && ` (${detail})`}
        {room && room !== '' && ` [${room}]`}
      </span>
    );
  }

  if (lesson.subgroupedLesson) {
     const { name, subgroups } = lesson.subgroupedLesson;
     const firstSub = subgroups?.[0];

     const group = (lesson as any).group || firstSub?.group;
     const detail = isTeacherView ? group : firstSub?.teacher;

     return (
      <span className="history-lesson">
        {name || 'Без названия'} (по подгруппам)
        {detail && detail !== '' && ` (${detail})`}
        {firstSub?.room && firstSub.room !== '' && ` [${firstSub.room}]`}
      </span>
    );
  }

  return <span className="history-lesson no-lesson">Пары нет</span>;
};

/**
 * Отображает одну замену в 2-колоночном виде ("Было" / "Стало")
 */
const OverrideDisplay: React.FC<{ override: Override; isTeacherView: boolean }> = ({ override, isTeacherView }) => {
  // 🔥 ИСПРАВЛЕНО: проверяем, что override существует
  if (!override) return null;
  
  // 🔥 ИСПРАВЛЕНО: нормализуем уроки перед отображением
  const normalizedShouldBe = override.shouldBe ? normalizeLesson(override.shouldBe) : { noLesson: {} };
  const normalizedWillBe = override.willBe ? normalizeLesson(override.willBe) : { noLesson: {} };
  
  return (
    <div className="history-override-item">
      <div className="history-lesson-index">
        <strong>{override.index + 1}-я пара</strong>
      </div>
      <div className="history-columns">
        <div className="history-column history-column-was">
          <div className="history-column-header">Было</div>
          <LessonDisplay lesson={normalizedShouldBe} isTeacherView={isTeacherView} />
        </div>
        <div className="history-column history-column-became">
          <div className="history-column-header">Стало</div>
          <LessonDisplay lesson={normalizedWillBe} isTeacherView={isTeacherView} />
        </div>
      </div>
    </div>
  );
};

// Хелпер для форматирования даты
const formatDate = (entry: HistoryEntry) => {
  try {
    if (!entry.year || !entry.month || !entry.day) {
      return 'Дата не указана';
    }
    const date = new Date(entry.year, entry.month, entry.day);
    if (isNaN(date.getTime())) {
      return 'Неверная дата';
    }
    return format(date, 'd MMMM yyyy, cccc', { locale: ru });
  } catch (e) {
    return 'Ошибка формата даты';
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
      if (!entry.overrides || !Array.isArray(entry.overrides) || entry.overrides.length === 0) {
        return { ...entry, overrides: [] };
      }

      // 1. Разделяем все замены по индексу пары
      const overridesByIndex = new Map<number, Override[]>();
      for (const override of entry.overrides) {
        if (override.index === undefined || override.index === null) continue;
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
                    {entry.overrides && entry.overrides.length > 0 ? (
                      entry.overrides.map((override) => (
                        <OverrideDisplay 
                          key={`${override.index}-${override.shouldBe?.commonLesson?.name || 'none'}`} 
                          override={override} 
                          isTeacherView={isTeacherView} 
                        />
                      ))
                    ) : (
                      <div className="history-no-overrides">В этот день замен не было</div>
                    )}
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