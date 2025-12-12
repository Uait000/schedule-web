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
  isPractice?: boolean; // 🔥 ДОБАВЛЕНО
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