const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

async function getSettings() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_settings?select=key,value`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) throw new Error('Could not load GHL settings from database');
  const rows = await res.json();
  if (!rows || rows.length === 0) throw new Error('No GHL settings found. Please configure in Settings.');

  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  if (!settings.api_key || !settings.location_id || !settings.pipeline_id) {
    throw new Error('GHL credentials are incomplete. Please fill in API Key, Location ID, and Pipeline ID in Settings.');
  }
  return settings;
}

async function fetchPipelineStageId(settings, stageName) {
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines/?locationId=${settings.location_id}`,
    { headers: ghlHeaders(settings.api_key) }
  );
  if (!res.ok) throw new Error(`GHL fetch pipelines failed (${res.status})`);
  const data = await res.json();
  const pipelines = data.pipelines || [];
  const pipeline = pipelines.find((p) => p.id === settings.pipeline_id);
  if (!pipeline) throw new Error(`Pipeline ${settings.pipeline_id} not found`);
  const stage = pipeline.stages.find((s) => s.name.toLowerCase() === stageName.toLowerCase());
  if (!stage) throw new Error(`Stage "${stageName}" not found in pipeline`);
  return stage.id;
}

async function fetchCustomFieldIdMap(settings) {
  const res = await fetch(
    `${GHL_BASE}/opportunities/fields?locationId=${settings.location_id}`,
    { headers: ghlHeaders(settings.api_key) }
  );
  if (!res.ok) throw new Error(`GHL fetch custom fields failed (${res.status})`);
  const data = await res.json();
  const fields = data.fields || [];
  const map = {};
  for (const f of fields) {
    map[f.name] = f.id;
    if (f.fieldKey) map[f.fieldKey] = f.id;
  }
  return map;
}

function buildCustomFieldsPayload(contact, fieldIdMap) {
  const fieldMapping = [
    { label: 'Property Address', key: 'property_address' },
    { label: 'Property City', key: 'property_city' },
    { label: 'Property State', key: 'property_state' },
    { label: 'Property Zip', key: 'property_zip' },
    { label: 'Distress Score', key: 'distress_score' },
    { label: 'Score Tier', key: 'score_tier' },
    { label: 'Distress Flags', key: 'distress_flags' },
    { label: 'Deal Automator Link', key: 'deal_automator_url' },
    { label: 'Address Hash', key: 'address_hash' },
    { label: 'Absentee Owner', key: 'absentee_owner' },
    { label: 'Foreclosure Activity', key: 'foreclosure_activity' },
    { label: 'Delinquent Tax', key: 'delinquent_tax' },
    { label: 'High Equity', key: 'high_equity' },
    { label: 'Free and Clear', key: 'free_and_clear' },
    { label: 'AVM', key: 'avm' },
    { label: 'Wholesale Value', key: 'wholesale_value' },
    { label: 'LTV', key: 'ltv' },
    { label: 'Estimated Mortgage Balance', key: 'estimated_mortgage_balance' },
  ];

  const result = [];
  for (const { label, key } of fieldMapping) {
    const id = fieldIdMap[label];
    let value = contact[key];
    if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
    if (id && value !== undefined && value !== null && value !== '') {
      result.push({ id, field_value: String(value) });
    }
  }
  return result;
}

async function findExistingContact(settings, email, phone) {
  if (email) {
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${settings.location_id}&email=${encodeURIComponent(email)}`,
      { headers: ghlHeaders(settings.api_key) }
    );
    if (res.ok) {
      const data = await res.json();
      const contacts = data.contacts || [];
      if (contacts.length > 0) return contacts[0].id;
    }
  }
  if (phone) {
    const normalizedPhone = phone.replace(/\D/g, '');
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${settings.location_id}&phone=${encodeURIComponent(normalizedPhone)}`,
      { headers: ghlHeaders(settings.api_key) }
    );
    if (res.ok) {
      const data = await res.json();
      const contacts = data.contacts || [];
      if (contacts.length > 0) return contacts[0].id;
    }
  }
  return null;
}

async function handleSubmitLead(contact) {
  const settings = await getSettings();
  const stageName = contact.dnc_toggle ? 'DNC – Email Only' : 'New Lead';
  const [stageId, fieldIdMap] = await Promise.all([
    fetchPipelineStageId(settings, stageName),
    fetchCustomFieldIdMap(settings),
  ]);

  const firstName = contact.first_name || '';
  const lastName = contact.last_name || '';
  const email = contact.contact1_email1 || '';
  const phone = contact.contact1_phone1 || '';
  const fullName = `${firstName} ${lastName}`.trim();

  const contactPayload = {
    firstName,
    lastName,
    locationId: settings.location_id,
    address1: contact.mailing_address || contact.property_address,
    city: contact.mailing_city || contact.property_city,
    state: contact.mailing_state || contact.property_state,
    postalCode: contact.mailing_zip || contact.property_zip,
    tags: ['SSREI Lead'],
  };
  if (email) contactPayload.email = email;
  if (phone) contactPayload.phone = phone;

  const existingContactId = await findExistingContact(settings, email, phone);

  let contactId;
  if (existingContactId) {
    const updateRes = await fetch(`${GHL_BASE}/contacts/${existingContactId}`, {
      method: 'PUT',
      headers: ghlHeaders(settings.api_key),
      body: JSON.stringify(contactPayload),
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`GHL update contact failed (${updateRes.status}): ${errText}`);
    }
    contactId = existingContactId;
  } else {
    const contactRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: 'POST',
      headers: ghlHeaders(settings.api_key),
      body: JSON.stringify(contactPayload),
    });
    if (!contactRes.ok) {
      const errText = await contactRes.text();
      throw new Error(`GHL create contact failed (${contactRes.status}): ${errText}`);
    }
    const contactData = await contactRes.json();
    contactId = contactData.contact?.id || '';
    if (!contactId) throw new Error('Failed to create GHL contact: no ID returned');
  }

  const customFields = buildCustomFieldsPayload(contact, fieldIdMap);
  const oppPayload = {
    pipelineId: settings.pipeline_id,
    locationId: settings.location_id,
    name: `${fullName} - ${contact.property_address || ''}`,
    pipelineStageId: stageId,
    contactId,
    status: 'open',
    customFields,
  };

  const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
    method: 'POST',
    headers: ghlHeaders(settings.api_key),
    body: JSON.stringify(oppPayload),
  });
  if (!oppRes.ok) {
    const errText = await oppRes.text();
    throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
  }
  const oppData = await oppRes.json();
  const opportunityId = oppData.opportunity?.id || '';

  return { contactId, opportunityId };
}

async function handleUpdateContactDNC(contactId, dnd) {
  const settings = await getSettings();
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(settings.api_key),
    body: JSON.stringify({ dnd }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL update contact DND failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleDeleteOpportunity(opportunityId) {
  const settings = await getSettings();
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: 'DELETE',
    headers: ghlHeaders(settings.api_key),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL delete opportunity failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleGetPipelineStages() {
  const settings = await getSettings();
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines/?locationId=${settings.location_id}`,
    { headers: ghlHeaders(settings.api_key) }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL fetch pipelines failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const pipelines = data.pipelines || [];
  const pipeline = pipelines.find((p) => p.id === settings.pipeline_id);
  if (!pipeline) throw new Error(`Pipeline ${settings.pipeline_id} not found`);
  const stages = (pipeline.stages || []).map((s) => ({ id: s.id, name: s.name, position: s.position ?? 0 }));
  stages.sort((a, b) => a.position - b.position);
  return { stages, pipelineId: pipeline.id, pipelineName: pipeline.name };
}

async function handleUpdateOpportunityStage(opportunityId, stageId) {
  const settings = await getSettings();
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: 'PUT',
    headers: ghlHeaders(settings.api_key),
    body: JSON.stringify({ pipelineStageId: stageId }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL update opportunity stage failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  try {
    const action = req.query.action;

    if (req.method === 'POST' && action === 'submit-lead') {
      const { contact } = req.body;
      const result = await handleSubmitLead(contact);
      res.status(200).json(result);
      return;
    }

    if (req.method === 'POST' && action === 'update-contact-dnc') {
      const { contactId, dnd } = req.body;
      if (!contactId) { res.status(400).json({ error: 'contactId is required' }); return; }
      const result = await handleUpdateContactDNC(contactId, !!dnd);
      res.status(200).json(result);
      return;
    }

    if (req.method === 'DELETE' && action === 'delete-opportunity') {
      const opportunityId = req.query.opportunityId;
      if (!opportunityId) { res.status(400).json({ error: 'opportunityId is required' }); return; }
      const result = await handleDeleteOpportunity(opportunityId);
      res.status(200).json(result);
      return;
    }

    if (req.method === 'GET' && action === 'get-pipeline-stages') {
      const result = await handleGetPipelineStages();
      res.status(200).json(result);
      return;
    }

    if (req.method === 'PUT' && action === 'update-opportunity-stage') {
      const { opportunityId, stageId } = req.body;
      if (!opportunityId || !stageId) { res.status(400).json({ error: 'opportunityId and stageId are required' }); return; }
      const result = await handleUpdateOpportunityStage(opportunityId, stageId);
      res.status(200).json(result);
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}
