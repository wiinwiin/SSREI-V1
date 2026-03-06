import React, { useEffect, useCallback, useState } from 'react';
import { X, ArrowLeft, Phone, Mail, AlertTriangle, CheckCircle, ExternalLink, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import type { Contact, ContactEntry } from '../types';
import { supabase } from '../lib/supabase';

interface ContactDetailModalProps {
    contact: Contact;
    onClose: () => void;
    onUpdated?: (updated: Contact) => void;
}

function parseContactsFromFlat(c: Contact): ContactEntry[] {
    if (c.contacts_json && c.contacts_json.length > 0) return c.contacts_json;

    // Fallback: build from flat columns if contacts_json not yet populated
    const result: ContactEntry[] = [];
    for (const prefix of ['contact1', 'contact2', 'contact3'] as const) {
        const name = (c as any)[`${prefix}_name`];
        const type = (c as any)[`${prefix}_type`] || 'Landlord';
        const phones: { number: string; phoneType: string; dnc: boolean }[] = [];
        const emails: string[] = [];

        for (const i of ['1', '2', '3']) {
            const num = (c as any)[`${prefix}_phone${i}`];
            if (num) phones.push({ number: num, phoneType: (c as any)[`${prefix}_phone${i}_type`] || '', dnc: !!c.dnc_toggle });
        }
        for (const i of ['1', '2', '3']) {
            const email = (c as any)[`${prefix}_email${i}`];
            if (email) emails.push(email);
        }
        if (!name && phones.length === 0 && emails.length === 0) continue;
        result.push({ name: name || '', type, phones, emails, dnc: phones.every(p => p.dnc) });
    }
    return result;
}

const SCORE_TIER_COLORS: Record<string, string> = {
    Hot: 'bg-red-500/20 text-red-400 border border-red-500/30',
    Warm: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    Lukewarm: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    Cold: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    'No Signal': 'bg-white/10 text-white/40 border border-white/10',
};
const STATUS_COLORS: Record<string, string> = {
    Clean: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    DNC: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    Litigator: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

export function ContactDetailModal({ contact, onClose, onUpdated }: ContactDetailModalProps) {
    const [contacts, setContacts] = useState<ContactEntry[]>(() => parseContactsFromFlat(contact));
    const [togglingPhone, setTogglingPhone] = useState<string | null>(null);
    const [localContact, setLocalContact] = useState<Contact>(contact);

    // ESC key handler
    const handleKey = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [handleKey]);

    const handlePhoneDncToggle = async (contactIdx: number, phoneIdx: number) => {
        const key = `${contactIdx}-${phoneIdx}`;
        setTogglingPhone(key);

        const updated = contacts.map((ce, ci) =>
            ci !== contactIdx ? ce : {
                ...ce,
                phones: ce.phones.map((p, pi) =>
                    pi !== phoneIdx ? p : { ...p, dnc: !p.dnc }
                ),
            }
        );

        // Recompute contact-level DNC
        const final = updated.map(ce => ({
            ...ce,
            dnc: ce.phones.length > 0 ? ce.phones.every(p => p.dnc) : ce.dnc,
        }));

        // Rebuild dnc_flags and non_dnc_count
        const allPhones = final.flatMap(ce => ce.phones.map(p => ({ phone: p.number, dnc: p.dnc })));
        const non_dnc_count = allPhones.filter(f => !f.dnc).length;

        if (localContact.id) {
            await supabase.from('contacts').update({
                contacts_json: final,
                dnc_flags: allPhones,
                non_dnc_count,
            }).eq('id', localContact.id);
        }

        const updatedContact = { ...localContact, contacts_json: final, dnc_flags: allPhones, non_dnc_count };
        setContacts(final);
        setLocalContact(updatedContact);
        onUpdated?.(updatedContact);
        setTogglingPhone(null);
    };

    const displayName = localContact.lead_type === 'commercial'
        ? (localContact.property_name || localContact.first_name || 'Commercial Lead')
        : `${localContact.first_name || ''} ${localContact.last_name || ''}`.trim() || 'Unknown';

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            {/* Modal panel */}
            <div
                className="relative w-full max-w-3xl mt-8 mb-8 rounded-2xl overflow-y-auto max-h-[92vh] animate-slide-up"
                style={{
                    background: 'linear-gradient(160deg, #0a1628 0%, #0d2040 100%)',
                    border: '1px solid rgba(30,144,255,0.15)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                    animation: 'slideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-white/10"
                    style={{ background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)' }}>
                    <button onClick={onClose}
                        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mr-1">
                        <ArrowLeft size={15} /> Back
                    </button>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white">{displayName}</h2>
                        {localContact.property_address && (
                            <p className="text-xs text-white/40 mt-0.5">{localContact.property_address}{localContact.property_city ? `, ${localContact.property_city}` : ''}{localContact.property_state ? `, ${localContact.property_state}` : ''} {localContact.property_zip || ''}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Score + Status badges */}
                    <div className="flex flex-wrap gap-2">
                        {localContact.score_tier && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_TIER_COLORS[localContact.score_tier] ?? 'bg-white/10 text-white/50'}`}>
                                {localContact.score_tier} · {localContact.distress_score ?? 0}
                            </span>
                        )}
                        {localContact.overall_status && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[localContact.overall_status] ?? ''}`}>
                                {localContact.overall_status}
                            </span>
                        )}
                        {localContact.lead_type && (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#1e6fa4]/20 text-[#1e90ff] border border-[#1e6fa4]/30 capitalize">
                                {localContact.lead_type}
                            </span>
                        )}
                        {localContact.non_dnc_count !== undefined && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${localContact.non_dnc_count > 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                                {localContact.non_dnc_count > 0 ? `✅ ${localContact.non_dnc_count} callable` : '⛔ No callable'}
                            </span>
                        )}
                        {localContact.county && (
                            <span className="text-xs px-2.5 py-1 rounded-full text-white/40 border border-white/10">
                                {localContact.county} County
                            </span>
                        )}
                    </div>

                    {/* Sellability scores */}
                    {(localContact.retail_sellability_score || localContact.rental_sellability_score || localContact.wholesale_sellability_score) && (
                        <div className="flex gap-3">
                            {localContact.retail_sellability_score && (
                                <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                    <div className="text-sm font-bold text-emerald-400">{localContact.retail_sellability_score}°</div>
                                    <div className="text-xs text-emerald-400/60">Retail</div>
                                </div>
                            )}
                            {localContact.rental_sellability_score && (
                                <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)' }}>
                                    <div className="text-sm font-bold text-yellow-400">{localContact.rental_sellability_score}°</div>
                                    <div className="text-xs text-yellow-400/60">Rental</div>
                                </div>
                            )}
                            {localContact.wholesale_sellability_score && (
                                <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
                                    <div className="text-sm font-bold text-purple-400">{localContact.wholesale_sellability_score}°</div>
                                    <div className="text-xs text-purple-400/60">Wholesale</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Contacts / Landlord Data */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Contacts / Landlord Data</h3>
                        {contacts.length === 0 ? (
                            <p className="text-sm text-white/30">No contact data available.</p>
                        ) : (
                            <div className="space-y-4">
                                {contacts.map((ce, ci) => (
                                    <div key={ci} className="rounded-xl p-4 space-y-3"
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                        {/* Contact header */}
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white text-sm">{ce.name || `Contact ${ci + 1}`}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full border text-white/40 border-white/10">{ce.type}</span>
                                            {ce.dnc
                                                ? <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center gap-1"><AlertTriangle size={10} /> All DNC</span>
                                                : <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle size={10} /> Callable</span>
                                            }
                                        </div>

                                        {/* Phones with per-phone DNC toggle */}
                                        {ce.phones.length > 0 && (
                                            <div className="space-y-1.5">
                                                {ce.phones.map((ph, pi) => {
                                                    const key = `${ci}-${pi}`;
                                                    return (
                                                        <div key={pi} className="flex items-center gap-2 py-1">
                                                            <Phone size={13} className="text-white/30 flex-shrink-0" />
                                                            <span className={`text-sm font-mono ${ph.dnc ? 'text-white/35 line-through' : 'text-white/80'}`}>{ph.number}</span>
                                                            {ph.phoneType && <span className="text-xs text-white/30">({ph.phoneType})</span>}
                                                            {ph.dnc
                                                                ? <span className="ml-1 text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> DNC</span>
                                                                : <span className="ml-1 text-xs text-emerald-400">🟢</span>
                                                            }
                                                            <button
                                                                className="ml-auto flex items-center gap-1 text-xs transition-colors"
                                                                onClick={() => handlePhoneDncToggle(ci, pi)}
                                                                disabled={togglingPhone === key}
                                                                title={ph.dnc ? 'Mark as callable' : 'Mark as DNC'}
                                                            >
                                                                {togglingPhone === key
                                                                    ? <Loader2 size={14} className="animate-spin text-white/40" />
                                                                    : ph.dnc
                                                                        ? <ToggleRight size={18} className="text-orange-400" />
                                                                        : <ToggleLeft size={18} className="text-white/30" />
                                                                }
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Emails */}
                                        {ce.emails.length > 0 && (
                                            <div className="space-y-1">
                                                {ce.emails.map((em, ei) => (
                                                    <div key={ei} className="flex items-center gap-2">
                                                        <Mail size={13} className="text-white/30 flex-shrink-0" />
                                                        <a href={`mailto:${em}`} className="text-sm text-[#1e90ff]/80 hover:text-[#1e90ff] transition-colors">{em}</a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Property details */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Property Details</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {[
                                ['Address', localContact.property_address],
                                ['City', localContact.property_city],
                                ['County', localContact.county],
                                ['State', localContact.property_state],
                                ['Zip', localContact.property_zip],
                                ['Type', localContact.property_type],
                                ['Beds/Baths', localContact.beds || localContact.baths ? `${localContact.beds ?? '—'} bd / ${localContact.baths ?? '—'} ba` : null],
                                ['Sqft', localContact.sqft?.toLocaleString()],
                                ['Year Built', localContact.year_built],
                                ['AVM', localContact.avm ? `$${localContact.avm.toLocaleString()}` : null],
                            ].filter(([, v]) => v).map(([label, value]) => (
                                <div key={label as string}>
                                    <div className="text-xs text-white/30 mb-0.5">{label as string}</div>
                                    <div className="text-white/70">{value as string}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deal Automator link */}
                    {localContact.deal_automator_url && (
                        <a href={localContact.deal_automator_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-[#1e90ff]/70 hover:text-[#1e90ff] transition-colors">
                            <ExternalLink size={14} /> Open in Deal Automator
                        </a>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
        </div>
    );
}
