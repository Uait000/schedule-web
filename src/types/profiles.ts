export enum ProfileType {
  STUDENT = 'student',
  TEACHER = 'teacher'
}

export interface Profile {
  type: ProfileType;
  id: string;
  name: string;
  schedule: any;
  overrides: any;
}

export interface ProfilesState {
  student?: Profile;
  teacher?: Profile;
  lastUsed: ProfileType;
}

export const hasStudent = (profiles: ProfilesState): boolean => !!profiles.student;
export const hasTeacher = (profiles: ProfilesState): boolean => !!profiles.teacher;
export const getProfile = (profiles: ProfilesState, type: ProfileType): Profile | undefined => 
  type === ProfileType.STUDENT ? profiles.student : profiles.teacher;