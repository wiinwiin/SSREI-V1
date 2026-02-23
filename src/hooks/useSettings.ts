import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AppSettings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').maybeSingle();
    setSettings(data as AppSettings);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async (updates: Partial<AppSettings>): Promise<boolean> => {
    if (settings?.id) {
      const { error } = await supabase.from('settings').update(updates).eq('id', settings.id);
      if (error) return false;
    } else {
      const { error } = await supabase.from('settings').insert([updates]);
      if (error) return false;
    }
    await fetchSettings();
    return true;
  };

  return { settings, loading, saveSettings };
}
