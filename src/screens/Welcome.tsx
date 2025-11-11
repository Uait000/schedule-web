import { useState, useEffect } from 'react';
import '../App.css';
import { useNavigate } from 'react-router-dom';


interface Group {
  id: string;
  name: string;
}

type UserType = 'student' | 'teacher';

interface Items {
	teachers: string[];
	groups: string[];
}

export const API_BASE_URL = 'https://ttgt-api-isxb.onrender.com/schedule';

console.log('🔧 Прямое подключение к API:', API_BASE_URL);

export const fetchData = async (url: string) => {
  try {
    console.log('🔄 Запрос к:', url);
    const response = await fetch(API_BASE_URL+url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('✅ Ответ от сервера:', data);
    return data;
  } catch (error) {
    console.error('❌ Ошибка fetch:', error);
    throw error;
  }
};

export function WelcomeScreen() {
  const navigate = useNavigate();

  const [userType, setUserType] = useState<UserType>('student');
  const [course, setCourse] = useState(0);
  
  const [items, setItems] = useState<Items>({ teachers: [], groups: [] });
  
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [teacherQuery, setTeacherQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = userType === 'student';

  
  useEffect(() => {
    setIsLoading(true);
    setError(null);

	fetchData(`/items`)
		.catch((error)=>{
			console.error("Ошибка получения элементов:", error)
		})
		.then((result)=>{
			setIsLoading(false)
			setItems({
				groups: result.groups.sort(),
				teachers: result.teachers.sort()
			})
		})
  }, [API_BASE_URL]);

  
  const filteredGroups = items.groups
    .filter(group => 
      course === 0 || group.includes(`-${course}-`)
    );

  const filteredTeachers = items.teachers
    .filter(teacher => 
      teacher.toLowerCase().replace(/\s/g, '').replace(/\./g, '')
        .includes(teacherQuery.toLowerCase().replace(/\s/g, '').replace(/\./g, ''))
    );

  function handleNextClick() {
    if (!selectedGroup && !selectedTeacher) return;
    
    const id = isStudent ? selectedGroup : selectedTeacher;
    const type = isStudent ? 'student' : 'teacher';

    localStorage.setItem('userType', type);
    localStorage.setItem('selectedId', id);
    
    navigate('/schedule');
  }

  return (
    <div className="container">
      <h1>{isStudent ? 'Из какой ты группы?' : 'Выберите преподавателя'}</h1>
      <button 
        className="linkButton"
        onClick={() => {
          setSelectedGroup('');
          setSelectedTeacher('');
          setTeacherQuery('');
          setUserType(isStudent ? 'teacher' : 'student');
        }}
      >
        {isStudent ? 'Войти как преподаватель' : 'Войти как студент'}
      </button>

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
            {isLoading && <p>Загрузка...</p>}
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
                    Нет доступных групп. Попробуйте другой курс или проверьте подключение.
                </p>
            )}
          </div>
        </>
      )}

      {!isStudent && (
        <div className="card listCard">
          <input 
            type="text"
            placeholder="🔍 Поиск"
            className="searchInput"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
          />
          <div className="teacherList">
            {isLoading && <p>Загрузка...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!isLoading && !error && filteredTeachers.map(teacher => (
              <button
                key={teacher}
                className={selectedTeacher === teacher ? 'teacherButton active' : 'teacherButton'}
                onClick={() => setSelectedTeacher(teacher)}
              >
                {teacher}
                {selectedTeacher === teacher && (
                  <span className="checkIcon">✓</span>
                )}
              </button>
            ))}
            {!isLoading && !error && filteredTeachers.length === 0 && teacherQuery.length > 0 && (
                <p style={{ color: 'var(--color-secondary-text)' }}>
                    Преподаватель не найден.
                </p>
            )}
            {!isLoading && !error && filteredTeachers.length === 0 && teacherQuery.length === 0 && (
                <p style={{ color: 'var(--color-secondary-text)' }}>
                    Нет доступных преподавателей.
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
          >
            Далее
          </button>
        </div>
      )}

      <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p><strong>Прямое подключение к:</strong> {API_BASE_URL}</p>
        <p><strong>Режим:</strong> {(import.meta as any).env?.MODE || 'production'}</p>
        <p><strong>Статус:</strong> {isLoading ? 'Загрузка...' : error ? 'Ошибка' : 'Готово'}</p>
      </div>
    </div>
  );
}
