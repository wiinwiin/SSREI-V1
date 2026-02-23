import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, LeadFormData } from '../types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setLeads(data as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const createLead = async (formData: LeadFormData): Promise<Lead | null> => {
    const { data, error } = await supabase.from('leads').insert([formData]).select().maybeSingle();
    if (error) { setError(error.message); return null; }
    await fetchLeads();
    return data as Lead;
  };

  const updateLead = async (id: string, formData: Partial<LeadFormData>): Promise<Lead | null> => {
    const { data, error } = await supabase.from('leads').update(formData).eq('id', id).select().maybeSingle();
    if (error) { setError(error.message); return null; }
    await fetchLeads();
    return data as Lead;
  };

  const getLeadById = useCallback(async (id: string): Promise<Lead | null> => {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
    if (error) return null;
    return data as Lead;
  }, []);

  const deleteLead = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { setError(error.message); return false; }
    setLeads(prev => prev.filter(l => l.id !== id));
    return true;
  };

  return { leads, loading, error, fetchLeads, createLead, updateLead, getLeadById, deleteLead };
}
