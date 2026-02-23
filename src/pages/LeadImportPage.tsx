import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, Trash2, Send, Loader2,
  Wifi, WifiOff,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { parseCSV, mapCSVRowToContact } from '../lib/csvParser';
import {
  computeDistressScore, detectDNCLitigator, determineOverallStatus,
  buildDealAutomatorUrl, SCORE_TIER_COLORS, STATUS_COLORS,
} from '../lib/scoring';
import { pushContactToGHL } from '../lib/ghl';
import type { Contact, ImportBatch, CSVRow, OverallStatus } from '../types';

interface ResultRow {
  contact: Partial<Contact>;
  originalRow: CSVRow;
  status: OverallStatus;
  distress_score: number;
  score_tier: string;
  pushed: boolean;
  pushing: boolean;
  pushError?: string;
  saved_id?: string;
  save_error?: string;
  ghl_sync_status?: string;
  expanded: boolean;
}

type Tab = 'upload' | 'batches';

const GHL_BATCH_SIZE = 10;
const GHL_BATCH_DELAY = 500;

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export function LeadImportPage() {
  const { profile, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('upload');
  const [batchName, setBatchName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterPushed, setFilterPushed] = useState('');
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [bulkPushing, setBulkPushing] = useState(false);
  const [ghlSyncing, setGhlSyncing] = useState(false);
  const [ghlProgress, setGhlProgress] = useState({ done: 0, total: 0, synced: 0, failed: 0 });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (tab === 'batches') loadBatches();
  }, [tab]);

  const loadBatches = async () => {
    const { data } = await supabase.from('import_batches').select('*').order('uploaded_at', { ascending: false });
    setBatches((data ?? []) as ImportBatch[]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleProcess = async () => {
    if (!batchName.trim()) { alert('Please enter a batch name.'); return; }
    if (!file) { alert('Please select a CSV file.'); return; }

    setParsing(true);
    setProgress(0);
    setProgressLabel('Parsing CSV...');
    setResults([]);
    abortRef.current = false;

    const text = await file.text();
    const rows: CSVRow[] = parseCSV(text);
    if (rows.length === 0) { setParsing(false); alert('No data rows found in CSV.'); return; }

    setProgressLabel('Creating import batch...');
    const { data: batch, error: batchErr } = await supabase.from('import_batches').insert({
      batch_name: batchName.trim(),
      uploaded_by: profile?.display_name ?? 'Unknown',
      total_rows: rows.length,
      status: 'Processing',
    }).select().single();

    if (batchErr || !batch) {
      setParsing(false);
      alert(`Failed to create batch: ${batchErr?.message ?? 'Unknown error'}`);
      return;
    }
    setCurrentBatchId(batch.id);

    const existingHashes = new Set<string>();
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('address_hash')
      .not('address_hash', 'is', null);
    (existingContacts ?? []).forEach((c: { address_hash?: string }) => {
      if (c.address_hash) existingHashes.add(c.address_hash);
    });

    const seenHashesThisBatch = new Set<string>();
    const processedRows: ResultRow[] = [];
    let cleanCount = 0, dncCount = 0, litigatorCount = 0, duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      const row = rows[i];
      const pct = Math.round(((i + 1) / rows.length) * 100);
      setProgress(pct);
      setProgressLabel(`Saving row ${i + 1} of ${rows.length}...`);

      const { dnc, litigator } = detectDNCLitigator(row);
      const hash = row['AddressHash'] || row['Id'] || '';
      const isDuplicate = !!(hash && (existingHashes.has(hash) || seenHashesThisBatch.has(hash)));
      if (hash) seenHashesThisBatch.add(hash);

      const status = determineOverallStatus(dnc, litigator, isDuplicate);
      const { score, tier, flags } = computeDistressScore(row);
      const contactData = mapCSVRowToContact(row);
      const daUrl = hash ? buildDealAutomatorUrl(hash) : '';

      const contactToSave: Partial<Contact> = {
        ...contactData,
        batch_id: batch.id,
        batch_name: batchName.trim(),
        dnc_toggle: dnc && !litigator,
        litigator,
        overall_status: status,
        distress_score: score,
        score_tier: tier,
        distress_flags: flags.join(', '),
        deal_automator_url: daUrl,
        source: 'CSV Import',
        created_by: profile?.display_name ?? 'Unknown',
        pushed_to_ghl: false,
        tags: [],
      };

      if (status === 'Clean') cleanCount++;
      else if (status === 'DNC') dncCount++;
      else if (status === 'Litigator') litigatorCount++;
      else if (status === 'Duplicate') duplicateCount++;

      let savedId: string | undefined;
      let saveError: string | undefined;

      if (isDuplicate && hash) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('address_hash', hash)
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('contacts').update({
            overall_status: 'Duplicate',
            batch_id: batch.id,
            batch_name: batchName.trim(),
          }).eq('id', existing.id);
          savedId = existing.id;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('contacts')
            .insert(contactToSave)
            .select('id')
            .single();
          savedId = ins?.id;
          saveError = insErr?.message;
        }
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('contacts')
          .insert(contactToSave)
          .select('id')
          .single();
        savedId = ins?.id;
        if (insErr) {
          if (insErr.code === '23505' && hash) {
            const { data: existing } = await supabase
              .from('contacts')
              .select('id')
              .eq('address_hash', hash)
              .maybeSingle();
            savedId = existing?.id;
          } else {
            saveError = insErr.message;
          }
        }
      }

      processedRows.push({
        contact: { ...contactToSave, id: savedId },
        originalRow: row,
        status,
        distress_score: score,
        score_tier: tier,
        pushed: false,
        pushing: false,
        saved_id: savedId,
        save_error: saveError,
        expanded: false,
      });
    }

    await supabase.from('import_batches').update({
      status: 'Complete',
      clean_count: cleanCount,
      dnc_count: dncCount,
      litigator_count: litigatorCount,
      duplicate_count: duplicateCount,
    }).eq('id', batch.id);

    await supabase.from('contact_activity_logs').insert({
      action: 'Batch Import',
      action_detail: `Imported "${batchName.trim()}" — ${rows.length} rows. Clean: ${cleanCount}, DNC: ${dncCount}, Litigator: ${litigatorCount}, Duplicate: ${duplicateCount}`,
      action_by: profile?.display_name ?? 'Unknown',
    }).catch(() => {});

    setResults(processedRows);
    setParsing(false);
    setProgressLabel('');

    if (autoSyncEnabled) {
      await runGHLAutoSync(processedRows);
    }
  };

  const runGHLAutoSync = async (rows: ResultRow[]) => {
    const eligible = rows.filter(r =>
      r.saved_id &&
      !r.pushed &&
      r.status !== 'Litigator' &&
      r.status !== 'Duplicate'
    );
    if (eligible.length === 0) return;

    setGhlSyncing(true);
    abortRef.current = false;
    setGhlProgress({ done: 0, total: eligible.length, synced: 0, failed: 0 });

    let synced = 0;
    let failed = 0;

    for (let i = 0; i < eligible.length; i += GHL_BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = eligible.slice(i, i + GHL_BATCH_SIZE);

      await Promise.all(batch.map(async (row) => {
        if (!row.saved_id) return;
        try {
          const { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', row.saved_id)
            .single();
          if (!contact) throw new Error('Contact not found');

          const tags = ['SSREI Import'];
          if (contact.dnc_toggle) tags.push('DNC');
          if (contact.litigator) tags.push('Litigator');

          const { contactId, opportunityId } = await pushContactToGHL({ ...contact, tags } as Contact);

          await supabase.from('contacts').update({
            pushed_to_ghl: true,
            ghl_contact_id: contactId,
            ghl_opportunity_id: opportunityId,
            ghl_stage: contact.dnc_toggle ? 'DNC – Email Only' : 'New Lead',
            ghl_sync_status: 'Synced',
          }).eq('id', row.saved_id);

          setResults(prev => prev.map(r =>
            r.saved_id === row.saved_id
              ? { ...r, pushed: true, ghl_sync_status: 'Synced' }
              : r
          ));
          synced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed';
          await supabase.from('contacts').update({ ghl_sync_status: 'Failed' }).eq('id', row.saved_id!);
          setResults(prev => prev.map(r =>
            r.saved_id === row.saved_id
              ? { ...r, pushError: msg, ghl_sync_status: 'Failed' }
              : r
          ));
          failed++;
        }
      }));

      setGhlProgress({ done: Math.min(i + GHL_BATCH_SIZE, eligible.length), total: eligible.length, synced, failed });

      if (i + GHL_BATCH_SIZE < eligible.length) {
        await sleep(GHL_BATCH_DELAY);
      }
    }

    setGhlSyncing(false);
  };

  const pushSingle = async (idx: number) => {
    const row = results[idx];
    if (!row.saved_id) return;
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, pushing: true, pushError: undefined } : r));

    try {
      const { data: contact } = await supabase.from('contacts').select('*').eq('id', row.saved_id).single();
      const tags = ['SSREI Import'];
      if ((contact as Contact).dnc_toggle) tags.push('DNC');
      if ((contact as Contact).litigator) tags.push('Litigator');

      const { contactId, opportunityId } = await pushContactToGHL({ ...(contact as Contact), tags });
      await supabase.from('contacts').update({
        pushed_to_ghl: true,
        ghl_contact_id: contactId,
        ghl_opportunity_id: opportunityId,
        ghl_stage: (contact as Contact).dnc_toggle ? 'DNC – Email Only' : 'New Lead',
        ghl_sync_status: 'Synced',
      }).eq('id', row.saved_id);

      await supabase.from('contact_activity_logs').insert({
        contact_id: row.saved_id,
        action: 'Pushed to GHL',
        action_detail: `Contact ID: ${contactId}`,
        action_by: profile?.display_name ?? 'Unknown',
      });

      if (currentBatchId) {
        await supabase.rpc('increment_pushed_count', { batch_id: currentBatchId }).catch(() => {});
      }

      setResults(prev => prev.map((r, i) => i === idx ? { ...r, pushing: false, pushed: true, ghl_sync_status: 'Synced' } : r));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      await supabase.from('notifications').insert({
        type: 'Push Failed',
        message: `Failed to push ${row.contact.first_name} ${row.contact.last_name}: ${msg}`,
        contact_id: row.saved_id,
      });
      await supabase.from('contacts').update({ ghl_sync_status: 'Failed' }).eq('id', row.saved_id);
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, pushing: false, pushError: msg, ghl_sync_status: 'Failed' } : r));
    }
  };

  const pushAllClean = async () => {
    setBulkPushing(true);
    const eligible = results.map((r, i) => ({ r, i })).filter(({ r }) =>
      (r.status === 'Clean' || r.status === 'DNC') && !r.pushed && r.saved_id && r.status !== 'Litigator'
    );
    for (const { i } of eligible) {
      await pushSingle(i);
    }
    setBulkPushing(false);
  };

  const handleDeleteBatch = async (batchId: string) => {
    setDeletingBatch(batchId);
    await supabase.from('import_batches').delete().eq('id', batchId);
    setBatches(prev => prev.filter(b => b.id !== batchId));
    setDeletingBatch(null);
    setConfirmDelete(null);
  };

  const filteredResults = results.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterTier && r.score_tier !== filterTier) return false;
    if (filterState && r.contact.property_state !== filterState) return false;
    if (filterPushed === 'yes' && !r.pushed) return false;
    if (filterPushed === 'no' && r.pushed) return false;
    return true;
  });

  const summaryClean = results.filter(r => r.status === 'Clean').length;
  const summaryDNC = results.filter(r => r.status === 'DNC').length;
  const summaryLitigator = results.filter(r => r.status === 'Litigator').length;
  const summaryDuplicate = results.filter(r => r.status === 'Duplicate').length;
  const summarySaved = results.filter(r => r.saved_id && !r.save_error).length;
  const summarySaveFailed = results.filter(r => r.save_error).length;
  const summaryGHLSynced = results.filter(r => r.ghl_sync_status === 'Synced').length;
  const summaryGHLFailed = results.filter(r => r.ghl_sync_status === 'Failed').length;

  return (
    <Layout title="Lead Import" subtitle="Upload and process CSV files">
      <div className="space-y-5">
        <div className="flex border-b border-white/10">
          {(['upload', 'batches'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-[#1E90FF] -mb-px' : 'text-white/40 hover:text-white'}`}
            >
              {t === 'upload' ? 'Upload CSV' : 'Batch Manager'}
            </button>
          ))}
        </div>

        {tab === 'upload' && (
          <div className="space-y-5">
            {results.length === 0 && !parsing && (
              <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-6 space-y-5">
                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">Batch Name</label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={e => setBatchName(e.target.value)}
                    placeholder="e.g. Dallas TX – Jan 2025"
                    className="w-full bg-[#0A1628] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#1E6FA4] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">CSV File</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-[#1E6FA4]/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-white/30 mb-2" />
                    <p className="text-white/50 text-sm">{file ? file.name : 'Click to select CSV file'}</p>
                    {file && <p className="text-white/30 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>}
                    <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(30,111,164,0.08)', border: '1px solid rgba(30,111,164,0.2)' }}>
                  <button
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className="flex items-center gap-2 text-sm transition-colors"
                    style={{ color: autoSyncEnabled ? '#1E90FF' : 'rgba(255,255,255,0.4)' }}
                  >
                    {autoSyncEnabled ? <Wifi size={16} /> : <WifiOff size={16} />}
                    Auto-Sync to GHL after import
                  </button>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {autoSyncEnabled ? 'Clean + DNC contacts will be pushed to GHL automatically (batches of 10)' : 'Contacts will be saved to Supabase only. You can push to GHL manually.'}
                  </span>
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!batchName.trim() || !file}
                  className="w-full bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Process & Save CSV
                </button>
              </div>
            )}

            {parsing && (
              <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-8 text-center">
                <div className="w-10 h-10 border-2 border-[#1E6FA4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-medium mb-1">{progressLabel || 'Processing...'}</p>
                <div className="w-full bg-white/10 rounded-full h-2 mb-2 mt-3">
                  <div className="bg-[#1E6FA4] h-2 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-white/40 text-sm">{progress}% complete</p>
              </div>
            )}

            {ghlSyncing && !parsing && (
              <div className="bg-[#0D1F38] border border-[#1E6FA4]/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 size={16} className="animate-spin text-[#1E90FF]" />
                  <span className="text-white font-medium text-sm">Syncing to GHL...</span>
                  <span className="text-white/40 text-sm ml-auto">{ghlProgress.done} / {ghlProgress.total}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                  <div className="bg-[#1E6FA4] h-1.5 rounded-full transition-all" style={{ width: `${ghlProgress.total ? (ghlProgress.done / ghlProgress.total) * 100 : 0}%` }} />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-400">{ghlProgress.synced} synced</span>
                  <span className="text-red-400">{ghlProgress.failed} failed</span>
                  <button onClick={() => { abortRef.current = true; }} className="text-white/40 hover:text-white ml-auto transition-colors">Stop</button>
                </div>
              </div>
            )}

            {results.length > 0 && !parsing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <button
                    onClick={() => { setResults([]); setFile(null); setBatchName(''); setCurrentBatchId(null); }}
                    className="text-white/40 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
                  >
                    ← New Import
                  </button>
                  <div className="flex items-center gap-2">
                    {!ghlSyncing && (
                      <button
                        onClick={() => runGHLAutoSync(results)}
                        disabled={ghlSyncing}
                        className="flex items-center gap-2 bg-[#1E6FA4]/30 hover:bg-[#1E6FA4]/50 border border-[#1E6FA4]/40 text-[#1E90FF] text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Wifi size={14} />
                        Sync All to GHL
                      </button>
                    )}
                    <button
                      onClick={pushAllClean}
                      disabled={bulkPushing || ghlSyncing}
                      className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Send size={14} />
                      {bulkPushing ? 'Pushing...' : 'Push Eligible to GHL'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  {[
                    { label: 'Total', value: results.length, color: 'text-white' },
                    { label: 'Saved', value: summarySaved, color: 'text-emerald-400' },
                    { label: 'Failed', value: summarySaveFailed, color: 'text-red-400' },
                    { label: 'Clean', value: summaryClean, color: 'text-sky-400' },
                    { label: 'DNC', value: summaryDNC, color: 'text-orange-400' },
                    { label: 'Litigator', value: summaryLitigator, color: 'text-red-400' },
                    { label: 'GHL ✓', value: summaryGHLSynced, color: 'text-emerald-400' },
                    { label: 'GHL ✗', value: summaryGHLFailed, color: 'text-red-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#0D1F38] border border-white/8 rounded-xl p-3 text-center">
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-white/40 text-xs mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {summarySaveFailed > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-sm text-red-300">{summarySaveFailed} row{summarySaveFailed !== 1 ? 's' : ''} failed to save. Check console or try re-importing.</span>
                  </div>
                )}

                <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-4">
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Status', value: filterStatus, onChange: setFilterStatus, options: ['Clean', 'DNC', 'Litigator', 'Duplicate'] },
                      { label: 'Score Tier', value: filterTier, onChange: setFilterTier, options: ['Hot', 'Warm', 'Lukewarm', 'Cold', 'No Signal'] },
                    ].map(({ label, value, onChange, options }) => (
                      <select key={label} value={value} onChange={e => onChange(e.target.value)}
                        className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]">
                        <option value="">All {label}s</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ))}
                    <select value={filterState} onChange={e => setFilterState(e.target.value)}
                      className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]">
                      <option value="">All States</option>
                      {[...new Set(results.map(r => r.contact.property_state).filter(Boolean))].sort().map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select value={filterPushed} onChange={e => setFilterPushed(e.target.value)}
                      className="bg-[#0A1628] border border-white/15 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#1E6FA4]">
                      <option value="">All GHL</option>
                      <option value="yes">Pushed</option>
                      <option value="no">Not Pushed</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#0D1F38] border border-white/8 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/8">
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Owner</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Property Address</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Score</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Status</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Saved</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">GHL</th>
                          <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((row) => {
                          const realIdx = results.indexOf(row);
                          return (
                            <React.Fragment key={realIdx}>
                              <tr className="border-b border-white/5 hover:bg-white/2">
                                <td className="px-4 py-3 text-white text-sm">
                                  {row.contact.first_name} {row.contact.last_name}
                                </td>
                                <td className="px-4 py-3 text-white/70 text-sm">
                                  {row.contact.property_address}{row.contact.property_city ? `, ${row.contact.property_city}` : ''}{row.contact.property_state ? `, ${row.contact.property_state}` : ''}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCORE_TIER_COLORS[row.score_tier as keyof typeof SCORE_TIER_COLORS] ?? ''}`}>
                                      {row.score_tier}
                                    </span>
                                    <span className="text-white/40 text-xs font-mono">{row.distress_score}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.status] ?? ''}`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {row.save_error ? (
                                    <span title={row.save_error} className="flex items-center gap-1 text-xs text-red-400">
                                      <XCircle size={13} /> Error
                                    </span>
                                  ) : row.saved_id ? (
                                    <CheckCircle size={13} className="text-emerald-400" title="Saved to Supabase" />
                                  ) : (
                                    <span className="text-white/25 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {row.ghl_sync_status === 'Synced' ? (
                                    <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={12} /> Synced</span>
                                  ) : row.ghl_sync_status === 'Failed' ? (
                                    <span className="flex items-center gap-1 text-xs text-red-400" title={row.pushError}><WifiOff size={12} /> Failed</span>
                                  ) : row.pushed ? (
                                    <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} /> Pushed</span>
                                  ) : (
                                    <span className="text-white/25 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {row.contact.deal_automator_url && (
                                      <a href={row.contact.deal_automator_url} target="_blank" rel="noopener noreferrer"
                                        className="text-white/30 hover:text-[#1E90FF] transition-colors" title="Deal Automator">
                                        <ExternalLink size={14} />
                                      </a>
                                    )}
                                    {row.saved_id && !row.pushed && row.status !== 'Litigator' && row.status !== 'Duplicate' && (
                                      <button
                                        onClick={() => pushSingle(realIdx)}
                                        disabled={row.pushing || ghlSyncing}
                                        className="text-white/30 hover:text-[#1E90FF] transition-colors disabled:opacity-50"
                                        title="Push to GHL"
                                      >
                                        {row.pushing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                      </button>
                                    )}
                                    {row.ghl_sync_status === 'Failed' && row.saved_id && (
                                      <button
                                        onClick={() => pushSingle(realIdx)}
                                        disabled={row.pushing}
                                        className="text-orange-400 hover:text-orange-300 transition-colors text-xs"
                                        title="Retry GHL push"
                                      >
                                        Retry
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setResults(prev => prev.map((r, i) => i === realIdx ? { ...r, expanded: !r.expanded } : r))}
                                      className="text-white/30 hover:text-white transition-colors"
                                    >
                                      {row.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {row.expanded && (
                                <tr className="border-b border-white/5 bg-[#0A1628]/60">
                                  <td colSpan={7} className="px-4 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                      <div>
                                        <p className="text-white/40 font-medium mb-2 uppercase tracking-wide">Phones</p>
                                        {[
                                          { phone: row.contact.contact1_phone1, type: row.contact.contact1_phone1_type },
                                          { phone: row.contact.contact1_phone2, type: row.contact.contact1_phone2_type },
                                          { phone: row.contact.contact1_phone3, type: row.contact.contact1_phone3_type },
                                        ].filter(p => p.phone).map((p, i) => (
                                          <div key={i} className="flex items-center gap-2 mb-1">
                                            <span className="text-white">{p.phone}</span>
                                            {p.type && <span className="text-white/30">{p.type}</span>}
                                          </div>
                                        ))}
                                      </div>
                                      <div>
                                        <p className="text-white/40 font-medium mb-2 uppercase tracking-wide">Emails</p>
                                        {[row.contact.contact1_email1, row.contact.contact1_email2, row.contact.contact1_email3]
                                          .filter(Boolean).map((e, i) => (
                                            <div key={i} className="text-white mb-1">{e}</div>
                                          ))}
                                      </div>
                                      <div>
                                        <p className="text-white/40 font-medium mb-2 uppercase tracking-wide">Distress Flags</p>
                                        <p className="text-white/70">{row.contact.distress_flags || 'None'}</p>
                                        {row.save_error && (
                                          <div className="mt-2">
                                            <p className="text-red-400 font-medium uppercase tracking-wide">Save Error</p>
                                            <p className="text-red-300/70 mt-1 break-all">{row.save_error}</p>
                                          </div>
                                        )}
                                        {row.contact.address_hash && (
                                          <div className="mt-2">
                                            <p className="text-white/40 font-medium uppercase tracking-wide">Address Hash</p>
                                            <p className="text-white/50 font-mono text-xs mt-1 break-all">{row.contact.address_hash}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'batches' && (
          <div className="space-y-4">
            {batches.length === 0 ? (
              <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-12 text-center">
                <p className="text-white/35 text-sm">No batches imported yet.</p>
              </div>
            ) : (
              batches.map(b => (
                <div key={b.id} className="bg-[#0D1F38] border border-white/8 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-medium">{b.batch_name}</h3>
                      <p className="text-white/40 text-xs mt-0.5">
                        {b.uploaded_by} · {b.uploaded_at ? new Date(b.uploaded_at).toLocaleDateString() : ''}
                        {' · '}
                        <span className={`font-medium ${b.status === 'Complete' ? 'text-emerald-400' : b.status === 'Failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {b.status}
                        </span>
                      </p>
                    </div>
                    {isAdmin && (
                      confirmDelete === b.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-xs">Confirm delete?</span>
                          <button onClick={() => handleDeleteBatch(b.id)} disabled={deletingBatch === b.id}
                            className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">
                            {deletingBatch === b.id ? 'Deleting...' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-white/40 hover:text-white text-xs transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(b.id)} className="text-white/25 hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: 'Total', value: b.total_rows ?? 0, color: 'text-white' },
                      { label: 'Clean', value: b.clean_count ?? 0, color: 'text-emerald-400' },
                      { label: 'DNC', value: b.dnc_count ?? 0, color: 'text-orange-400' },
                      { label: 'Litigator', value: b.litigator_count ?? 0, color: 'text-red-400' },
                      { label: 'Duplicate', value: b.duplicate_count ?? 0, color: 'text-zinc-400' },
                      { label: 'Pushed', value: b.pushed_to_ghl_count ?? 0, color: 'text-[#1E90FF]' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#0A1628] rounded-lg p-2.5 text-center">
                        <div className={`text-lg font-bold ${color}`}>{value}</div>
                        <div className="text-white/35 text-xs">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
