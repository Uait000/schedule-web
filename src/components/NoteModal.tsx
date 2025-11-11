
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
        
        <h3>{lessonName}</h3>
        

        <textarea
          className="modal-textarea large-textarea"
          placeholder="Твоя заметка..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
    </div>
  );
}