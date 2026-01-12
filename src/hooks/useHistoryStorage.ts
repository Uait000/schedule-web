import { useState, useCallback, useEffect } from 'react';
import { HistoryEntry, OverridesResponse, Lesson } from '../types';
import { dataStore } from '../utils/DataStore';

function normalizeLesson(lesson: any): Lesson {
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }
  const findGroupAnywhere = (obj: any): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') return obj; 
    const candidates = ['group', 'Group', 'studentGroup', 'StudentGroup', 'className', 'targetGroup', 'target'];
    for (const key of candidates) {
        const val = obj[key];
        if (val) {
            if (typeof val === 'string' && val.trim().length > 0) return val;
        }
    }
    return undefined;
  };
  const globalGroup = findGroupAnywhere(lesson);
  const common = lesson.CommonLesson || lesson.commonLesson;
  if (common) {
    return { commonLesson: { 
      name: common.name || '', 
      teacher: common.teacher || '', 
      room: common.room || '', 
      group: findGroupAnywhere(common) || globalGroup 
    }};
  }
  const subgrouped = lesson.SubgroupedLesson || lesson.subgroupedLesson;
  if (subgrouped) {
    return { subgroupedLesson: {
      name: subgrouped.name || '',
      subgroups: (subgrouped.subgroups || []).map((sub: any) => ({
        teacher: sub.teacher || '', room: sub.room || '', subgroup_index: sub.subgroup_index || 0, group: findGroupAnywhere(sub) || globalGroup 
      }))
    }};
  }
  return { noLesson: {} };
}

export function useHistoryStorage(profileId: string | null) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback((pid: string) => {
    const fullHistory = dataStore.getState().overrideHistory || [];
    const profileHistory = fullHistory.filter(entry => entry.profileId === pid);
    profileHistory.sort((a, b) => b.timestamp - a.timestamp);
    setHistory(profileHistory);
  }, []);

  const addEntry = useCallback(async (newEntryData: OverridesResponse) => {
    if (!profileId) return;

    const rawOverrides = Array.isArray(newEntryData.overrides) 
      ? newEntryData.overrides 
      : (newEntryData as any).overrides?.overrides;

    if (!rawOverrides || rawOverrides.length === 0) return;
    if (newEntryData.day === undefined || newEntryData.month === undefined || newEntryData.year === undefined) return;

    const normalizedOverrides = rawOverrides.map(o => ({
      ...o,
      shouldBe: normalizeLesson(o.shouldBe),
      willBe: normalizeLesson(o.willBe)
    }));

    const newEntry: HistoryEntry = {
      ...newEntryData,
      overrides: normalizedOverrides,
      profileId: profileId,
      timestamp: Date.now()
    };

    await dataStore.updateData(state => {
      const currentHistory = state.overrideHistory || [];
      const filtered = currentHistory.filter(h => 
        !(h.profileId === profileId && h.day === newEntry.day && h.month === newEntry.month && h.year === newEntry.year)
      );
      return {
        ...state,
        overrideHistory: [newEntry, ...filtered]
      };
    });

    setHistory(prev => {
      const filtered = prev.filter(h => !(h.day === newEntry.day && h.month === newEntry.month && h.year === newEntry.year));
      return [newEntry, ...filtered].sort((a, b) => b.timestamp - a.timestamp);
    });

  }, [profileId]);

  useEffect(() => {
    if (profileId) { loadHistory(profileId); } 
    else { setHistory([]); }
  }, [profileId, loadHistory]);

  return { history, addEntry };
}