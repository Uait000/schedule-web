import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { scheduleApi } from '../api';
import { Schedule, Lesson } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getDayIndex, getWeekNumber } from '../utils/dateUtils';

interface TeacherMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherSchedule: Schedule | null;
  currentDate: Date;
}

export function TeacherMonitoringModal({ isOpen, onClose, teacherSchedule, currentDate }: TeacherMonitoringModalProps) {
  const [loading, setLoading] = useState(false);
  const [groupsData, setGroupsData] = useState<Record<string, Lesson[]>>({});

  const uniqueGroups = useMemo(() => {
    if (!teacherSchedule) return [];
    const groups = new Set<string>();
    teacherSchedule.weeks.forEach(week => {
      week.days.forEach(day => {
        day.lessons.forEach(lesson => {
          if (lesson.commonLesson?.group) groups.add(lesson.commonLesson.group);
          if (lesson.subgroupedLesson?.subgroups) {
            lesson.subgroupedLesson.subgroups.forEach(s => {
              if (s.group) groups.add(s.group);
            });
          }
        });
      });
    });
    return Array.from(groups).sort();
  }, [teacherSchedule]);

  const loadGroupsSchedules = useCallback(async () => {
    setLoading(true);
    const results: Record<string, Lesson[]> = {};
    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const dayIdx = getDayIndex(currentDate);
    const weekIdx = getWeekNumber(currentDate) % 2;

    try {
      await Promise.all(uniqueGroups.map(async (groupName) => {
        const data = await scheduleApi.getInfo(groupName, formattedDate, 0, "");
        if (data.schedule) {
          const baseLessons = data.schedule.weeks[weekIdx]?.days[dayIdx]?.lessons || [];
          
          // Исправление: Проверка замен для отображения актуального статуса (Пара/Окно)
          const overrides = data.overrides?.overrides || [];
          const processedLessons = [...baseLessons];
          
          overrides.forEach((ov: any) => {
            if (ov.index < processedLessons.length) {
              const willBe = ov.willBe;
              // Если willBe содержит данные об уроке, значит это не отмена
              if (willBe && !willBe.noLesson && (willBe.commonLesson || willBe.subgroupedLesson)) {
                processedLessons[ov.index] = willBe;
              } else if (willBe && (willBe.noLesson || willBe.commonLesson?.teacher === 'нет')) {
                processedLessons[ov.index] = { noLesson: {} };
              }
            }
          });
          
          results[groupName] = processedLessons;
        }
      }));
      setGroupsData(results);
    } catch (e) {
      console.error("Ошибка при загрузке мониторинга:", e);
    } finally {
      setLoading(false);
    }
  }, [uniqueGroups, currentDate]);

  useEffect(() => {
    if (isOpen && uniqueGroups.length > 0) {
      loadGroupsSchedules();
    }
  }, [isOpen, uniqueGroups, loadGroupsSchedules]);

  if (!isOpen) return null;

  const lessonNumbers = [0, 1, 2, 3, 4];

  return createPortal(
    <div className="monitoring-overlay" onClick={onClose}>
      <div className="monitoring-card" onClick={e => e.stopPropagation()}>
        <div className="monitoring-header">
          <h2>Свободные пары групп</h2>
          <p>{format(currentDate, 'd MMMM, EEEE', { locale: ru })}</p>
        </div>

        <div className="monitoring-body">
          {loading ? (
            <div className="monitoring-loader">Анализируем группы...</div>
          ) : (
            <div className="monitoring-table-wrapper">
              <table className="monitoring-table">
                <thead>
                  <tr>
                    <th>Группа</th>
                    {lessonNumbers.map(n => <th key={n}>{n + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {uniqueGroups.map(group => (
                    <tr key={group}>
                      <td className="group-name-cell">{group}</td>
                      {lessonNumbers.map((idx) => {
                        const lesson = groupsData[group]?.[idx];
                        const isFree = !lesson || lesson.noLesson || (Object.keys(lesson).length === 1 && lesson.noLesson);
                        return (
                          <td key={idx} className={`slot-cell ${isFree ? 'free' : 'busy'}`}>
                            {isFree ? 'Окно' : 'Пара'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <button className="monitoring-close-btn" onClick={onClose}>Закрыть</button>
      </div>

      <style>{`
        .monitoring-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
          z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .monitoring-card {
          background: var(--color-surface, #1c1c1e);
          width: 100%; max-width: 800px; border-radius: 24px;
          padding: 24px; color: white; border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        }
        .monitoring-header { margin-bottom: 20px; text-align: center; }
        .monitoring-header h2 { margin: 0; font-weight: 800; }
        .monitoring-header p { opacity: 0.6; margin: 4px 0 0 0; text-transform: capitalize; }
        
        .monitoring-table-wrapper { overflow-x: auto; margin-bottom: 20px; border-radius: 12px; }
        .monitoring-table { width: 100%; border-collapse: collapse; min-width: 500px; }
        .monitoring-table th, .monitoring-table td { 
          padding: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05); 
        }
        .group-name-cell { text-align: left !important; font-weight: 700; background: rgba(255,255,255,0.03); }
        
        .slot-cell { font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .slot-cell.free { background: rgba(76, 217, 100, 0.2); color: #4cd964; }
        .slot-cell.busy { background: rgba(255, 59, 48, 0.1); color: rgba(255,255,255,0.6); }
        
        .monitoring-close-btn {
          width: 100%; padding: 14px; border-radius: 12px; border: none;
          background: var(--color-primary, #8c67f6); color: white; font-weight: 700; cursor: pointer;
        }
        .monitoring-loader { padding: 40px; text-align: center; font-weight: 600; }
      `}</style>
    </div>,
    document.body
  );
}