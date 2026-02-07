import { useState, useEffect, useCallback } from 'react';
import { useHakedisStore } from '@/store/hakedisStore';
import * as api from '@/services/supabaseService';
import { defaultSubcontractors } from '@/data/mockData';

export function useSupabaseData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const {
    setProjects,
    setWorkEntries,
    setSubcontractorHakedisler,
    setSubcontractors,
    setActivityLogs,
  } = useHakedisStore();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize subcontractors first
      await api.initializeSubcontractors(defaultSubcontractors);

      // Load all data in parallel
      const [projects, contracts, hakedisler, subcontractors, activityLogs] = await Promise.all([
        api.fetchProjects(),
        api.fetchContracts(),
        api.fetchHakedisler(),
        api.fetchSubcontractors(),
        api.fetchActivityLogs(),
      ]);

      setProjects(projects);
      setWorkEntries(contracts);
      setSubcontractorHakedisler(hakedisler);
      setSubcontractors(subcontractors);
      setActivityLogs(activityLogs);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [setProjects, setWorkEntries, setSubcontractorHakedisler, setSubcontractors, setActivityLogs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { isLoading, error, refetch: loadData };
}
