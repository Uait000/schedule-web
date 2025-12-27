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
    // 🔥 ИСПРАВЛЕНО: Убрали немедленный вызов listener(this.state), 
    // чтобы не провоцировать лишний цикл обновлений при подписке
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    // Делаем копию состояния, чтобы React понимал, что объект изменился
    const currentState = { ...this.state };
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

  async setProfile(type: ProfileType, profileData: Profile): Promise<void> {
    const key = type.toLowerCase() as 'student' | 'teacher';
    await this.updateData(state => ({
      ...state,
      profiles: {
        ...state.profiles,
        [key]: profileData
      }
    }));
  }

  async setLastUsed(type: ProfileType): Promise<void> {
    await this.updateData(state => ({
      ...state,
      lastUsed: type,
      profiles: {
        ...state.profiles,
        lastUsed: type
      }
    }));
  }

  getCurrentProfile(): Profile | undefined {
    const key = this.state.lastUsed.toLowerCase() as 'student' | 'teacher';
    return this.state.profiles[key];
  }

  async addCustomCourse(course: CustomCourse): Promise<void> {
    await this.updateData(state => ({
      ...state,
      customCourses: [...state.customCourses, course]
    }));
  }

  async removeCustomCourse(courseId: string): Promise<void> {
    await this.updateData(state => ({
      ...state,
      customCourses: state.customCourses.filter(c => c.id !== courseId)
    }));
  }

  clear(): void {
    this.state = { ...DEFAULT_STATE };
    this.saveState();
  }
}

export const dataStore = DataStore.getInstance();