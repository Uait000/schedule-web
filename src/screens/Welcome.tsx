// src/screens/Welcome.tsx

import { useState, useEffect } from 'react';
import '../App.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchData, scheduleApi } from '../api/api'; // 🔥 Добавили импорт scheduleApi
import { ProfileType } from '../types/profiles';
import { dataStore } from '../utils/DataStore';

interface Items {
  teachers: string[];
  groups: string[];
}

const getCachedItems = (): Items => {
  try {
    const cached = localStorage.getItem('api_items');
    if (!cached) return { teachers: [], groups: [] };
    const parsed = JSON.parse(cached);
    const data = parsed.data || parsed;
    if (data.groups && data.teachers) {
      return { groups: data.groups.sort(), teachers: data.teachers.sort() };
    }
  } catch (e) {
    console.error("Ошибка чтения кэша элементов:", e);
  }
  return { teachers: [], groups: [] };
};

const OfflineIcon = ({ name, style = {} }: { name: string; style?: React.CSSProperties }) => {
  let path = "";
  switch (name) {
    case 'school': path = "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"; break;
    case 'person': path = "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"; break;
    case 'check': path = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"; break;
    case 'arrow_forward': path = "M12 4l-1.41 1.41L16.17 11H3v2h13.17l-5.58 5.59L12 20l8-8z"; break;
    default: return <span className="material-icons" style={style}>{name}</span>;
  }
  return (
    <svg viewBox="0 0 24 24" style={{ width: style.fontSize || '24px', height: style.fontSize || '24px', fill: 'currentColor', verticalAlign: 'middle', ...style }}>
      <path d={path} />
    </svg>
  );
};

export function WelcomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userType, setUserType] = useState<ProfileType>(ProfileType.STUDENT);
  const [course, setCourse] = useState(0);
  const [items, setItems] = useState<Items>(getCachedItems);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [isLoading, setIsLoading] = useState(() => items.groups.length === 0);
  const [isVisualLoading, setIsVisualLoading] = useState(() => items.groups.length === 0);
  const [error, setError] = useState<string | null>(null);

  const isAddingProfile = (location.state as any)?.fromAddProfile;
  const isStudent = userType === ProfileType.STUDENT;

  useEffect(() => {
    const appState = dataStore.getState();
    if (!isAddingProfile) {
       setUserType(ProfileType.STUDENT);
    } else {
       setUserType(appState.lastUsed || ProfileType.STUDENT);
    }
  }, [isAddingProfile]);

  useEffect(() => {
    fetchData(`/items`)
      .then((result) => {
        if (result) {
          setItems({
            groups: result.groups ? result.groups.sort() : [],
            teachers: result.teachers ? result.teachers.sort() : []
          });
        }
        setIsVisualLoading(false);
        setIsLoading(false);
      })
      .catch(() => {
        setIsVisualLoading(false);
        setIsLoading(false);
        if (items.groups.length === 0) {
          setError('Ошибка загрузки данных. Проверьте интернет.');
        }
      });
  }, []);

  const filteredGroups = items.groups.filter(group => course === 0 || group.includes(`-${course}-`));
  const filteredTeachers = items.teachers.filter(t => t.toLowerCase().includes(teacherQuery.toLowerCase().replace(/\s/g, '')));

  // 🔥 ИСПРАВЛЕННАЯ ФУНКЦИЯ ПЕРЕХОДА
  async function handleNextClick() {
    if (!selectedGroup && !selectedTeacher) return;
    
    const id = isStudent ? selectedGroup : selectedTeacher;
    const type = isStudent ? ProfileType.STUDENT : ProfileType.TEACHER;

    try {
      setIsVisualLoading(true);
      setError(null);

      // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: 
      // Вызываем напрямую метод из api.ts. Он сам разберется: 
      // если есть интернет — скачает, если нет — достанет из LocalStorage по ID.
      const scheduleData = await scheduleApi.getSchedule(id);
      
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
             return { ...state, profiles: { ...state.profiles, [profileKey]: newProfile, lastUsed: type } };
        } 
        return {
          ...state,
          profiles: {
            student: type === ProfileType.STUDENT ? newProfile : undefined,
            teacher: type === ProfileType.TEACHER ? newProfile : undefined,
            lastUsed: type
          }
        };
      });

      localStorage.setItem('selectedId', id);
      localStorage.setItem('userType', type);
      window.dispatchEvent(new Event('profileChanged'));
      
      setTimeout(() => {
          setIsVisualLoading(false);
          navigate('/schedule');
      }, 800);

    } catch (err) {
      console.error('Ошибка:', err);
      setIsVisualLoading(false);
      // Теперь эта ошибка появится ТОЛЬКО если профиля реально нет в памяти телефона
      setError('Для загрузки этого профиля в первый раз нужен интернет.');
    }
  }

  return (
    <>
      <style>{`
        .loader-wrapper-fullscreen { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-height: 300px; padding: 40px 0; animation: fadeIn 0.4s ease; }
        .catContainer { width: 100%; height: fit-content; display: flex; align-items: center; justify-content: center; position: relative; }
        .catbody { width: 100px; fill: var(--color-text); transition: fill 0.3s ease; }
        .tail { position: absolute; width: 20px; top: 50%; animation: tail 0.5s ease-in infinite alternate-reverse; transform-origin: top; fill: var(--color-text); }
        @keyframes tail { 0% { transform: rotateZ(60deg); } 50% { transform: rotateZ(0deg); } 100% { transform: rotateZ(-20deg); } }
        .wall { width: 280px; stroke: var(--color-border); opacity: 0.6; }
        .text-cat { display: flex; flex-direction: column; width: 50px; position: absolute; margin: 0px 0px 100px 140px; }
        .zzz { color: var(--color-primary); font-weight: 800; font-size: 18px; animation: zzz-anim 2s linear infinite; }
        .bigzzz { color: var(--color-primary); font-weight: 800; font-size: 28px; margin-left: 12px; animation: zzz-anim 2.3s linear infinite; }
        @keyframes zzz-anim { 0% { opacity: 0; transform: translateY(5px); } 50% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-5px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
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
                <line strokeWidth="8" y2="3" x2="450" y1="3" x1="50" /><line strokeWidth="8" y2="85" x2="400" y1="85" x1="100" /><line strokeWidth="8" y2="122" x2="375" y1="122" x1="125" /><line strokeWidth="8" y2="43" x2="500" y1="43" x1="0" /><line strokeWidth="8" y2="1.99" x2="115" y1="43" x1="115" /><line strokeWidth="8" y2="2.00" x2="189" y1="43" x1="189" /><line strokeWidth="8" y2="2.01" x2="262" y1="43" x1="262" /><line strokeWidth="8" y2="43.00" x2="153" y1="84" x1="153" /><line strokeWidth="8" y2="43.00" x2="228" y1="84" x1="228" /><line strokeWidth="8" y2="43.00" x2="303" y1="84" x1="303" />
              </svg>
            </div>
            <p style={{ marginTop: '30px', fontWeight: 700, color: 'var(--color-text)', opacity: 0.6 }}>Готовим расписание...</p>
          </div>
        ) : (
          <>
            <h1>{isAddingProfile ? 'Добавить профиль' : (isStudent ? 'Из какой ты группы?' : 'Выберите преподавателя')}</h1>
            <div className="card">
              <button className={`courseButton ${isStudent ? 'active' : ''}`} onClick={() => { setSelectedGroup(''); setSelectedTeacher(''); setUserType(ProfileType.STUDENT); }}>
                <OfflineIcon name="school" style={{ fontSize: '20px', marginRight: '8px' }} />Группа
              </button>
              <button className={`courseButton ${!isStudent ? 'active' : ''}`} onClick={() => { setSelectedGroup(''); setSelectedTeacher(''); setUserType(ProfileType.TEACHER); }}>
                <OfflineIcon name="person" style={{ fontSize: '20px', marginRight: '8px' }} />Преподаватель
              </button>
            </div>

            {isStudent ? (
              <>
                <div className="card"><span className="courseLabel">Курс:</span>{[1, 2, 3, 4].map((num) => (<button key={num} className={course === num ? 'courseButton active' : 'courseButton'} onClick={() => setCourse(course === num ? 0 : num)}>{num}</button>))}</div>
                <div className="card listCard">
                  {error && <p style={{ color: '#ff4b5c', fontWeight: 'bold' }}>{error}</p>}
                  {!error && <div className="groupGrid">{filteredGroups.map(g => (<button key={g} className={selectedGroup === g ? 'groupButton active' : 'groupButton'} onClick={() => setSelectedGroup(g)}>{g}</button>))}</div>}
                </div>
              </>
            ) : (
              <div className="card listCard">
                <input type="text" placeholder="🔍 Поиск преподавателя..." className="searchInput" value={teacherQuery} onChange={(e) => setTeacherQuery(e.target.value)} />
                <div className="teacherList">
                  {error && <p style={{ color: '#ff4b5c', fontWeight: 'bold' }}>{error}</p>}
                  {!error && filteredTeachers.map(t => (<button key={t} className={selectedTeacher === t ? 'teacherButton active' : 'teacherButton'} onClick={() => setSelectedTeacher(t)}>{t}{selectedTeacher === t && <span className="checkIcon"><OfflineIcon name="check" /></span>}</button>))}
                </div>
              </div>
            )}

            {(selectedGroup || selectedTeacher) && (
              <div className="fab-container">
                <button className="fab" onClick={handleNextClick} disabled={isLoading}>
                  <OfflineIcon name="arrow_forward" style={{ marginRight: '8px' }} />{isAddingProfile ? 'Добавить' : 'Продолжить'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}