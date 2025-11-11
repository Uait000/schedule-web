export interface CommonLesson {
  name: string;
  teacher: string;
  room: string;
}

export interface SubgroupedLessonData {
  teacher: string;
  room: string;
  subgroup_index: number;
}

export interface SubgroupedLesson {
  name: string;
  subgroups: SubgroupedLessonData[];
}

export interface Lesson {
  commonLesson?: CommonLesson;
  subgroupedLesson?: SubgroupedLesson;
  noLesson?: object; 
  group?: string;
}

export interface Day {
  lesson: Lesson[]; 
}

export interface Schedule {
  weeks: {
    days: Day[];
  }[];
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
}