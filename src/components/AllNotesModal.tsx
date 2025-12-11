import { useEffect, useState } from 'react';
import '../App.css';
import { Schedule } from '../types';

interface NoteItem {
  key: string;
  text: string;
  week: number;
  day: number;
  lessonIndex: number;
  lastUpdated?: number;
  profileId: string;
  groupName?: string;
}

interface AllNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  schedule: Schedule | null;
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function AllNotesModal({ isOpen, onClose, profileId, schedule }: AllNotesModalProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const findGroupForLesson = (week: number, day: number, lessonIndex: number): string => {
    if (!schedule || !schedule.weeks) return 'Неизвестная группа';

    try {
      const lesson = schedule.weeks[week]?.days[day]?.lessons[lessonIndex];
      
      if (!lesson) return 'Пара не найдена';

      if (lesson.commonLesson) {
        return lesson.commonLesson.group || lesson.commonLesson.name || 'Без названия';
      }

      if (lesson.subgroupedLesson) {
        const groups = lesson.subgroupedLesson.subgroups
          .map(s => s.group)
          .filter(Boolean)
          .join(', ');
        
        if (groups) return groups;
        return lesson.subgroupedLesson.name || 'Подгруппы';
      }

      return 'Нет данных';
    } catch (e) {
      return 'Ошибка данных';
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const foundNotes: NoteItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith(`note_${profileId}_`)) {
        try {
          const rawData = localStorage.getItem(key);
          if (rawData) {
            const parsed = JSON.parse(rawData);
            
            if (parsed.notes && parsed.notes.trim().length > 0) {
              const parts = key.split('_');
              const lessonIndex = parseInt(parts[parts.length - 1]);
              const day = parseInt(parts[parts.length - 2]);
              const week = parseInt(parts[parts.length - 3]);

              const groupName = findGroupForLesson(week, day, lessonIndex);

              foundNotes.push({
                key,
                text: parsed.notes,
                week,
                day,
                lessonIndex,
                lastUpdated: parsed.lastUpdated,
                profileId,
                groupName
              });
            }
          }
        } catch (e) {
          console.error('Error parsing note', key, e);
        }
      }
    }

    // 🔥 ИСПРАВЛЕНИЕ: Сортировка "От новых к старым" (Descending)
    // 30 число будет выше, чем 24-е, а 24-е выше, чем 21-е
    foundNotes.sort((a, b) => {
      if (a.lastUpdated && b.lastUpdated) return b.lastUpdated - a.lastUpdated; // b - a
      return 0;
    });

    setNotes(foundNotes);
  }, [isOpen, profileId, schedule]);

  if (!isOpen) return null;

  const Icon = ({ name }: { name: string }) => (
    <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle' }}>{name}</span>
  );

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Icon name="description" /> Мои заметки</h3>
          <button className="close-button" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="modal-body">
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-secondary-text)' }}>
              <span className="material-icons" style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>edit_note</span>
              <p style={{ fontSize: '16px' }}>У вас пока нет заметок.</p>
              <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '8px' }}>Добавляйте их к парам в расписании, нажимая на иконку карандаша.</p>
            </div>
          ) : (
            <>
              {notes.map((note) => (
                <div key={note.key} className="note-card">
                  
                  <div className="note-card-header">
                    <div>
                      <div className="note-group-name">
                        {note.groupName}
                      </div>
                      <div className="note-date-info">
                        <Icon name="event" />
                        {note.week === 0 ? '1 нед.' : '2 нед.'}, {DAYS[note.day]}
                      </div>
                    </div>

                    {note.lastUpdated && (
                      <div className="note-badge">
                        {formatDate(note.lastUpdated)}
                      </div>
                    )}
                  </div>
                  
                  <div className="note-content">
                    {note.text}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}