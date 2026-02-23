import type { Contact } from '../types';

const PROXY_URL = '/api/ghl-proxy';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function pushContactToGHL(contact: Contact): Promise<{ contactId: string; opportunityId: string }> {
  const res = await fetch(`${PROXY_URL}?action=submit-lead`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ contact }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL sync failed');
  return data;
}

export async function updateContactDNCInGHL(contactId: string, dnd: boolean): Promise<void> {
  const res = await fetch(`${PROXY_URL}?action=update-contact-dnc`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ contactId, dnd }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL DNC update failed');
}

export async function syncDNCToGHL(contact: Contact, dncEnabled: boolean): Promise<void> {
  const res = await fetch(`${PROXY_URL}?action=sync-dnc`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ contact, dncEnabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL DNC sync failed');
}

export async function deleteOpportunityFromGHL(opportunityId: string): Promise<void> {
  const res = await fetch(`${PROXY_URL}?action=delete-opportunity&opportunityId=${encodeURIComponent(opportunityId)}`, {
    method: 'DELETE',
    headers: JSON_HEADERS,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL delete failed');
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

export async function getPipelineStages(): Promise<{ stages: GHLPipelineStage[]; pipelineId: string; pipelineName: string }> {
  const res = await fetch(`${PROXY_URL}?action=get-pipeline-stages`, {
    method: 'GET',
    headers: JSON_HEADERS,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL fetch pipeline stages failed');
  return data;
}

export async function updateOpportunityStage(opportunityId: string, stageId: string): Promise<void> {
  const res = await fetch(`${PROXY_URL}?action=update-opportunity-stage`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ opportunityId, stageId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GHL update opportunity stage failed');
}
