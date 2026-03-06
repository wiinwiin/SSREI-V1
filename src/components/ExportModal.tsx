import React, { useState, useMemo } from 'react';
import { Download, X, AlertTriangle, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Contact } from '../types';

interface ExportModalProps {
    contacts: Contact[];
    loading: boolean;
    onClose: () => void;
}

interface ParsedContact {
    name: string;
    phone: string;
    email: string;
    type: string;
    dnc: boolean;
}

export function ExportModal({ contacts, loading, onClose }: ExportModalProps) {
    const [filterDNC, setFilterDNC] = useState(false);
    const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
    const [exporting, setExporting] = useState(false);

    // Parse contacts from JSONB first, fall back to flat contact1/2/3 columns with null-checks
    const parsedData = useMemo(() => {
        console.debug('[ExportModal] Parsing', contacts.length, 'contacts for export');

        return contacts.map(c => {
            const fullContacts: ParsedContact[] = [];
            const nonDncContacts: ParsedContact[] = [];

            // ── Priority 1: Use contacts_json JSONB (has per-phone DNC) ──
            if (c.contacts_json && c.contacts_json.length > 0) {
                for (const ce of c.contacts_json) {
                    // Grab the first of any phones & emails from the structured array
                    const phoneEntry = (ce.phones || [])[0];
                    const phone = phoneEntry?.number || '';
                    const email = (ce.emails || [])[0] || '';
                    const isDNC = phoneEntry ? phoneEntry.dnc : ce.dnc;

                    if (ce.name || phone || email) {
                        const obj: ParsedContact = {
                            name: ce.name || '',
                            phone,
                            email,
                            type: ce.type || 'Landlord',
                            dnc: !!isDNC,
                        };
                        fullContacts.push(obj);
                        if (!isDNC) nonDncContacts.push(obj);
                    }
                }
            } else {
                // ── Priority 2: Fallback to flat contact1/2/3 columns ──
                // Null-safe: default every accessor to ''
                const addFlat = (prefix: string) => {
                    const name = (c as any)[`${prefix}_name`] || '';
                    const phone = (c as any)[`${prefix}_phone1`]
                        || (c as any)[`${prefix}_phone2`]
                        || (c as any)[`${prefix}_phone3`] || '';
                    const email = (c as any)[`${prefix}_email1`]
                        || (c as any)[`${prefix}_email2`]
                        || (c as any)[`${prefix}_email3`] || '';
                    const type = (c as any)[`${prefix}_type`] || 'Landlord';

                    if (!name && !phone && !email) return; // skip empty

                    // Per-phone DNC: no per-column DNC in flat schema → use row-level flag
                    const isDNC = !!c.dnc_toggle;
                    const obj: ParsedContact = { name, phone, email, type, dnc: isDNC };
                    fullContacts.push(obj);
                    if (!isDNC) nonDncContacts.push(obj);
                };

                addFlat('contact1');
                addFlat('contact2');
                addFlat('contact3');
            }

            // Compute non_dnc_count from parsed result (overrides DB value for fresh calc)
            const computedNonDncCount = nonDncContacts.length;

            if (fullContacts.length === 0) {
                console.debug('[ExportModal] Row has no contacts:', c.property_address);
            }

            return {
                ...c,
                full_contacts: fullContacts,
                non_dnc_contacts: nonDncContacts,
                _non_dnc_count: computedNonDncCount,
            };
        });
    }, [contacts]);

    const displayData = useMemo(() => {
        let data = parsedData;

        // Filter out rows with NO contact details at all (un-skip-traced)
        data = data.filter((c: any) =>
            c.full_contacts.some((contact: ParsedContact) => contact.phone || contact.email)
        );

        if (filterDNC) {
            data = data.filter((c: any) => !c.dnc_toggle);
        }

        // Sort: clean (callable) contacts first, then by distress score
        data = [...data].sort((a: any, b: any) => {
            const aNonDnc = a._non_dnc_count ?? a.non_dnc_count ?? 0;
            const bNonDnc = b._non_dnc_count ?? b.non_dnc_count ?? 0;
            if (bNonDnc !== aNonDnc) return bNonDnc - aNonDnc; // DESC: more callable first
            return (b.distress_score ?? 0) - (a.distress_score ?? 0);
        });

        return data;

    }, [parsedData, filterDNC]);

    const handleExport = async () => {
        setExporting(true);

        // Slight artificial delay for UX and to yield thread
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Helper: build contacts_json (all contacts, DNC tagged)
            const buildFullContacts = (c: any) => {
                // If we have the new JSONB column, use it
                if (c.contacts_json && c.contacts_json.length > 0) {
                    return c.contacts_json.map((ce: any) => ({
                        name: ce.name || '',
                        type: ce.type || 'Landlord',
                        phones: ce.phones || [],
                        emails: ce.emails || [],
                        dnc: ce.dnc,
                    }));
                }
                // Fallback: use flat columns (legacy rows)
                return c.full_contacts || [];
            };

            // Helper: non_dnc_contacts (clean phones only) + callable annotation
            const buildNonDncContacts = (c: any) => {
                let cleanList: { name: string; phone: string; email: string; type: string }[] = [];
                if (c.contacts_json && c.contacts_json.length > 0) {
                    for (const ce of c.contacts_json) {
                        for (const p of (ce.phones || [])) {
                            if (!p.dnc) cleanList.push({
                                name: ce.name || '',
                                phone: p.number || '',
                                email: (ce.emails || [])[0] || '',
                                type: ce.type || '',
                            });
                        }
                    }
                } else {
                    cleanList = c.non_dnc_contacts || [];
                }
                return cleanList;
            };

            if (exportFormat === 'json') {
                let jsonStr = JSON.stringify(displayData.map((c: any) => {
                    const allContacts = buildFullContacts(c);
                    const cleanContacts = buildNonDncContacts(c);
                    return {
                        id: c.id,
                        property_name_or_owner: (c.lead_type === 'commercial' ? [c.property_name, c.first_name].filter(Boolean).join(' - ') : `${c.first_name || ''} ${c.last_name || ''}`.trim()) || c.property_name || c.first_name || '—',
                        property_address: c.property_address || '',
                        property_city: c.property_city || '',
                        county: c.county || '',
                        property_state: c.property_state || '',
                        property_zip: c.property_zip || '',
                        units: c.units || '',
                        year_built: c.year_built || '',
                        avm: c.avm || '',
                        deal_automator_url: c.deal_automator_url || '',
                        lead_type: c.lead_type || '',
                        overall_status: c.overall_status || '',
                        dnc: c.dnc_toggle,
                        contacts_json: allContacts,
                        non_dnc_contacts: cleanContacts.length > 0
                            ? { contacts: cleanContacts, note: `${cleanContacts.length}+ callable` }
                            : { contacts: [], note: 'No callable contacts' },
                    };
                }), null, 2);

                const blob = new Blob([jsonStr], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `SSREI_contacts_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
            } else {
                const headers = [
                    'Property/Owner Name', 'Property Address', 'City', 'County', 'State', 'Zip',
                    'Units', 'Year Built', 'AVM', 'Deal Automator URL',
                    'Lead Type', 'Status',
                    'Contact 1 Name', 'Contact 1 Phone', 'Contact 1 Email', 'Contact 1 Type',
                    'Contact 2 Name', 'Contact 2 Phone', 'Contact 2 Email', 'Contact 2 Type',
                    'Contact 3 Name', 'Contact 3 Phone', 'Contact 3 Email', 'Contact 3 Type',
                ];

                const rows = displayData.map((c: any) => {
                    const allContacts: ParsedContact[] = c.full_contacts || [];
                    const c1 = allContacts[0] || {} as ParsedContact;
                    const c2 = allContacts[1] || {} as ParsedContact;
                    const c3 = allContacts[2] || {} as ParsedContact;

                    const getFormattedName = (contact: ParsedContact) => {
                        if (!contact.name) return '';
                        return `${contact.name} - ${contact.dnc ? 'DNC' : 'Callable'}`;
                    };

                    const propertyOrOwnerName = (c.lead_type === 'commercial'
                        ? [c.property_name, c.first_name].filter(Boolean).join(' - ')
                        : ((c.first_name || '') + ' ' + (c.last_name || '')).trim()) || c.property_name || c.first_name || '';

                    return [
                        propertyOrOwnerName,
                        c.property_address || '',
                        c.property_city || '',
                        c.county || '',
                        c.property_state || '',
                        c.property_zip || '',
                        c.units || '',
                        c.year_built || '',
                        c.avm || '',
                        c.deal_automator_url || '',
                        c.lead_type || '',
                        c.overall_status || '',
                        getFormattedName(c1), c1.phone || '', c1.email || '', c1.type || '',
                        getFormattedName(c2), c2.phone || '', c2.email || '', c2.type || '',
                        getFormattedName(c3), c3.phone || '', c3.email || '', c3.type || '',
                    ];
                });

                const csvContent = [
                    headers.join(','),
                    ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                ].join('\n');

                // UTF-8 BOM ensures Excel opens the file with correct encoding
                const BOM = '\uFEFF';
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `SSREI_contacts_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
            }

        } catch (e) {
            console.error('Export error:', e);
        } finally {
            setExporting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Download size={20} className="text-[#1E6FA4]" />
                            Export Contacts
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {loading ? 'Analyzing data...' : `Ready to export ${displayData.length} contacts.`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-8">

                    {/* Settings Sidebar */}
                    <div className="w-full md:w-64 flex flex-col gap-6">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-900">Export Settings</label>

                            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-4">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={filterDNC}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterDNC(e.target.checked)}
                                        />
                                        <div className={`w-10 h-6 bg-gray-200 rounded-full transition-colors ${filterDNC ? 'bg-[#1E6FA4]' : ''}`}></div>
                                        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${filterDNC ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-900 group-hover:text-[#1E6FA4] transition-colors">Exclude DNC Leads</span>
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Removes leads universally flagged as Do Not Call. "Full Contacts" JSON will always include everyone, but this filters the exported rows.</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-900">Format</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setExportFormat('csv')}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${exportFormat === 'csv'
                                        ? 'border-[#1E6FA4] bg-blue-50 text-[#1E6FA4]'
                                        : 'border-gray-200 hover:border-blue-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FileSpreadsheet size={24} />
                                    <span className="text-xs font-semibold">CSV</span>
                                </button>
                                <button
                                    onClick={() => setExportFormat('json')}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${exportFormat === 'json'
                                        ? 'border-[#1E6FA4] bg-blue-50 text-[#1E6FA4]'
                                        : 'border-gray-200 hover:border-blue-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FileJson size={24} />
                                    <span className="text-xs font-semibold">JSON</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <button
                                onClick={handleExport}
                                disabled={loading || exporting || displayData.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1E6FA4] hover:bg-[#155A8A] text-white rounded-xl font-medium transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                Confirm Export
                            </button>
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <label className="text-sm font-semibold text-gray-900 mb-3 block">Data Preview</label>
                        <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
                                    <Loader2 size={32} className="animate-spin text-[#1E6FA4]" />
                                    <p className="text-sm font-medium">Loading contacts for export...</p>
                                </div>
                            ) : displayData.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <AlertTriangle size={32} className="text-amber-400/50" />
                                    <p className="text-sm font-medium">No contacts match the current filters.</p>
                                </div>
                            ) : (
                                <div className="overflow-auto flex-1 h-full">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Property</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Type</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-normal max-w-[200px]">Full Contacts (Parsed)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {displayData.slice(0, 100).map((c: any) => (
                                                <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                                        {c.property_address || c.property_name || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                                                        {c.lead_type || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {c.dnc_toggle ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                                <AlertTriangle size={10} /> DNC
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                                Clean
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono tracking-tight max-w-[300px] truncate">
                                                        <span title={JSON.stringify(c.full_contacts)}>
                                                            {c.full_contacts.length} Contact(s) Array
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {displayData.length > 100 && (
                                        <div className="p-3 text-center border-t border-gray-100 bg-gray-50/50">
                                            <p className="text-xs text-gray-500">Showing first 100 rows preview...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
