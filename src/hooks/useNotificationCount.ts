import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useNotificationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { count: c } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setCount(c ?? 0);
    };
    fetch();

    const channel = supabase
      .channel('notifications-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
