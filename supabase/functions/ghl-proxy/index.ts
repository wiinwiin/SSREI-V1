import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

interface GHLSettings {
  ghl_api_key: string;
  ghl_location_id: string;
  ghl_pipeline_id: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getSettings(
  supabase: ReturnType<typeof createClient>
): Promise<GHLSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("ghl_api_key, ghl_location_id, ghl_pipeline_id")
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Could not load GHL settings from database");
  if (!data.ghl_api_key || !data.ghl_location_id || !data.ghl_pipeline_id) {
    throw new Error(
      "GHL credentials are incomplete. Please fill in API Key, Location ID, and Pipeline ID in Settings."
    );
  }
  return data as GHLSettings;
}

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function fetchPipelineStageId(
  settings: GHLSettings,
  stageName: string
): Promise<string> {
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines/?locationId=${settings.ghl_location_id}`,
    { headers: ghlHeaders(settings.ghl_api_key) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL fetch pipelines failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const pipelines: Array<{
    id: string;
    stages: Array<{ id: string; name: string }>;
  }> = data.pipelines || [];
  const pipeline = pipelines.find((p) => p.id === settings.ghl_pipeline_id);
  if (!pipeline)
    throw new Error(`Pipeline ${settings.ghl_pipeline_id} not found`);
  const stage = pipeline.stages.find(
    (s) => s.name.toLowerCase() === stageName.toLowerCase()
  );
  if (!stage) throw new Error(`Stage "${stageName}" not found in pipeline`);
  return stage.id;
}

async function fetchCustomFieldIdMap(
  settings: GHLSettings
): Promise<Record<string, string>> {
  const res = await fetch(
    `${GHL_BASE}/opportunities/fields?locationId=${settings.ghl_location_id}`,
    { headers: ghlHeaders(settings.ghl_api_key) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL fetch custom fields failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const fields: Array<{ id: string; name: string; fieldKey?: string }> =
    data.fields || [];
  const map: Record<string, string> = {};
  for (const f of fields) {
    map[f.name] = f.id;
    if (f.fieldKey) map[f.fieldKey] = f.id;
  }
  return map;
}

function buildCustomFieldsPayload(
  lead: Record<string, unknown>,
  fieldIdMap: Record<string, string>
): Array<{ id: string; field_value: string }> {
  const fieldMapping: Array<{ label: string; key: string }> = [
    { label: "Owner Type", key: "owner_type" },
    { label: "Length of Ownership", key: "length_of_ownership" },
    { label: "Estimated Equity", key: "estimated_equity" },
    { label: "Absentee Owner", key: "absentee_owner" },
    { label: "Out of State Owner", key: "out_of_state_owner" },
    { label: "Mailing Address", key: "mailing_address" },
    { label: "Home Type", key: "home_type" },
    { label: "Square Feet", key: "square_feet" },
    { label: "Beds", key: "beds" },
    { label: "Baths", key: "baths" },
    { label: "Units", key: "units" },
    { label: "Stories", key: "stories" },
    { label: "County", key: "county" },
    { label: "Zoning", key: "zoning" },
    { label: "Parcel Number", key: "parcel_number" },
    { label: "Lot Size", key: "lot_size" },
    { label: "HOA", key: "hoa" },
    { label: "Property Address", key: "property_address" },
    { label: "City", key: "city" },
    { label: "State", key: "state" },
    { label: "Zip", key: "zip" },
    { label: "Property Taxes", key: "property_taxes" },
    { label: "Last Sale Date", key: "last_sale_date" },
    { label: "Last Sale Price", key: "last_sale_price" },
    { label: "Mortgage Amount", key: "mortgage_amount" },
    { label: "Mortgage Balance", key: "mortgage_balance" },
    { label: "LTV", key: "ltv" },
    { label: "AVM", key: "avm" },
    { label: "Rental Value", key: "rental_value" },
    { label: "Assessed Value", key: "assessed_value" },
    { label: "Retail Value Estimate", key: "retail_value_estimate" },
    { label: "Rental Value Estimate", key: "rental_value_estimate" },
    { label: "Wholesale Value Estimate", key: "wholesale_value_estimate" },
    { label: "Retail Sellability Score", key: "retail_sellability_score" },
    { label: "Rental Sellability Score", key: "rental_sellability_score" },
    { label: "Wholesale Sellability Score", key: "wholesale_sellability_score" },
    { label: "Disposition", key: "disposition" },
    { label: "Follow Up Date", key: "follow_up_date" },
    { label: "Submitted By", key: "submitted_by" },
    { label: "Notes", key: "notes" },
  ];

  const result: Array<{ id: string; field_value: string }> = [];
  for (const { label, key } of fieldMapping) {
    const id = fieldIdMap[label];
    let value = lead[key];
    if (typeof value === "boolean") value = value ? "Yes" : "No";
    if (id && value !== undefined && value !== null && value !== "") {
      result.push({ id, field_value: String(value) });
    }
  }
  return result;
}

async function findExistingContact(
  settings: GHLSettings,
  email: string,
  phone: string
): Promise<string | null> {
  if (email) {
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${settings.ghl_location_id}&email=${encodeURIComponent(email)}`,
      { headers: ghlHeaders(settings.ghl_api_key) }
    );
    if (res.ok) {
      const data = await res.json();
      const contacts = data.contacts || [];
      if (contacts.length > 0) return contacts[0].id;
    }
  }

  if (phone) {
    const normalizedPhone = phone.replace(/\D/g, "");
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${settings.ghl_location_id}&phone=${encodeURIComponent(normalizedPhone)}`,
      { headers: ghlHeaders(settings.ghl_api_key) }
    );
    if (res.ok) {
      const data = await res.json();
      const contacts = data.contacts || [];
      if (contacts.length > 0) return contacts[0].id;
    }
  }

  return null;
}

async function handleSubmitLead(
  supabase: ReturnType<typeof createClient>,
  lead: Record<string, unknown>
) {
  const settings = await getSettings(supabase);

  const [stageId, fieldIdMap] = await Promise.all([
    fetchPipelineStageId(settings, "New Lead"),
    fetchCustomFieldIdMap(settings),
  ]);

  const ownerName = String(lead.owner_name || "").trim();
  const nameParts = ownerName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const email = String(lead.email || "").trim();
  const phone = String(lead.phone || "").trim();

  const contactPayload: Record<string, unknown> = {
    firstName,
    lastName,
    locationId: settings.ghl_location_id,
    address1: lead.mailing_address || lead.property_address,
    city: lead.city,
    state: lead.state,
    postalCode: lead.zip,
    tags: ["SSREI Lead"],
  };
  if (email) contactPayload.email = email;
  if (phone) contactPayload.phone = phone;

  const existingContactId = await findExistingContact(settings, email, phone);

  let contactId: string;

  if (existingContactId) {
    const updateRes = await fetch(`${GHL_BASE}/contacts/${existingContactId}`, {
      method: "PUT",
      headers: ghlHeaders(settings.ghl_api_key),
      body: JSON.stringify(contactPayload),
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`GHL update contact failed (${updateRes.status}): ${errText}`);
    }
    contactId = existingContactId;
  } else {
    const contactRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders(settings.ghl_api_key),
      body: JSON.stringify(contactPayload),
    });
    if (!contactRes.ok) {
      const errText = await contactRes.text();
      throw new Error(`GHL create contact failed (${contactRes.status}): ${errText}`);
    }
    const contactData = await contactRes.json();
    contactId = contactData.contact?.id || "";
    if (!contactId) throw new Error("Failed to create GHL contact: no ID returned");
  }

  const customFields = buildCustomFieldsPayload(lead, fieldIdMap);
  const oppPayload = {
    pipelineId: settings.ghl_pipeline_id,
    locationId: settings.ghl_location_id,
    name: `${ownerName} - ${lead.property_address || ""}`,
    pipelineStageId: stageId,
    contactId,
    status: "open",
    customFields,
  };

  const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
    method: "POST",
    headers: ghlHeaders(settings.ghl_api_key),
    body: JSON.stringify(oppPayload),
  });
  if (!oppRes.ok) {
    const errText = await oppRes.text();
    throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
  }
  const oppData = await oppRes.json();
  const opportunityId = oppData.opportunity?.id || "";

  return { contactId, opportunityId };
}

async function handleUpdateContactDNC(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  dnd: boolean
) {
  const settings = await getSettings(supabase);
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(settings.ghl_api_key),
    body: JSON.stringify({ dnd }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL update contact DND failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleDeleteOpportunity(
  supabase: ReturnType<typeof createClient>,
  opportunityId: string
) {
  const settings = await getSettings(supabase);
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: "DELETE",
    headers: ghlHeaders(settings.ghl_api_key),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL delete opportunity failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST" && action === "submit-lead") {
      const body = await req.json();
      const result = await handleSubmitLead(supabase, body.lead);
      return jsonResponse(result);
    }

    if (req.method === "POST" && action === "update-contact-dnc") {
      const body = await req.json();
      const { contactId, dnd } = body;
      if (!contactId) return jsonResponse({ error: "contactId is required" }, 400);
      const result = await handleUpdateContactDNC(supabase, contactId, !!dnd);
      return jsonResponse(result);
    }

    if (req.method === "DELETE" && action === "delete-opportunity") {
      const opportunityId = url.searchParams.get("opportunityId");
      if (!opportunityId)
        return jsonResponse({ error: "opportunityId is required" }, 400);
      const result = await handleDeleteOpportunity(supabase, opportunityId);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
