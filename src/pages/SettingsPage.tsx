import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Check, UserPlus, X, ChevronDown } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { GHLSettings, UserProfile, UserRole } from '../types';

const SETTING_KEYS = [
  { key: 'api_key', label: 'GHL API Key', secret: true, placeholder: 'eyJhbGc...' },
  { key: 'location_id', label: 'GHL Location ID', secret: false, placeholder: 'abc123...' },
  { key: 'pipeline_id', label: 'GHL Pipeline ID', secret: false, placeholder: 'xyz789...' },
];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; label: string }> = {
  admin: { bg: 'rgba(30, 144, 255, 0.12)', text: '#1E90FF', label: 'Admin' },
  agent: { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e', label: 'Agent' },
  viewer: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', label: 'Viewer' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.viewer;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

interface InviteModalProps {
  onClose: () => void;
  onInvited: () => void;
}

function InviteModal({ onClose, onInvited }: InviteModalProps) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'agent' as UserRole, title: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.full_name) { setError('Name and email are required.'); return; }
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/ghl-proxy?action=invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to send invite');
      }

      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while sending the invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 animate-modal-in shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Invite Team Member</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Jane Smith"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="jane@example.com"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="GHL Workflow Builder"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Role</label>
            <div className="relative">
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
              >
                <option value="admin">Admin — Full access</option>
                <option value="agent">Agent — Can edit, no settings</option>
                <option value="viewer">Viewer — Read only</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
            </div>
          </div>

          {error && (
            <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-[#1E6FA4] hover:bg-[#1a5f8f] transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditRolePopoverProps {
  userId: string;
  currentRole: UserRole;
  onUpdated: () => void;
  onClose: () => void;
}

function EditRolePopover({ userId, currentRole, onUpdated, onClose }: EditRolePopoverProps) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (role: UserRole) => {
    setSaving(true);
    await supabase.from('user_profiles').update({ role }).eq('id', userId);
    setSaving(false);
    onUpdated();
    onClose();
  };

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl shadow-xl py-1"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {(['admin', 'agent', 'viewer'] as UserRole[]).map(r => {
        const c = ROLE_COLORS[r];
        return (
          <button
            key={r}
            onClick={() => handleSelect(r)}
            disabled={saving || r === currentRole}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-80 disabled:opacity-40"
            style={{ color: 'var(--text-primary)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.text }} />
            {c.label}
            {r === currentRole && <Check size={12} className="ml-auto" style={{ color: c.text }} />}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPage() {
  const { can, profile: currentUser } = useAuth();
  const [settings, setSettings] = useState<GHLSettings>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editRoleFor, setEditRoleFor] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const loadSettings = async () => {
    const { data } = await supabase.from('app_settings').select('key,value');
    const map: GHLSettings = {};
    (data ?? []).forEach((row: { key: string; value?: string }) => { map[row.key] = row.value ?? ''; });
    setSettings(map);
    setLoadingSettings(false);
  };

  const loadTeam = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('full_name');
    setTeamMembers((data ?? []) as UserProfile[]);
    setLoadingTeam(false);
  };

  useEffect(() => {
    loadSettings();
    loadTeam();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const { key } of SETTING_KEYS) {
      const val = settings[key] ?? '';
      await supabase.from('app_settings').upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/ghl-proxy?action=get-pipeline-stages');
      const data = await res.json();
      if (res.ok && data.stages) {
        setConnectionStatus({ success: true, message: `Connected successfully! Found pipeline: ${data.pipelineName}` });
      } else {
        setConnectionStatus({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err) {
      setConnectionStatus({ success: false, message: err instanceof Error ? err.message : 'Connection test failed' });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setConnectionStatus(null), 5000);
    }
  };

  const handleToggleActive = async (member: UserProfile) => {
    if (member.id === currentUser?.id) return;
    setTogglingId(member.id);
    await supabase.from('user_profiles').update({ is_active: !member.is_active }).eq('id', member.id);
    await loadTeam();
    setTogglingId(null);
  };

  const card = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' };

  return (
    <Layout title="Settings" subtitle="Configure GHL integration and team access">
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl p-6" style={card}>
          <h3 className="font-medium mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 bg-[#1E90FF] rounded-full" />
            GoHighLevel Integration
          </h3>
          {loadingSettings ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-input)' }} />)}
            </div>
          ) : (
            <div className="space-y-4">
              {SETTING_KEYS.map(({ key, label, secret, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <div className="relative">
                    <input
                      type={secret && !showSecrets[key] ? 'password' : 'text'}
                      value={settings[key] ?? ''}
                      onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                    />
                    {secret && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {showSecrets[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saved ? <Check size={14} /> : <Save size={14} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !settings.api_key || !settings.location_id || !settings.pipeline_id}
                  className="flex items-center gap-2 border text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  {testingConnection ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              {connectionStatus && (
                <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm ${connectionStatus.success ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/40' : 'bg-red-900/20 text-red-400 border border-red-700/40'}`}>
                  {connectionStatus.message}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl p-6" style={card}>
          <h3 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
            GHL Sync Behavior
          </h3>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {[
              'Clean contacts are pushed to the "New Lead" pipeline stage',
              'DNC toggle ON contacts are pushed to "DNC – Email Only" stage',
              'Litigator contacts are stored in SSREI only — NOT pushed to GHL',
              'Duplicate contacts are stored in SSREI only — NOT pushed to GHL',
              'All contacts tagged with "SSREI Lead" on GHL push',
              'Distress score, tier, and flags synced as GHL custom fields',
              'Deal Automator link synced as GHL custom field',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-[#1E90FF]/60 rounded-full mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl p-6" style={card}>
          <h3 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 bg-yellow-400 rounded-full" />
            GHL Custom Field Names
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Create these opportunity custom fields in GHL for full sync:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              'Property Address', 'Property City', 'Property State', 'Property Zip',
              'Distress Score', 'Score Tier', 'Distress Flags', 'Deal Automator Link',
              'Address Hash', 'Absentee Owner', 'Foreclosure Activity', 'Delinquent Tax',
              'High Equity', 'Free and Clear', 'AVM', 'Wholesale Value',
              'LTV', 'Estimated Mortgage Balance',
            ].map(field => (
              <div key={field} className="text-xs font-mono rounded-lg px-3 py-1.5" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                {field}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-6" style={card}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Team Access</h3>
            {can('canInviteMembers') && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 bg-[#1E6FA4] hover:bg-[#1a5f8f] text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors"
              >
                <UserPlus size={13} />
                Invite Member
              </button>
            )}
          </div>

          {loadingTeam ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-input)' }} />)}
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No team members found.</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const isCurrentUser = member.id === currentUser?.id;
                const isInactive = member.is_active === false;
                const memberRole = (member.role as UserRole) ?? 'viewer';
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-input)', opacity: isInactive ? 0.55 : 1 }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold uppercase flex-shrink-0 text-white"
                      style={{ backgroundColor: isInactive ? '#475569' : '#1E6FA4' }}
                    >
                      {(member.full_name || member.display_name)?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {member.full_name || member.display_name}
                        </span>
                        <RoleBadge role={memberRole} />
                        {isInactive && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(100,116,139,0.15)', color: '#64748b' }}>
                            Inactive
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>
                        )}
                      </div>
                      {(member.title || member.email) && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {member.title || member.email}
                        </div>
                      )}
                    </div>

                    {can('canChangeRoles') && !isCurrentUser && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative">
                          <button
                            onClick={() => setEditRoleFor(editRoleFor === member.id ? null : member.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:opacity-70 transition-opacity"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                          >
                            Edit Role
                            <ChevronDown size={11} />
                          </button>
                          {editRoleFor === member.id && (
                            <EditRolePopover
                              userId={member.id}
                              currentRole={memberRole}
                              onUpdated={loadTeam}
                              onClose={() => setEditRoleFor(null)}
                            />
                          )}
                        </div>

                        <button
                          onClick={() => handleToggleActive(member)}
                          disabled={togglingId === member.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-40"
                          style={{ border: '1px solid var(--border)', color: isInactive ? '#22c55e' : '#ef4444' }}
                        >
                          {isInactive ? 'Activate' : 'Deactivate'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadTeam(); }}
        />
      )}

      {editRoleFor && (
        <div className="fixed inset-0 z-30" onClick={() => setEditRoleFor(null)} />
      )}
    </Layout>
  );
}
