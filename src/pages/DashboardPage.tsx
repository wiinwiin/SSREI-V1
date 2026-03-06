import React, { useEffect, useState } from 'react';
import { Users, Flame, Send, PhoneOff, ExternalLink, CheckSquare, Square, ChevronRight, Calendar } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import { SCORE_TIER_COLORS } from '../lib/scoring';
import type { Contact, ImportBatch, ContactActivityLog } from '../types';

const getContactDisplayName = (contact: Contact | { first_name?: string; last_name?: string; property_name?: string; lead_type?: string }): string => {
  if (contact.lead_type === 'commercial') {
    return contact.property_name || 'Unknown Property';
  }
  return `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unknown Contact';
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
          <p className="text-white text-3xl font-bold">{value.toLocaleString()}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const CHECKLIST_KEYS = [
  { key: 'ghl_api_configured', label: 'Add GHL API Key in Settings' },
  { key: 'ghl_location_configured', label: 'Add GHL Location ID in Settings' },
  { key: 'ghl_pipeline_configured', label: 'Add GHL Pipeline ID in Settings' },
  { key: 'first_import_done', label: 'Import first CSV batch' },
  { key: 'first_push_done', label: 'Push first leads to GHL' },
];

export function DashboardPage() {
  const { navigate } = useRouter();
  const [stats, setStats] = useState({ total: 0, hot: 0, pushed: 0, dnc: 0 });
  const [hotLeads, setHotLeads] = useState<Contact[]>([]);
  const [lastBatch, setLastBatch] = useState<ImportBatch | null>(null);
  const [recentActivity, setRecentActivity] = useState<ContactActivityLog[]>([]);
  const [followUps, setFollowUps] = useState<Contact[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];

      const [
        { count: total },
        { count: hot },
        { count: pushed },
        { count: dnc },
        { data: topLeads },
        { data: batch },
        { data: activity },
        { data: fups },
        { data: settings },
        { count: importCount },
        { count: pushCount },
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('distress_score', 15),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('pushed_to_ghl', true),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('dnc_toggle', true),
        supabase.from('contacts').select('id,first_name,last_name,property_name,lead_type,property_address,property_city,property_state,distress_score,score_tier,overall_status').order('distress_score', { ascending: false }).limit(5),
        supabase.from('import_batches').select('*').order('uploaded_at', { ascending: false }).limit(1),
        supabase.from('contact_activity_logs').select('*,contacts(first_name,last_name,property_name,lead_type,property_address)').order('action_at', { ascending: false }).limit(5),
        supabase.from('contacts').select('id,first_name,last_name,property_name,lead_type,property_address,property_city,property_state,distress_score,score_tier').eq('follow_up_date', today),
        supabase.from('app_settings').select('key,value'),
        supabase.from('import_batches').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('pushed_to_ghl', true),
      ]);

      setStats({ total: total ?? 0, hot: hot ?? 0, pushed: pushed ?? 0, dnc: dnc ?? 0 });
      setHotLeads((topLeads ?? []) as Contact[]);
      setLastBatch((batch as ImportBatch[])?.[0] ?? null);
      setRecentActivity((activity ?? []) as ContactActivityLog[]);
      setFollowUps((fups ?? []) as Contact[]);

      const settingsMap: Record<string, string> = {};
      ((settings ?? []) as { key: string; value?: string }[]).forEach(s => { settingsMap[s.key] = s.value ?? ''; });

      setChecklist({
        ghl_api_configured: !!settingsMap['api_key'],
        ghl_location_configured: !!settingsMap['location_id'],
        ghl_pipeline_configured: !!settingsMap['pipeline_id'],
        first_import_done: (importCount ?? 0) > 0,
        first_push_done: (pushCount ?? 0) > 0,
      });

      setLoading(false);
    };
    load();
  }, []);

  const allChecklistDone = CHECKLIST_KEYS.every(k => checklist[k.key]);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#1E6FA4] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" subtitle="SSREI Real Estate CRM Overview">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Contacts" value={stats.total} icon={<Users size={18} className="text-[#1E90FF]" />} color="bg-[#1E90FF]/15" />
          <StatCard label="Hot Leads" value={stats.hot} icon={<Flame size={18} className="text-red-400" />} color="bg-red-500/15" />
          <StatCard label="Pushed to GHL" value={stats.pushed} icon={<Send size={18} className="text-emerald-400" />} color="bg-emerald-500/15" />
          <StatCard label="DNC Flagged" value={stats.dnc} icon={<PhoneOff size={18} className="text-orange-400" />} color="bg-orange-500/15" />
        </div>

        {!allChecklistDone && (
          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
            <h3 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#1E90FF] rounded-full inline-block" />
              Getting Started Checklist
            </h3>
            <div className="space-y-2">
              {CHECKLIST_KEYS.map(item => (
                <div key={item.key} className="flex items-center gap-3">
                  {checklist[item.key]
                    ? <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                    : <Square size={16} className="text-white/25 flex-shrink-0" />
                  }
                  <span className={`text-sm ${checklist[item.key] ? 'text-white/40 line-through' : 'text-white/70'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm">Top 5 Hot Leads</h3>
              <button onClick={() => navigate('contacts')} className="text-[#1E90FF] text-xs hover:underline flex items-center gap-1">
                View all <ChevronRight size={12} />
              </button>
            </div>
            {hotLeads.length === 0 ? (
              <p className="text-white/35 text-sm text-center py-6">No contacts yet. Import a CSV to get started.</p>
            ) : (
              <div className="space-y-2">
                {hotLeads.map(c => (
                  <button
                    key={c.id}
                    onClick={() => navigate('contact-detail', c.id)}
                    className="w-full flex items-center gap-3 p-3 bg-[#0A1628] hover:bg-white/5 rounded-lg text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">
                        {getContactDisplayName(c)}
                      </div>
                      <div className="text-white/40 text-xs truncate">
                        {c.property_address}{c.property_city ? `, ${c.property_city}` : ''}{c.property_state ? `, ${c.property_state}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.score_tier && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCORE_TIER_COLORS[c.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                          {c.score_tier}
                        </span>
                      )}
                      <span className="text-white/30 text-xs font-mono">{c.distress_score}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
            <h3 className="text-white font-medium text-sm mb-4">Last Import Batch</h3>
            {!lastBatch ? (
              <p className="text-white/35 text-sm text-center py-6">No imports yet.</p>
            ) : (
              <div>
                <div className="mb-3">
                  <div className="text-white font-medium">{lastBatch.batch_name}</div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {lastBatch.uploaded_by} · {lastBatch.uploaded_at ? new Date(lastBatch.uploaded_at).toLocaleDateString() : ''}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total', value: lastBatch.total_rows ?? 0, color: 'text-white' },
                    { label: 'Clean', value: lastBatch.clean_count ?? 0, color: 'text-emerald-400' },
                    { label: 'DNC', value: lastBatch.dnc_count ?? 0, color: 'text-orange-400' },
                    { label: 'Litigator', value: lastBatch.litigator_count ?? 0, color: 'text-red-400' },
                    { label: 'Duplicate', value: lastBatch.duplicate_count ?? 0, color: 'text-zinc-400' },
                    { label: 'Pushed GHL', value: lastBatch.pushed_to_ghl_count ?? 0, color: 'text-[#1E90FF]' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#0A1628] rounded-lg p-2.5 text-center">
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-white/40 text-xs mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm">Recent Activity</h3>
              <button onClick={() => navigate('activity-log')} className="text-[#1E90FF] text-xs hover:underline flex items-center gap-1">
                View all <ChevronRight size={12} />
              </button>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-white/35 text-sm text-center py-6">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/5">
                    <div className="w-1.5 h-1.5 bg-[#1E90FF] rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs truncate">
                        <span className="font-medium">{log.contacts ? getContactDisplayName(log.contacts) : 'Unknown'}</span>
                        <span className="text-white/40"> — {log.action}</span>
                      </div>
                      {log.action_detail && (
                        <div className="text-white/30 text-xs truncate">{log.action_detail}</div>
                      )}
                    </div>
                    <div className="text-white/30 text-xs flex-shrink-0">{timeAgo(log.action_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <Calendar size={14} className="text-[#1E90FF]" />
                Today's Follow-ups
              </h3>
            </div>
            {followUps.length === 0 ? (
              <p className="text-white/35 text-sm text-center py-6">No follow-ups scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {followUps.map(c => (
                  <button
                    key={c.id}
                    onClick={() => navigate('contact-detail', c.id)}
                    className="w-full flex items-center gap-3 p-3 bg-[#0A1628] hover:bg-white/5 rounded-lg text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{getContactDisplayName(c)}</div>
                      <div className="text-white/40 text-xs truncate">{c.property_address}</div>
                    </div>
                    {c.score_tier && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${SCORE_TIER_COLORS[c.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                        {c.score_tier}
                      </span>
                    )}
                    <ExternalLink size={12} className="text-white/25 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
