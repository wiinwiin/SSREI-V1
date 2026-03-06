import type { CSVRow, ScoreTier, OverallStatus } from '../types';

function parseBool(val: string | undefined): boolean {
  if (!val) return false;
  return val.trim().toLowerCase() === 'true' || val.trim() === '1' || val.trim().toLowerCase() === 'yes';
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function computeDistressScore(row: CSVRow): { score: number; tier: ScoreTier; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  if (parseBool(row['ForeclosureActivity'])) { score += 3; flags.push('Foreclosure'); }
  if (parseBool(row['DelinquentTaxActivity'])) { score += 3; flags.push('Delinquent Tax'); }
  if (parseBool(row['UpsideDown'])) { score += 3; flags.push('Upside Down'); }

  if (parseBool(row['AbsenteeOwner'])) { score += 2; flags.push('Absentee Owner'); }
  if (parseBool(row['PotentiallyInherited'])) { score += 2; flags.push('Potentially Inherited'); }
  if (parseBool(row['HighEquity'])) { score += 2; flags.push('High Equity'); }
  if (parseBool(row['FreeAndClear'])) { score += 2; flags.push('Free & Clear'); }
  if (parseBool(row['LongTermOwner'])) { score += 2; flags.push('Long Term Owner'); }

  if (parseBool(row['ActiveListing'])) { score += 1; flags.push('Active Listing'); }

  const ltv = parseNum(row['LTV']);
  const emb = parseNum(row['EstimatedMortgageBalance']);
  const avm = parseNum(row['AVM']);

  if (ltv > 90) { score += 2; flags.push('High LTV'); }
  if (emb > 0 && avm > 0 && emb > avm) { score += 2; flags.push('Underwater'); }

  let tier: ScoreTier;
  if (score >= 15) tier = 'Hot';
  else if (score >= 9) tier = 'Warm';
  else if (score >= 4) tier = 'Lukewarm';
  else if (score >= 1) tier = 'Cold';
  else tier = 'No Signal';

  return { score, tier, flags };
}

export const SCORE_TIER_EMOJIS: Record<ScoreTier, string> = {
  'Hot': '🔥',
  'Warm': '☀️',
  'Lukewarm': '🌤️',
  'Cold': '❄️',
  'No Signal': '⚫',
};

export function detectDNCLitigator(row: CSVRow): { dnc: boolean; litigator: boolean } {
  const dncFields = [
    'Contact1Phone_1_DNC', 'Contact1Phone_2_DNC', 'Contact1Phone_3_DNC',
    'Contact2Phone_1_DNC', 'Contact2Phone_2_DNC', 'Contact2Phone_3_DNC',
    'Contact3Phone_1_DNC', 'Contact3Phone_2_DNC', 'Contact3Phone_3_DNC',
  ];
  const litigatorFields = [
    'Contact1Phone_1_Litigator', 'Contact1Phone_2_Litigator', 'Contact1Phone_3_Litigator',
    'Contact2Phone_1_Litigator', 'Contact2Phone_2_Litigator', 'Contact2Phone_3_Litigator',
    'Contact3Phone_1_Litigator', 'Contact3Phone_2_Litigator', 'Contact3Phone_3_Litigator',
  ];

  const litigator = litigatorFields.some(f => parseBool(row[f]));
  const dnc = dncFields.some(f => parseBool(row[f]));

  return { dnc, litigator };
}

export function determineOverallStatus(dnc: boolean, litigator: boolean): OverallStatus {
  if (litigator) return 'Litigator';
  if (dnc) return 'DNC';
  return 'Clean';
}

export function buildDealAutomatorUrl(addressHash: string): string {
  return `https://app.dealautomator.com/Marketing/Leads/Index/Property#/property/${addressHash}`;
}

export const SCORE_TIER_COLORS: Record<ScoreTier, string> = {
  Hot: 'bg-red-900/40 text-red-300 border border-red-700/50',
  Warm: 'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  Lukewarm: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  Cold: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  'No Signal': 'bg-zinc-800 text-zinc-400 border border-zinc-700/50',
};

export const STATUS_COLORS: Record<string, string> = {
  Clean: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50',
  DNC: 'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  Litigator: 'bg-red-900/40 text-red-300 border border-red-700/50',
  Duplicate: 'bg-zinc-800 text-zinc-400 border border-zinc-700/50',
};
