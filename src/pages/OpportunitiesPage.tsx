import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, MoveRight, X, Star } from 'lucide-react';
import { Layout } from '../components/Layout';
import { getPipelineStages, getOpportunities, updateOpportunityStage, bulkUpdateOpportunityStage, bulkDeleteOpportunities, type GHLOpportunity, type GHLPipelineStage } from '../lib/ghl';
import { SCORE_TIER_EMOJIS } from '../lib/scoring';
import { supabase } from '../lib/supabase';

interface OpportunityWithData extends GHLOpportunity {
  distressScore?: number;
  scoreTier?: string;
  priority?: boolean;
  dealAutomatorUrl?: string;
}

export default function OpportunitiesPage() {
  const [stages, setStages] = useState<GHLPipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [_pipelineId, setPipelineId] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [moveToStage, setMoveToStage] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { stages: stageData, pipelineId: pid, pipelineName: pname } = await getPipelineStages();
      setStages(stageData.sort((a, b) => a.position - b.position));
      setPipelineId(pid);
      setPipelineName(pname);

      const opps = await getOpportunities(pid);

      const enriched = await Promise.all(
        opps.map(async (opp) => {
          const contactId = opp.contact?.id;
          if (!contactId) return opp;

          const { data } = await supabase
            .from('contacts')
            .select('distress_score, score_tier, priority_flag, property_address')
            .eq('ghl_contact_id', contactId)
            .maybeSingle();

          if (!data) return opp;

          return {
            ...opp,
            distressScore: data.distress_score,
            scoreTier: data.score_tier,
            priority: data.priority_flag,
            dealAutomatorUrl: data.property_address
              ? `https://app.dealautomator.com/properties?address=${encodeURIComponent(data.property_address)}`
              : undefined,
          };
        })
      );

      setOpportunities(enriched);
    } catch (err) {
      console.error('Failed to load pipeline data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleDragStart = (oppId: string) => {
    setDragging(oppId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stageId: string) => {
    if (!dragging) return;
    try {
      await updateOpportunityStage(dragging, stageId);
      await loadData();
    } catch (err) {
      console.error('Failed to move opportunity:', err);
    } finally {
      setDragging(null);
    }
  };

  const toggleSelect = (oppId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(oppId)) {
        next.delete(oppId);
      } else {
        next.add(oppId);
      }
      return next;
    });
  };

  const handleBulkMove = async () => {
    if (!moveToStage || selected.size === 0) return;
    try {
      await bulkUpdateOpportunityStage(Array.from(selected), moveToStage);
      setSelected(new Set());
      setBulkActionsOpen(false);
      await loadData();
    } catch (err) {
      console.error('Bulk move failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} opportunities?`)) return;
    try {
      await bulkDeleteOpportunities(Array.from(selected));
      setSelected(new Set());
      setBulkActionsOpen(false);
      await loadData();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const oppsByStage = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return opportunities.filter(o => {
      // Direct ID match
      if (o.pipelineStageId === stageId) return true;

      // Fallback: Name match if IDs differ but names match
      if (stage && o.stageName && o.stageName.toLowerCase() === stage.name.toLowerCase()) {
        return true;
      }
      return false;
    });
  };

  if (loading) {
    return (
      <Layout title="Opportunities" subtitle="Loading pipeline...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-400">Loading pipeline...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Opportunities" subtitle={pipelineName}>
      <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 ml-auto">
          {selected.size > 0 && (
            <button
              onClick={() => setBulkActionsOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#3b82f6', color: 'white' }}
            >
              Bulk Actions ({selected.size})
            </button>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: autoRefresh ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: autoRefresh ? '#3b82f6' : 'var(--text-muted)',
            }}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw size={20} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto min-h-0">
        <div className="p-6 inline-flex gap-4 min-w-full">
          {stages.map(stage => {
            const stageOpps = oppsByStage(stage.id);
            const totalValue = stageOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 rounded-lg border"
                style={{
                  width: '320px',
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border)'
                }}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{stage.name}</h3>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{stageOpps.length}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ${totalValue.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {stageOpps.map(opp => (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={() => handleDragStart(opp.id)}
                      className="rounded-lg p-3 cursor-move transition-all hover:shadow-lg border"
                      style={{
                        backgroundColor: selected.has(opp.id) ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                        borderColor: selected.has(opp.id) ? '#3b82f6' : 'var(--border)',
                        borderLeft: opp.priority ? '3px solid #f59e0b' : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(opp.id)}
                            onChange={() => toggleSelect(opp.id)}
                            className="rounded"
                            style={{ accentColor: '#3b82f6' }}
                          />
                          {opp.priority && <Star size={14} className="text-amber-500" fill="currentColor" />}
                        </div>
                        {opp.scoreTier && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: opp.scoreTier === 'Hot' ? '#ef4444' : opp.scoreTier === 'Warm' ? '#f59e0b' : opp.scoreTier === 'Lukewarm' ? '#3b82f6' : '#6b7280',
                              color: 'white',
                            }}
                          >
                            {SCORE_TIER_EMOJIS[opp.scoreTier as keyof typeof SCORE_TIER_EMOJIS]} {opp.scoreTier}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{opp.name}</div>

                      {opp.contact && (
                        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                          {opp.contact.name}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          ${(opp.monetaryValue || 0).toLocaleString()}
                        </div>
                        {opp.dealAutomatorUrl && (
                          <a
                            href={opp.dealAutomatorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                            style={{ backgroundColor: '#3b82f6', color: 'white' }}
                            onClick={e => e.stopPropagation()}
                          >
                            DA
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {
        bulkActionsOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setBulkActionsOpen(false)}
          >
            <div
              className="rounded-lg p-6 max-w-md w-full mx-4 border"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Bulk Actions</h3>
                <button onClick={() => setBulkActionsOpen(false)} style={{ color: 'var(--text-muted)' }} className="hover:opacity-70">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Move {selected.size} opportunities to:
                  </label>
                  <select
                    value={moveToStage}
                    onChange={e => setMoveToStage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Select stage...</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleBulkMove}
                    disabled={!moveToStage}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    <MoveRight size={16} />
                    Move
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#ef4444', color: 'white' }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </Layout >
  );
}
