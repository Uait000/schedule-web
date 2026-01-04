// src/screens/Welcome.tsx

import { useState, useEffect } from 'react';
import '../App.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchData } from '../api'; // Теперь fetchData экспортируется из api.ts
import { ProfileType } from '../types/profiles';
import { dataStore } from '../utils/DataStore';

interface Items {
  teachers: string[];
  groups: string[];
}

export function WelcomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userType, setUserType] = useState<ProfileType>(ProfileType.STUDENT);
  const [course, setCourse] = useState(0);
  
  const [items, setItems] = useState<Items>({ teachers: [], groups: [] });
  
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [teacherQuery, setTeacherQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Флаг: мы пришли добавлять ВТОРОЙ профиль (через плюсик)?
  const isAddingProfile = (location.state as any)?.fromAddProfile;

  const isStudent = userType === ProfileType.STUDENT;

  // Загружаем сохраненные профили для определения режима
  useEffect(() => {
    const appState = dataStore.getState();
    // Если мы не добавляем профиль, сбрасываем выбор типа на Студента (или как было)
    if (!isAddingProfile) {
       setUserType(ProfileType.STUDENT);
    } else {
       setUserType(appState.lastUsed || ProfileType.STUDENT);
    }
  }, [isAddingProfile]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Используем обновленную функцию fetchData
    fetchData(`/items`)
      .then((result) => {
        setIsLoading(false);
        if (result) {
          setItems({
            groups: result.groups ? result.groups.sort() : [],
            teachers: result.teachers ? result.teachers.sort() : []
          });
        }
      })
      .catch((error) => {
        console.error("Ошибка получения элементов:", error);
        setIsLoading(false);
        setError('Ошибка загрузки данных. Проверьте интернет.');
      });
  }, []);

  const filteredGroups = items.groups
    .filter(group => 
      course === 0 || group.includes(`-${course}-`)
    );

  const filteredTeachers = items.teachers
    .filter(teacher => 
      teacher.toLowerCase().replace(/\s/g, '').replace(/\./g, '')
        .includes(teacherQuery.toLowerCase().replace(/\s/g, '').replace(/\./g, ''))
    );

  async function handleNextClick() {
    if (!selectedGroup && !selectedTeacher) return;
    
    const id = isStudent ? selectedGroup : selectedTeacher;
    const type = isStudent ? ProfileType.STUDENT : ProfileType.TEACHER;

    try {
      setIsLoading(true);
      // Оптимизация: загружаем расписание заранее, чтобы экран Schedule открылся с данными
      const scheduleData = await fetchData(`/${encodeURIComponent(id)}/schedule`);
      
      // Сохраняем в DataStore с глубоким обновлением стейта для мгновенной реакции UI
      await dataStore.updateData(state => {
        const profileKey = type.toLowerCase() as 'student' | 'teacher';
        
        const newProfile = {
            type: type,
            id: id,
            name: id,
            schedule: scheduleData,
            overrides: null
        };

        // Сценарий 1: Добавление дополнительного профиля (через Плюс)
        if (isAddingProfile) {
             return {
                ...state,
                profiles: {
                  ...state.profiles,
                  [profileKey]: newProfile,
                  lastUsed: type
                }
             };
        } 
        
        // Сценарий 2: Полный сброс или первая настройка
        // Удаляем метаданные старых групп, чтобы избежать конфликтов хешей (Проблема №1)
        return {
          ...state,
          profileMetadata: {}, 
          profiles: {
            student: type === ProfileType.STUDENT ? newProfile : undefined,
            teacher: type === ProfileType.TEACHER ? newProfile : undefined,
            lastUsed: type
          },
          firstTimeLaunch: state.firstTimeLaunch || Date.now()
        };
      });

      // Сохраняем выбранный ID в локальное хранилище для синхронизации хуков
      localStorage.setItem('selectedId', id);
      localStorage.setItem('userType', type);
      
      // Генерируем событие для мгновенного обновления других компонентов
      window.dispatchEvent(new Event('profileChanged'));
      
      navigate('/schedule');
    } catch (error) {
      console.error('Ошибка при загрузке расписания:', error);
      setError('Ошибка при загрузке расписания');
    } finally {
      setIsLoading(false);
    }
  }

  const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
    <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
  );

  return (
    <div className="container">
      <h1>
        {isAddingProfile
          ? 'Добавить новый профиль'
          : (isStudent ? 'Из какой ты группы?' : 'Выберите преподавателя')
        }
      </h1>
      
      <div className="card">
        <button 
          className={`courseButton ${isStudent ? 'active' : ''}`}
          onClick={() => {
            setSelectedGroup('');
            setSelectedTeacher('');
            setTeacherQuery('');
            setUserType(ProfileType.STUDENT);
          }}
        >
          <Icon name="school" style={{ fontSize: '20px', marginRight: '8px' }} />
          Группа
        </button>
        <button 
          className={`courseButton ${!isStudent ? 'active' : ''}`}
          onClick={() => {
            setSelectedGroup('');
            setSelectedTeacher('');
            setTeacherQuery('');
            setUserType(ProfileType.TEACHER);
          }}
        >
          <Icon name="person" style={{ fontSize: '20px', marginRight: '8px' }} />
          Преподаватель
        </button>
      </div>

      {isStudent && (
        <>
          <div className="card">
            <span className="courseLabel">Курс:</span>
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                className={course === num ? 'courseButton active' : 'courseButton'}
                onClick={() => setCourse(course === num ? 0 : num)}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="card listCard">
            {isLoading && !items.groups.length && <p>Загрузка...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!isLoading && !error && (
              <div className="groupGrid">
                {filteredGroups.map(group => (
                  <button
                    key={group}
                    className={selectedGroup === group ? 'groupButton active' : 'groupButton'}
                    onClick={() => setSelectedGroup(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
            )}
            {!isLoading && !error && filteredGroups.length === 0 && (
                <p style={{ color: 'var(--color-secondary-text)' }}>
                    Нет доступных групп. Попробуйте другой курс.
                </p>
            )}
          </div>
        </>
      )}

      {!isStudent && (
        <div className="card listCard">
          <input 
            type="text"
            placeholder="🔍 Поиск преподавателя..."
            className="searchInput"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
          />
          <div className="teacherList">
            {isLoading && !items.teachers.length && <p>Загрузка...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!isLoading && !error && filteredTeachers.map(teacher => (
              <button
                key={teacher}
                className={selectedTeacher === teacher ? 'teacherButton active' : 'teacherButton'}
                onClick={() => setSelectedTeacher(teacher)}
              >
                {teacher}
                {selectedTeacher === teacher && (
                  <span className="checkIcon">
                    <Icon name="check" />
                  </span>
                )}
              </button>
            ))}
            {!isLoading && !error && filteredTeachers.length === 0 && teacherQuery.length > 0 && (
                <p style={{ color: 'var(--color-secondary-text)' }}>
                    Преподаватель не найден.
                </p>
            )}
          </div>
        </div>
      )}

      {(selectedGroup || selectedTeacher) && (
        <div className="fab-container">
          <button 
            className="fab"
            onClick={handleNextClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Загрузка...
              </>
            ) : (
              <>
                <Icon name="arrow_forward" style={{ marginRight: '8px' }} />
                {isAddingProfile ? 'Добавить профиль' : 'Продолжить'}
              </>
            )}
          </button>
        </div>
      )}

      <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
        <p><strong>Версия приложения:</strong> 2.0.1 (Turbo)</p>
      </div>
    </div>
  );
}