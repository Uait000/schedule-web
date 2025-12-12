import { useState, useEffect } from 'react';
import { Lesson } from '../types';
import '../App.css';

interface NoteModalProps {
  lesson: Lesson | null;
  onClose: () => void;
  onSave: (notes: string, subgroup: number) => void;
  savedNote: string;
  savedSubgroup: number;
}

export function NoteModal({ lesson, onClose, onSave, savedNote, savedSubgroup }: NoteModalProps) {
  const [notes, setNotes] = useState(savedNote);
  const [subgroup, setSubgroup] = useState(savedSubgroup);

  useEffect(() => {
    setNotes(savedNote);
    setSubgroup(savedSubgroup);
  }, [savedNote, savedSubgroup]);

  if (!lesson) {
    return null;
  }

  const lessonName = lesson.commonLesson?.name || lesson.subgroupedLesson?.name;
  const hasSubgroups = !!lesson.subgroupedLesson;

  const handleSave = () => {
    onSave(notes, subgroup);
    onClose();
  };

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'flex-end', 
        justifyContent: 'center',
        padding: 0, 
      }}
    >
      <div 
        className="modal-content note-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 0, 
          width: '100%', 
          maxWidth: '100%', 
          borderBottomLeftRadius: 0, 
          borderBottomRightRadius: 0,
          borderTopLeftRadius: '24px', 
          borderTopRightRadius: '24px',
          maxHeight: '85vh', 
          overflowY: 'auto', 
          position: 'relative',
          animation: 'slideUp 0.3s ease-out', 
          paddingBottom: '30px' 
        }}
      >
        {/* Декоративная полоска "ручка" */}
        <div style={{ 
          width: '40px', 
          height: '4px', 
          backgroundColor: 'var(--color-border, #e0e0e0)', 
          margin: '0 auto 20px', 
          borderRadius: '2px',
          opacity: 0.5
        }} />
        
        <h3 style={{ marginTop: 0 }}>{lessonName}</h3>
        
        <textarea
          className="modal-textarea large-textarea"
          placeholder="Твоя заметка..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ 
            minHeight: '120px',
            fontSize: '16px', 
          }}
        />

        {hasSubgroups && (
          <div className="modal-subgroup-selector">
            <p>Твоя подгруппа:</p>
            {lesson.subgroupedLesson?.subgroups.map((sub, i) => {
              const index = sub.subgroup_index || (i + 1);
              return (
                <button
                  key={index}
                  className={subgroup === index ? 'courseButton active' : 'courseButton'}
                  onClick={() => setSubgroup(index)}
                >
                  {index} п/г
                </button>
              );
            })}
             <button
              className={subgroup === 0 ? 'courseButton active' : 'courseButton'}
              onClick={() => setSubgroup(0)}
            >
              Нет
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="linkButton" onClick={onClose}>Отмена</button>
          <button className="fab" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
      
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}