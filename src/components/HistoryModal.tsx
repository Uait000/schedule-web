// src/components/HistoryModal.tsx
import React, { useMemo } from 'react';
import { HistoryEntry, Lesson, Override } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
  <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
);

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

function isSameLesson(l1: Lesson, l2: Lesson): boolean {
  if (!l1 || !l2) return false;
  const isL1Empty = l1.noLesson || Object.keys(l1).length === 0;
  const isL2Empty = l2.noLesson || Object.keys(l2).length === 0;
  if (isL1Empty && isL2Empty) return true;
  
  const cl1 = l1.commonLesson;
  const cl2 = l2.commonLesson;
  if (cl1 && cl2) {
    return cl1.name === cl2.name && cl1.teacher === cl2.teacher && cl1.group === cl2.group;
  }

  const sl1 = l1.subgroupedLesson;
  const sl2 = l2.subgroupedLesson;
  if (sl1 && sl2) return sl1.name === sl2.name;

  return false;
}

const LessonDisplay: React.FC<{ lesson: Lesson; isTeacherView: boolean }> = ({ lesson, isTeacherView }) => {
  if (!lesson || lesson.noLesson || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return <span className="history-lesson no-lesson">Пары нет</span>;
  }

  if (lesson.commonLesson) {
    const { name, teacher, room, group } = lesson.commonLesson;
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
        {name || 'Без названия'} (подгр.)
        {detail && detail !== '' && ` (${detail})`}
        {firstSub?.room && firstSub.room !== '' && ` [${firstSub.room}]`}
      </span>
    );
  }
  return <span className="history-lesson no-lesson">Пары нет</span>;
};

const OverrideDisplay: React.FC<{ override: Override; isTeacherView: boolean }> = ({ override, isTeacherView }) => {
  if (!override) return null;
  const normalizedShouldBe = normalizeLesson(override.shouldBe);
  const normalizedWillBe = normalizeLesson(override.willBe);
  
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

const formatDate = (entry: any) => {
  try {
    const year = entry.year || entry.overrides?.year;
    const month = (entry.month !== undefined) ? entry.month : entry.overrides?.month;
    const day = entry.day || entry.overrides?.day;

    if (!year || day === undefined) return 'Дата не указана';
    const date = new Date(year, month || 0, day);
    if (isNaN(date.getTime())) return 'Неверная дата';
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
  
  const processedHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];

    return history.map(entry => {
      // Поддержка двойной вложенности overrides.overrides
      let rawList = entry.overrides;
      if (rawList && !Array.isArray(rawList) && (rawList as any).overrides) {
        rawList = (rawList as any).overrides;
      }

      if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
        return { ...entry, overrides: [] };
      }

      const overridesByIndex = new Map<number, Override[]>();
      for (const override of rawList) {
        if (override.index === undefined || override.index === null) continue;
        if (!overridesByIndex.has(override.index)) {
          overridesByIndex.set(override.index, []);
        }
        overridesByIndex.get(override.index)!.push(override);
      }

      const finalOverrides: Override[] = [];

      for (const [index, overrides] of overridesByIndex.entries()) {
        if (overrides.length === 1) {
          finalOverrides.push(overrides[0]);
          continue;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Мы не фильтруем пустые willBe, так как это отмены
        const starts = overrides.filter(o => {
            const norm = normalizeLesson(o.shouldBe);
            return !(norm.noLesson || Object.keys(norm).length === 0);
        });
        const ends = overrides.filter(o => {
            const norm = normalizeLesson(o.willBe);
            return !(norm.noLesson || Object.keys(norm).length === 0);
        });
        
        const usedEnds: Override[] = [];

        for (const start of starts) {
          const end = ends.find(e => isSameLesson(normalizeLesson(start.willBe), normalizeLesson(e.shouldBe)));
          if (end) {
            finalOverrides.push({ index, shouldBe: start.shouldBe, willBe: end.willBe });
            usedEnds.push(end);
          } else {
            finalOverrides.push(start);
          }
        }
        
        for (const end of ends) {
          if (!usedEnds.includes(end)) finalOverrides.push(end);
        }
      }

      return { 
        ...entry, 
        overrides: finalOverrides.sort((a, b) => a.index - b.index) 
      };
    });
  }, [history]);

  if (!isOpen) return null;

  const hasHistory = processedHistory.some(e => e.overrides && e.overrides.length > 0);

  return (
    <div className="history-modal-backdrop" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-header">
          <h3 className="history-modal-title">История замен</h3>
          <button onClick={onClose} className="history-modal-close-btn"><Icon name="close" /></button>
        </div>
        <div className="history-modal-content">
          {!hasHistory ? (
            <div className="history-empty">
              <Icon name="history_toggle_off" style={{ fontSize: '48px' }} />
              <span>История замен пуста</span>
              <p>Новые замены будут появляться здесь после их проверки.</p>
            </div>
          ) : (
            <div className="history-list">
              {processedHistory.map((entry, index) => {
                if (!entry.overrides || entry.overrides.length === 0) return null;
                return (
                  <div key={index} className="history-entry-card">
                    <div className="history-entry-date">{formatDate(entry)}</div>
                    <div className="history-override-list">
                      {entry.overrides.map((override, oIdx) => (
                        <OverrideDisplay key={`${oIdx}-${override.index}`} override={override} isTeacherView={isTeacherView} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};