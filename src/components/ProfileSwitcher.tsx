import { useState } from 'react';
import { ProfileType, ProfilesState } from '../types/profiles';
import '../App.css';

interface ProfileSwitcherProps {
  profiles: ProfilesState;
  currentProfileType: ProfileType;
  onSwitch: (type: ProfileType, profile: any) => void;
  onAddProfile: () => void;
  isLoading?: boolean;
}

export function ProfileSwitcher({ 
  profiles, 
  currentProfileType, 
  onSwitch, 
  onAddProfile,
  isLoading = false 
}: ProfileSwitcherProps) {
  const [isRotating, setIsRotating] = useState(false);

  console.log('🔍 ProfileSwitcher: текущие профили', profiles);
  console.log('🎯 ProfileSwitcher: текущий тип профиля', currentProfileType);
  
  const hasStudent = !!profiles.student;
  const hasTeacher = !!profiles.teacher;
  
  // Используем currentProfileType из пропсов
  const currentProfile = currentProfileType === ProfileType.TEACHER 
    ? profiles.teacher 
    : profiles.student;

  const targetProfile = currentProfileType === ProfileType.TEACHER 
    ? profiles.student 
    : profiles.teacher;

  console.log('🎯 ProfileSwitcher: текущий профиль', currentProfile);
  console.log('🔄 ProfileSwitcher: может переключаться?', hasStudent && hasTeacher);

  // СЦЕНАРИЙ 1: ЕСТЬ ОБА ПРОФИЛЯ (Показываем кнопку переключения)
  if (hasStudent && hasTeacher) {
    const handleSwitch = () => {
      if (isRotating || isLoading) return;
      
      setIsRotating(true);
      
      const newType = currentProfileType === ProfileType.TEACHER 
        ? ProfileType.STUDENT 
        : ProfileType.TEACHER;
      
      const newProfile = newType === ProfileType.TEACHER 
        ? profiles.teacher 
        : profiles.student;

      console.log('🔄 ProfileSwitcher: переключаем на', newType, newProfile);
      
      // Вызываем колбэк переключения
      if (newProfile) {
        onSwitch(newType, newProfile);
      }
      
      setTimeout(() => {
        setIsRotating(false);
      }, 300);
    };

    return (
      <div className="profile-switcher-container">
        <button 
          id="tour-profile-icon" // 👈 ID для гайда (кнопка переключения)
          className={`profile-switcher ${isRotating ? 'rotating' : ''} ${isLoading ? 'loading' : ''}`}
          onClick={handleSwitch}
          title={`Переключиться на ${targetProfile?.name || 'другой профиль'}`}
          disabled={isRotating || isLoading}
        >
          <span className="material-icons">switch_account</span>
        </button>
        
        <div className="profile-info">
          <span className="profile-type">
            {currentProfileType === ProfileType.TEACHER ? 'Преподаватель' : 'Группа'}:
          </span>
          <span className="profile-name">{currentProfile?.name}</span>
          <span className="profile-hint">
            Нажмите для переключения на {targetProfile?.name}
          </span>
        </div>
      </div>
    );
  }

  // СЦЕНАРИЙ 2: ОДИН ПРОФИЛЬ ИЛИ НЕТ ВООБЩЕ
  return (
    <div className="profile-info-only">
      <div 
        id="tour-profile-icon" // 👈 ID для гайда (статичная иконка)
        className="profile-icon"
      >
        <span className="material-icons">
          {!hasStudent && !hasTeacher ? 'person' : 
           currentProfileType === ProfileType.TEACHER ? 'person' : 'school'}
        </span>
      </div>
      
      <div className="profile-info">
        <span className="profile-type">
          {!hasStudent && !hasTeacher ? 'Профиль' :
           currentProfileType === ProfileType.TEACHER ? 'Преподаватель' : 'Группа'}:
        </span>
        <span className="profile-name">
          {currentProfile?.name || 'Не выбран'}
        </span>
        <span className="profile-hint">
          {!hasStudent && !hasTeacher 
            ? 'Выберите группу или преподавателя' 
            : `Добавьте ${currentProfileType === ProfileType.TEACHER ? 'группу' : 'преподавателя'} для переключения`
          }
        </span>
      </div>

      <button 
        id="tour-add-profile" // 👈 ID для гайда (кнопка добавления)
        className="add-profile-button"
        onClick={onAddProfile}
        disabled={isLoading}
        title={!hasStudent && !hasTeacher ? 'Выбрать профиль' : `Добавить ${currentProfileType === ProfileType.TEACHER ? 'группу' : 'преподавателя'}`}
      >
        <span className="material-icons">add</span>
        <span className="add-profile-text">
          {!hasStudent && !hasTeacher ? 'Выбрать' : 'Добавить'}
        </span>
      </button>
    </div>
  );
}