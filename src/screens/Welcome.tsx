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
  // 🔥 НОВОЕ СОСТОЯНИЕ: Визуальная загрузка с котиком
  const [isVisualLoading, setIsVisualLoading] = useState(false);
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
    // 🔥 ВКЛЮЧАЕМ КОТИКА
    setIsVisualLoading(true);
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
        // 🔥 ВЫКЛЮЧАЕМ КОТИКА С ЗАДЕРЖКОЙ
        setTimeout(() => setIsVisualLoading(false), 2500);
      })
      .catch((error) => {
        console.error("Ошибка получения элементов:", error);
        setIsLoading(false);
        setIsVisualLoading(false);
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
      // 🔥 ВКЛЮЧАЕМ КОТИКА ПЕРЕД ПЕРЕХОДОМ
      setIsVisualLoading(true);

      // Оптимизация: загружаем расписание заранее
      const scheduleData = await fetchData(`/${encodeURIComponent(id)}/schedule`);
      
      // Сохраняем в DataStore
      await dataStore.updateData(state => {
        const profileKey = type.toLowerCase() as 'student' | 'teacher';
        const newProfile = {
            type: type,
            id: id,
            name: id,
            schedule: scheduleData,
            overrides: null
        };

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

      localStorage.setItem('selectedId', id);
      localStorage.setItem('userType', type);
      window.dispatchEvent(new Event('profileChanged'));
      
      // 🔥 ДАЕМ КОТИКУ ПОСПАТЬ 2.5 СЕКУНДЫ ПЕРЕД ПЕРЕХОДОМ
      setTimeout(() => {
          setIsVisualLoading(false);
          navigate('/schedule');
      }, 2500);

    } catch (error) {
      console.error('Ошибка при загрузке расписания:', error);
      setIsVisualLoading(false);
      setError('Ошибка при загрузке расписания');
    } finally {
      setIsLoading(false);
    }
  }

  const Icon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => (
    <span className="material-icons" style={{ fontFamily: 'Material Icons', ...style }}>{name}</span>
  );

  return (
    <>
      <style>{`
        /* СТИЛИ КОТИКА */
        .loader-wrapper-fullscreen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 300px;
          padding: 40px 0;
          animation: fadeIn 0.4s ease;
        }
        .catContainer {
          width: 100%;
          height: fit-content;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .catbody {
          width: 100px;
          fill: var(--color-text);
          transition: fill 0.3s ease;
        }
        .tail {
          position: absolute;
          width: 20px;
          top: 50%;
          animation: tail 0.5s ease-in infinite alternate-reverse;
          transform-origin: top;
          fill: var(--color-text);
        }
        @keyframes tail {
          0% { transform: rotateZ(60deg); }
          50% { transform: rotateZ(0deg); }
          100% { transform: rotateZ(-20deg); }
        }
        .wall {
          width: 280px;
          stroke: var(--color-border);
          opacity: 0.6;
        }
        .text-cat {
          display: flex;
          flex-direction: column;
          width: 50px;
          position: absolute;
          margin: 0px 0px 100px 140px;
        }
        .zzz {
          color: var(--color-primary);
          font-weight: 800;
          font-size: 18px;
          animation: zzz-anim 2s linear infinite;
        }
        .bigzzz {
          color: var(--color-primary);
          font-weight: 800;
          font-size: 28px;
          margin-left: 12px;
          animation: zzz-anim 2.3s linear infinite;
        }
        @keyframes zzz-anim {
          0% { opacity: 0; transform: translateY(5px); }
          50% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="container">
        {isVisualLoading ? (
          <div className="loader-wrapper-fullscreen">
            <div className="catContainer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 733 673" className="catbody">
                <path d="M111.002 139.5C270.502 -24.5001 471.503 2.4997 621.002 139.5C770.501 276.5 768.504 627.5 621.002 649.5C473.5 671.5 246 687.5 111.002 649.5C-23.9964 611.5 -48.4982 303.5 111.002 139.5Z" />
                <path d="M184 9L270.603 159H97.3975L184 9Z" />
                <path d="M541 0L627.603 150H454.397L541 0Z" />
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 158 564" className="tail">
                <path d="M5.97602 76.066C-11.1099 41.6747 12.9018 0 51.3036 0V0C71.5336 0 89.8636 12.2558 97.2565 31.0866C173.697 225.792 180.478 345.852 97.0691 536.666C89.7636 553.378 73.0672 564 54.8273 564V564C16.9427 564 -5.4224 521.149 13.0712 488.085C90.2225 350.15 87.9612 241.089 5.97602 76.066Z" />
              </svg>
              <div className="text-cat">
                <span className="bigzzz">Z</span>
                <span className="zzz">Z</span>
              </div>
            </div>
            <div className="wallContainer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 500 126" className="wall">
                <line strokeWidth="8" y2="3" x2="450" y1="3" x1="50" />
                <line strokeWidth="8" y2="85" x2="400" y1="85" x1="100" />
                <line strokeWidth="8" y2="122" x2="375" y1="122" x1="125" />
                <line strokeWidth="8" y2="43" x2="500" y1="43" x1="0" />
                <line strokeWidth="8" y2="1.99" x2="115" y1="43" x1="115" />
                <line strokeWidth="8" y2="2.00" x2="189" y1="43" x1="189" />
                <line strokeWidth="8" y2="2.01" x2="262" y1="43" x1="262" />
                <line strokeWidth="8" y2="43.00" x2="153" y1="84" x1="153" />
                <line strokeWidth="8" y2="43.00" x2="228" y1="84" x1="228" />
                <line strokeWidth="8" y2="43.00" x2="303" y1="84" x1="303" />
              </svg>
            </div>
            <p style={{ marginTop: '30px', fontWeight: 700, color: 'var(--color-text)', opacity: 0.6 }}>Готовим базу данных...</p>
          </div>
        ) : (
          <>
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
                  {error && <p style={{ color: 'red' }}>{error}</p>}
                  {!error && (
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
                  {error && <p style={{ color: 'red' }}>{error}</p>}
                  {!error && filteredTeachers.map(teacher => (
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
                  <Icon name="arrow_forward" style={{ marginRight: '8px' }} />
                  {isAddingProfile ? 'Добавить профиль' : 'Продолжить'}
                </button>
              </div>
            )}
          </>
        )}

        <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
          <p><strong>Версия приложения:</strong> 2.0.1 (Turbo Cat)</p>
        </div>
      </div>
    </>
  );
}