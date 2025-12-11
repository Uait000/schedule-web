// src/utils/DataStore.ts

import { ProfileType, ProfilesState, Profile } from '../types/profiles';
import { HistoryEntry, CustomCourse } from '../types';

export interface AppState {
  profiles: ProfilesState;
  overrideHistory: HistoryEntry[];
  customCourses: CustomCourse[]; 
  feedbackSent: boolean;
  firstTimeLaunch: number;
  lastUsed: ProfileType;
}

const DEFAULT_STATE: AppState = {
  profiles: { 
    lastUsed: ProfileType.STUDENT,
    student: undefined,
    teacher: undefined
  },
  overrideHistory: [],
  customCourses: [], 
  feedbackSent: false,
  firstTimeLaunch: 0,
  lastUsed: ProfileType.STUDENT
};

const STORAGE_KEY = 'app_data_store';

export class DataStore {
  private static instance: DataStore;
  private state: AppState;
  private listeners: Array<(state: AppState) => void> = [];

  private constructor() {
    this.state = this.loadState();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private loadState(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { 
          ...DEFAULT_STATE, 
          ...parsed,
          profiles: {
            ...DEFAULT_STATE.profiles,
            ...(parsed.profiles || {})
          },
          overrideHistory: Array.isArray(parsed.overrideHistory) ? parsed.overrideHistory : [],
          customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [] 
        };
      }
    } catch (error) {
      console.error('Error loading app state:', error);
    }
    return DEFAULT_STATE;
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving app state:', error);
    }
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  async updateData(updater: (state: AppState) => AppState): Promise<void> {
    this.state = updater(this.state);
    this.saveState();
  }

  getState(): AppState {
    return this.state;
  }

  setProfile(type: ProfileType, profileData: Profile): void {
    this.updateData(state => ({
      ...state,
      profiles: {
        ...state.profiles,
        [type]: profileData
      }
    }));
  }

  setLastUsed(type: ProfileType): void {
    this.updateData(state => ({
      ...state,
      lastUsed: type,
      profiles: {
        ...state.profiles,
        lastUsed: type
      }
    }));
  }

  getCurrentProfile(): Profile | undefined {
    return this.state.profiles[this.state.lastUsed];
  }

  addOverrideHistory(entry: HistoryEntry): void {
    const currentProfileId = this.state.profiles[this.state.lastUsed]?.id;
    
    // 🔥 FIX: Приводим к типу string явно, так как мы знаем, что ID должен быть
    const entryWithId: HistoryEntry = { 
        ...entry, 
        profileId: (entry.profileId || currentProfileId) as string 
    };

    if (!entryWithId.profileId) return;

    this.updateData(state => {
        const cleanHistory = state.overrideHistory.filter(item => 
            !(item.profileId === entryWithId.profileId && 
              item.day === entryWithId.day && 
              item.month === entryWithId.month && 
              item.year === entryWithId.year)
        );
        
        return {
            ...state,
            overrideHistory: [entryWithId, ...cleanHistory].slice(0, 50)
        };
    });
  }

  addCustomCourse(course: CustomCourse): void {
    this.updateData(state => ({
      ...state,
      customCourses: [...state.customCourses, course]
    }));
  }

  removeCustomCourse(courseId: string): void {
    this.updateData(state => ({
      ...state,
      customCourses: state.customCourses.filter(c => c.id !== courseId)
    }));
  }

  clear(): void {
    this.state = DEFAULT_STATE;
    this.saveState();
  }
}

export const dataStore = DataStore.getInstance();