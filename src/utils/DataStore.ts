// src/utils/DataStore.ts
import { ProfileType, ProfilesState, Profile } from '../types/profiles';
import { HistoryEntry, CustomCourse } from '../types';

export interface ProfileMetadata {
  scheduleUpdate: number;
  eventsHash: string;
  events?: any[];
}

export interface AppState {
  profiles: ProfilesState;
  profileMetadata: Record<string, ProfileMetadata>;
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
  profileMetadata: {},
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
          profileMetadata: parsed.profileMetadata || {},
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
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    // 🔥 ВАЖНО: Создаем копию объекта состояния и вложенных массивов, 
    // чтобы React увидел изменение ссылок и вызвал ререндер.
    const currentState = { 
        ...this.state,
        profiles: { ...this.state.profiles },
        customCourses: [...this.state.customCourses],
        profileMetadata: { ...this.state.profileMetadata }
    };
    this.listeners.forEach(listener => listener(currentState));
  }

  async updateData(updater: (state: AppState) => AppState): Promise<void> {
    this.state = updater(this.state);
    this.saveState();
  }

  getState(): AppState {
    return { ...this.state };
  }

  getProfileMetadata(profileId: string): ProfileMetadata {
    return this.state.profileMetadata[profileId] || { scheduleUpdate: 0, eventsHash: "" };
  }

  async updateProfileMetadata(profileId: string, metadata: Partial<ProfileMetadata>): Promise<void> {
    await this.updateData(state => ({
      ...state,
      profileMetadata: {
        ...state.profileMetadata,
        [profileId]: {
          ...(state.profileMetadata[profileId] || { scheduleUpdate: 0, eventsHash: "" }),
          ...metadata
        }
      }
    }));
  }

  async addCustomCourse(course: CustomCourse): Promise<void> {
    await this.updateData(state => ({
      ...state,
      customCourses: [...state.customCourses, course] // Создаем новый массив
    }));
    // Вызываем событие для синхронизации, если открыто несколько вкладок
    window.dispatchEvent(new Event('storage'));
  }

  async removeCustomCourse(courseId: string): Promise<void> {
    await this.updateData(state => ({
      ...state,
      customCourses: state.customCourses.filter(c => c.id !== courseId)
    }));
  }

  getCurrentProfile(): Profile | undefined {
    const key = this.state.lastUsed.toLowerCase() as 'student' | 'teacher';
    return this.state.profiles[key];
  }

  async setLastUsed(type: ProfileType): Promise<void> {
    await this.updateData(state => ({
      ...state,
      lastUsed: type,
      profiles: { ...state.profiles, lastUsed: type }
    }));
  }

  clear(): void {
    this.state = { ...DEFAULT_STATE };
    this.saveState();
  }
}

export const dataStore = DataStore.getInstance();