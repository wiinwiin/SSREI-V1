import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Download, X, Filter, ChevronDown,
  FileInput, PenLine, PhoneOff, Phone, CheckCircle2,
  XCircle, Copy, AlertTriangle, RefreshCw, GitBranch,
  Edit, Trash2, PhoneCall, MessageSquare, FileText,
  DollarSign, Paperclip, Building2, Star, ScanSearch,
  Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import type { ContactActivityLog } from '../types';

const PAGE_SIZE = 50;

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'CSV Imported':        { icon: <FileInput size={13} />,     color: 'text-sky-400',     bg: 'bg-sky-900/30 border-sky-700/40' },
  'Manually Added':      { icon: <PenLine size={13} />,       color: 'text-sky-300',     bg: 'bg-sky-900/20 border-sky-700/30' },
  'DNC Toggled ON':      { icon: <PhoneOff size={13} />,      color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700/40' },
  'DNC Toggled OFF':     { icon: <Phone size={13} />,         color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/40' },
  'Pushed to GHL':       { icon: <CheckCircle2 size={13} />,  color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/40' },
  'GHL Push Failed':     { icon: <XCircle size={13} />,       color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700/40' },
  'Duplicate Detected':  { icon: <Copy size={13} />,          color: 'text-zinc-400',    bg: 'bg-zinc-800 border-zinc-700/40' },
  'Litigator Flagged':   { icon: <AlertTriangle size={13} />, color: 'text-orange-400',  bg: 'bg-orange-900/30 border-orange-700/40' },
  'Re-Push Attempted':   { icon: <RefreshCw size={13} />,     color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-700/40' },
  'Stage Changed':       { icon: <GitBranch size={13} />,     color: 'text-[#1E90FF]',   bg: 'bg-[#1E90FF]/10 border-[#1E90FF]/30' },
  'Contact Edited':      { icon: <Edit size={13} />,          color: 'text-yellow-400',  bg: 'bg-yellow-900/20 border-yellow-700/30' },
  'Batch Deleted':       { icon: <Trash2 size={13} />,        color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700/40' },
  'Call Logged':         { icon: <PhoneCall size={13} />,     color: 'text-teal-400',    bg: 'bg-teal-900/30 border-teal-700/40' },
  'Disposition Logged':  { icon: <MessageSquare size={13} />, color: 'text-violet-400',  bg: 'bg-violet-900/30 border-violet-700/40' },
  'Note Added':          { icon: <FileText size={13} />,      color: 'text-slate-300',   bg: 'bg-slate-800 border-slate-600/40' },
  'Offer Added':         { icon: <DollarSign size={13} />,    color: 'text-green-400',   bg: 'bg-green-900/30 border-green-700/40' },
  'Document Added':      { icon: <Paperclip size={13} />,     color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-700/30' },
  'Sent to Buyer':       { icon: <Building2 size={13} />,     color: 'text-cyan-400',    bg: 'bg-cyan-900/30 border-cyan-700/40' },
  'Priority Flagged':    { icon: <Star size={13} />,          color: 'text-yellow-400',  bg: 'bg-yellow-900/20 border-yellow-700/30' },
  'Skip Traced':         { icon: <ScanSearch size={13} />,    color: 'text-purple-400',  bg: 'bg-purple-900/30 border-purple-700/40' },
};

const DEFAULT_CONFIG = { icon: <FileText size={13} />, color: 'text-white/50', bg: 'bg-white/5 border-white/10' };
const ALL_ACTION_TYPES = Object.keys(ACTION_CONFIG);

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function escapeCsv(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ActivityLogPage() {
  const { navigate } = useRouter();
  const [logs, setLogs] = useState<ContactActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const [allUsers, setAllUsers] = useState<string[]>([]);

  const buildQuery = useCallback((forExport = false) => {
    let q = supabase
      .from('contact_activity_logs')
      .select('*,contacts(first_name,last_name,property_address)', { count: 'exact' });

    if (search) {
      q = q.or(`action.ilike.%${search}%,action_detail.ilike.%${search}%,action_by.ilike.%${search}%`);
    }
    if (filterActions.length) q = q.in('action', filterActions);
    if (filterUser) q = q.ilike('action_by', `%${filterUser}%`);
    if (filterDateFrom) q = q.gte('action_at', filterDateFrom);
    if (filterDateTo) {
      const end = new Date(filterDateTo);
      end.setDate(end.getDate() + 1);
      q = q.lt('action_at', end.toISOString().split('T')[0]);
    }

    q = q.order('action_at', { ascending: false });
    if (!forExport) {
      q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    } else {
      q = q.limit(10000);
    }
    return q;
  }, [search, filterActions, filterUser, filterDateFrom, filterDateTo, page]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count } = await buildQuery(false);
    setLogs((data ?? []) as ContactActivityLog[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('contact_activity_logs')
        .select('action_by')
        .not('action_by', 'is', null);
      const users = [...new Set((data ?? []).map((r: { action_by?: string }) => r.action_by).filter(Boolean))] as string[];
      setAllUsers(users.sort());
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node)) {
        setShowActionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowActionDropdown(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    const { data } = await buildQuery(true);
    const rows = (data ?? []) as ContactActivityLog[];

    const headers = ['Contact Name', 'Property Address', 'Action', 'Detail', 'By', 'Timestamp'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        escapeCsv(r.contacts ? `${r.contacts.first_name ?? ''} ${r.contacts.last_name ?? ''}`.trim() : ''),
        escapeCsv(r.contacts?.property_address ?? ''),
        escapeCsv(r.action ?? ''),
        escapeCsv(r.action_detail ?? ''),
        escapeCsv(r.action_by ?? ''),
        escapeCsv(r.action_at ? formatDate(r.action_at) : ''),
      ].join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSREI_activity_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const hasActiveFilters = filterActions.length > 0 || !!filterUser || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => {
    setFilterActions([]); setFilterUser(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(0);
  };

  const toggleActionFilter = (action: string) => {
    setFilterActions(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]);
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Layout
      title="Activity Log"
      subtitle={`${total.toLocaleString()} total event${total !== 1 ? 's' : ''}`}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showFilters || hasActiveFilters ? 'bg-[#1E6FA4]/20 text-[#1E90FF] border-[#1E6FA4]/40' : 'border-white/15 text-white/60 hover:text-white'}`}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && (
              <span className="bg-[#1E90FF] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {[filterActions.length > 0, !!filterUser, !!filterDateFrom, !!filterDateTo].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 border border-white/15 text-white/60 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-40"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search actions, details, or team member..."
            className="w-full bg-[#0D1F38] border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div ref={actionDropdownRef} className="relative">
                <button
                  onClick={() => setShowActionDropdown(!showActionDropdown)}
                  className="flex items-center gap-2 bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none hover:border-white/25"
                >
                  {filterActions.length === 0 ? (
                    <span className="text-white/50">All Action Types</span>
                  ) : (
                    <span className="text-[#1E90FF]">{filterActions.length} selected</span>
                  )}
                  <ChevronDown size={13} className="text-white/30" />
                </button>
                {showActionDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-[#0D1F38] border border-white/15 rounded-xl shadow-2xl p-2 w-60 max-h-80 overflow-y-auto">
                    <button
                      onClick={() => { setFilterActions([]); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors mb-1"
                    >
                      Clear selection
                    </button>
                    <div className="border-t border-white/8 pt-1">
                      {ALL_ACTION_TYPES.map(action => {
                        const cfg = ACTION_CONFIG[action];
                        const selected = filterActions.includes(action);
                        return (
                          <button
                            key={action}
                            onClick={() => toggleActionFilter(action)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${selected ? 'bg-[#1E6FA4]/20 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
                          >
                            <span className={cfg.color}>{cfg.icon}</span>
                            <span className="flex-1">{action}</span>
                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF] flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {allUsers.length > 0 && (
                <select
                  value={filterUser}
                  onChange={e => { setFilterUser(e.target.value); setPage(0); }}
                  className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#1E6FA4]"
                >
                  <option value="">All Users</option>
                  {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              )}

              <div className="flex items-center gap-2">
                <span className="text-white/35 text-xs">From</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
                  className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]"
                />
                <span className="text-white/35 text-xs">To</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
                  className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]"
                />
              </div>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-white/40 hover:text-white text-sm transition-colors ml-auto">
                  <X size={13} />
                  Clear all
                </button>
              )}
            </div>

            {filterActions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filterActions.map(a => {
                  const cfg = ACTION_CONFIG[a] ?? DEFAULT_CONFIG;
                  return (
                    <button
                      key={a}
                      onClick={() => toggleActionFilter(a)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${cfg.bg} ${cfg.color}`}
                    >
                      {cfg.icon}
                      {a}
                      <X size={10} className="ml-0.5 opacity-60" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="bg-[#0D1F38] border border-white/8 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-white/35 text-xs font-semibold uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-3 text-white/35 text-xs font-semibold uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-white/35 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Detail</th>
                  <th className="text-left px-4 py-3 text-white/35 text-xs font-semibold uppercase tracking-wider hidden md:table-cell">By</th>
                  <th className="text-left px-4 py-3 text-white/35 text-xs font-semibold uppercase tracking-wider">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${[55, 40, 70, 35, 30][j]}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FileText size={32} className="text-white/12" />
                        <div>
                          <p className="text-white/45 text-sm font-medium">No activity yet</p>
                          <p className="text-white/25 text-xs mt-1">Activity will appear here as your team works in SSREI</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const cfg = ACTION_CONFIG[log.action ?? ''] ?? DEFAULT_CONFIG;
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.018] transition-colors group">
                        <td className="px-4 py-3.5">
                          {log.contacts ? (
                            <button
                              onClick={() => log.contact_id && navigate('contact-detail', log.contact_id)}
                              className="text-left transition-colors"
                            >
                              <span className="text-white/80 text-sm font-medium group-hover:text-[#1E90FF] transition-colors">
                                {log.contacts.first_name} {log.contacts.last_name}
                              </span>
                              {log.contacts.property_address && (
                                <div className="text-white/30 text-xs truncate max-w-40 mt-0.5">
                                  {log.contacts.property_address}
                                </div>
                              )}
                            </button>
                          ) : (
                            <span className="text-white/20 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}
                            {log.action || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-white/45 text-sm hidden lg:table-cell max-w-xs">
                          <span className="line-clamp-1">{log.action_detail || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-white/40 text-sm hidden md:table-cell whitespace-nowrap">
                          {log.action_by || '—'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-white/45 text-xs font-medium">{timeAgo(log.action_at)}</div>
                          <div className="text-white/20 text-xs mt-0.5">{formatDate(log.action_at)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
              <span className="text-white/30 text-xs">
                {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(0)} disabled={page === 0}
                  className="px-2 py-1 rounded-lg text-white/35 hover:text-white hover:bg-white/8 disabled:opacity-20 text-xs transition-colors">
                  First
                </button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded-lg text-white/35 hover:text-white hover:bg-white/8 disabled:opacity-20 text-sm transition-colors">
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-7 rounded-lg text-sm transition-colors ${p === page ? 'bg-[#1E6FA4] text-white' : 'text-white/35 hover:text-white hover:bg-white/8'}`}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded-lg text-white/35 hover:text-white hover:bg-white/8 disabled:opacity-20 text-sm transition-colors">
                  Next
                </button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                  className="px-2 py-1 rounded-lg text-white/35 hover:text-white hover:bg-white/8 disabled:opacity-20 text-xs transition-colors">
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
