// src/types.ts

export interface CommonLesson {
  name: string;
  teacher: string;
  room: string;
  group?: string;
}

export interface SubgroupedLessonData {
  teacher: string;
  room: string;
  subgroup_index: number;
  group?: string;
}

export interface SubgroupedLesson {
  name: string;
  subgroups: SubgroupedLessonData[];
}

export interface Lesson {
  commonLesson?: CommonLesson;
  subgroupedLesson?: SubgroupedLesson;
  noLesson?: object; 
}

export interface Day {
  lessons: Lesson[];
}

export interface Schedule {
  weeks: {
    days: Day[];
  }[];
  name?: string;
}

export interface Override {
  index: number;
  willBe: Lesson;
  shouldBe: Lesson;
}

export interface OverridesResponse {
  weekNum: number;
  weekDay: number;
  overrides: Override[];
  day?: number;
  month?: number;
  year?: number;
  isPractice?: boolean;
  practiceTitle?: string;
  practiceCode?: string;
  isBlocking?: boolean;
  dateStart?: string;
  dateEnd?: string;
  returnDate?: string;
}

export interface CalendarEvent {
  title: string;
  code: string;
  type: 'holiday' | 'attestation' | 'gia' | 'practice';
  dateStart: string;
  dateEnd: string;
  weeks_count: number;
}

export interface EventsResponse {
  events: CalendarEvent[];
  sha256: string;
}

// 🔥 Новый тип для комбинированного ответа /info
export interface InfoResponse {
  overrides?: OverridesResponse; // Придет, если дата изменилась
  schedule?: Schedule;           // Придет, если файл обновился
  events?: EventsResponse;       // Придет, если хеш не совпал
  update?: any;
  schedule_update?: number;      // Timestamp обновления расписания на сервере
}

export interface HistoryEntry extends OverridesResponse {
  profileId: string;
  timestamp: number;
}

export interface CustomCourse {
  id: string;
  profileId: string;
  name: string;
  teacher: string;
  room: string;
  weekIndex: number;
  dayIndex: number;
  lessonIndex: number;
}