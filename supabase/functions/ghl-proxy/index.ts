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
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["api_key", "location_id", "pipeline_id"]);

  if (!data || data.length === 0) {
    throw new Error("Could not load GHL settings from database.");
  }

  const settings: Record<string, string> = {};
  for (const row of data) {
    settings[row.key] = row.value?.toString().trim();
  }

  if (!settings.api_key || !settings.location_id || !settings.pipeline_id) {
    throw new Error("GHL credentials are incomplete in database.");
  }

  return {
    ghl_api_key: settings.api_key,
    ghl_location_id: settings.location_id,
    ghl_pipeline_id: settings.pipeline_id,
  };
}

function ghlHeaders(apiKey: string) {
  const authHeader = apiKey.toLowerCase().startsWith('bearer ') ? apiKey : `Bearer ${apiKey}`;
  return {
    Authorization: authHeader,
    Accept: "application/json",
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function fetchPipelineStageId(
  settings: GHLSettings,
  stageName: string
): Promise<string> {
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${settings.ghl_location_id}`,
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

interface CustomFieldMap {
  all: Record<string, string>;
  contact: Record<string, string>;
  opportunity: Record<string, string>;
}

async function fetchCustomFieldIdMap(
  settings: GHLSettings
): Promise<CustomFieldMap> {
  const res = await fetch(
    `${GHL_BASE}/locations/${settings.ghl_location_id}/customFields`,
    { headers: ghlHeaders(settings.ghl_api_key) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL fetch custom fields failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const fields: Array<{ id: string; name: string; fieldKey?: string; model?: string }> =
    data.customFields || [];

  console.log(`Found ${fields.length} GHL custom fields`);

  const allMap: Record<string, string> = {};
  const contactMap: Record<string, string> = {};
  const opportunityMap: Record<string, string> = {};

  for (const f of fields) {
    const displayName = f.name;
    const snakeName = displayName.toLowerCase().replace(/\s+/g, '_');
    const targetMap = f.model === 'contact' ? contactMap : f.model === 'opportunity' ? opportunityMap : allMap;

    allMap[displayName] = f.id;
    allMap[snakeName] = f.id;
    targetMap[displayName] = f.id;
    targetMap[snakeName] = f.id;

    if (f.fieldKey) {
      const cleanKey = f.fieldKey.replace('opportunity.', '').replace('contact.', '');
      allMap[f.fieldKey] = f.id;
      allMap[cleanKey] = f.id;
      targetMap[f.fieldKey] = f.id;
      targetMap[cleanKey] = f.id;
    }

    console.log(`Field: "${displayName}" (${f.model || 'unknown'}) -> ID: ${f.id}`);
  }

  console.log(`Contact fields: ${Object.keys(contactMap).length / 2}, Opportunity fields: ${Object.keys(opportunityMap).length / 2}`);
  return { all: allMap, contact: contactMap, opportunity: opportunityMap };
}

function buildCustomFieldsPayload(
  lead: Record<string, unknown>,
  fieldIdMap: Record<string, string>
): Array<{ id: string; field_value: string }> {
  const fieldMapping: Array<{ key: string; aliases?: string[] }> = [
    { key: "seller_property_address", aliases: ["property_address"] },
    { key: "seller_property_year_built", aliases: ["year_built"] },
    { key: "seller_asking_price", aliases: ["asking_price"] },
    { key: "seller_property_estimated_value", aliases: ["avm", "market_value", "retail_value_estimate"] },
    { key: "seller_lead_source", aliases: ["source", "lead_source_detail", "source_detail"] },
    { key: "estimated_payment", aliases: ["estimated_mortgage_payment"] },
    { key: "deal_automator_types" },
    { key: "estimated_balance", aliases: ["estimated_mortgage_balance"] },
    { key: "mortgage_balance", aliases: ["estimated_mortgage_balance"] },
    { key: "retail_value_estimate", aliases: ["market_value"] },
    { key: "rental_value", aliases: ["rental_estimate_low", "rental_estimate_high"] },
    { key: "rental_sellability_score" },
    { key: "assessed_value" },
    { key: "ltv" },
    { key: "avm" },
    { key: "retail_sellability_score" },
    { key: "wholesale_value_estimate" },
    { key: "rental_value_estimate" },
    { key: "garage_area" },
    { key: "roof" },
    { key: "exterior" },
    { key: "interior_walls" },
    { key: "basement" },
    { key: "condition" },
    { key: "basement_area" },
    { key: "gross_area" },
    { key: "living_area" },
    { key: "flooring" },
    { key: "mortgage_amount" },
    { key: "stories" },
    { key: "parcel_number" },
    { key: "lot_size" },
    { key: "zoning" },
    { key: "property_taxes" },
    { key: "last_sale_date" },
    { key: "units" },
    { key: "county" },
    { key: "last_sale_price" },
    { key: "listing_description" },
    { key: "municipality" },
    { key: "house_style" },
    { key: "agent_email" },
    { key: "below_above_value" },
    { key: "residential_investments" },
    { key: "agent_phone" },
    { key: "potentially_inherited" },
    { key: "agent_office" },
    { key: "commercial_investments" },
    { key: "square_feet" },
    { key: "absentee_owner" },
    { key: "baths" },
    { key: "beds" },
    { key: "length_of_ownership" },
    { key: "home_type" },
    { key: "hoa" },
    { key: "owner_type" },
    { key: "out_of_state_owner" },
    { key: "estimated_equity" },
    { key: "submitted_by" },
    { key: "ssrei_web_app" },
    { key: "disposition" },
    { key: "sold_date" },
    { key: "listing_status" },
    { key: "wholesale_sellability_score" },
    { key: "mls_number" },
    { key: "agent_name" },
    { key: "mls_source" },
    { key: "sold_price" },
    { key: "days_on_market" },
    { key: "cooling" },
    { key: "building_area" },
    { key: "year_built" },
    { key: "legal_description" },
    { key: "heating_fuel" },
    { key: "location_influence" },
    { key: "school_district" },
    { key: "subdivision" },
    { key: "adjacent_area" },
    { key: "garage" },
    { key: "roof_shape" },
    { key: "water" },
    { key: "open_loans" },
    { key: "fireplace" },
    { key: "loan_total_amount" },
    { key: "patio" },
    { key: "porch" },
    { key: "pool" },
    { key: "sewer" },
    { key: "market_value" },
    { key: "property_address" },
    { key: "city" },
    { key: "state" },
    { key: "zip" },
    { key: "mailing_address" },
    { key: "notes" },
    { key: "follow_up_date" },
    { key: "estimated_mortgage_balance" },
    { key: "estimated_mortgage_payment" },
    { key: "retail_value_estimate" },
    { key: "wholesale_value" },
    { key: "wholesale_value_estimate" },
    { key: "rental_value" },
    { key: "rental_value_estimate" },
    { key: "rental_estimate_low" },
    { key: "rental_estimate_high" },
    { key: "loan_amount" },
    { key: "loan_type" },
    { key: "mortgage_interest_rate" },
    { key: "number_of_loans" },
    { key: "total_loans" },
  ];

  const result: Array<{ id: string; field_value: string }> = [];
  const matched: string[] = [];
  const unmatched: string[] = [];
  const withValues: string[] = [];

  console.log("=== Building Custom Fields Payload ===");
  console.log(`Total fields to check: ${fieldMapping.length}`);
  console.log(`Available GHL field mappings: ${Object.keys(fieldIdMap).length}`);

  for (const fieldDef of fieldMapping) {
    const { key, aliases } = fieldDef;
    const id = fieldIdMap[key];
    let value = lead[key];

    if ((value === undefined || value === null || value === "") && aliases) {
      for (const alias of aliases) {
        const aliasValue = lead[alias];
        if (aliasValue !== undefined && aliasValue !== null && aliasValue !== "") {
          value = aliasValue;
          console.log(`Using alias "${alias}" for field "${key}": ${value}`);
          break;
        }
      }
    }

    if (key === "rental_value" && !value) {
      const low = lead["rental_estimate_low"];
      const high = lead["rental_estimate_high"];
      if (low && high) {
        value = Math.round((Number(low) + Number(high)) / 2);
        console.log(`Calculated rental_value from low/high: ${value}`);
      }
    }

    if (typeof value === "boolean") value = value ? "Yes" : "No";

    if (id) {
      const fieldValue = (value === undefined || value === null) ? "" : String(value);
      result.push({ id, field_value: fieldValue });
      matched.push(key);
      if (fieldValue !== "") {
        withValues.push(`${key}=${fieldValue}`);
      }
    } else if (value !== undefined && value !== null && value !== "") {
      unmatched.push(key);
    }
  }

  console.log(`✓ Mapped ${result.length} custom fields`);
  console.log(`✓ Fields with values: ${withValues.length}`);
  if (withValues.length > 0) {
    console.log(`Sample values: ${withValues.slice(0, 10).join(", ")}`);
  }
  if (unmatched.length > 0) {
    console.log(`⚠ Fields with values but no GHL mapping: ${unmatched.join(", ")}`);
  }

  return result;
}

async function findExistingContact(
  settings: GHLSettings,
  email: string,
  phone: string
): Promise<string | null> {
  if (email) {
    try {
      const res = await fetch(
        `${GHL_BASE}/contacts/?locationId=${settings.ghl_location_id}&query=${encodeURIComponent(email)}`,
        { headers: ghlHeaders(settings.ghl_api_key) }
      );
      if (res.ok) {
        const data = await res.json();
        const contacts = data.contacts || [];
        if (contacts.length > 0) {
          const exactMatch = contacts.find((c: any) =>
            c.email?.toLowerCase() === email.toLowerCase()
          );
          if (exactMatch) return exactMatch.id;
          return contacts[0].id;
        }
      }
    } catch (err) {
      console.error("Error searching by email:", err);
    }
  }

  if (phone) {
    try {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length >= 10) {
        const res = await fetch(
          `${GHL_BASE}/contacts/?locationId=${settings.ghl_location_id}&query=${encodeURIComponent(normalizedPhone)}`,
          { headers: ghlHeaders(settings.ghl_api_key) }
        );
        if (res.ok) {
          const data = await res.json();
          const contacts = data.contacts || [];
          if (contacts.length > 0) {
            const exactMatch = contacts.find((c: any) =>
              c.phone?.replace(/\D/g, "") === normalizedPhone
            );
            if (exactMatch) return exactMatch.id;
            return contacts[0].id;
          }
        }
      }
    } catch (err) {
      console.error("Error searching by phone:", err);
    }
  }

  return null;
}

function normalizeLeadFields(lead: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...lead };

  if (lead.property_city && !lead.city) normalized.city = lead.property_city;
  if (lead.property_state && !lead.state) normalized.state = lead.property_state;
  if (lead.property_zip && !lead.zip) normalized.zip = lead.property_zip;
  if (lead.sqft && !lead.square_feet) normalized.square_feet = lead.sqft;
  if (lead.tax_amount && !lead.property_taxes) normalized.property_taxes = lead.tax_amount;

  if (lead.estimated_mortgage_payment && !lead.estimated_payment) {
    normalized.estimated_payment = lead.estimated_mortgage_payment;
  }

  if (lead.estimated_mortgage_balance && !lead.estimated_balance) {
    normalized.estimated_balance = lead.estimated_mortgage_balance;
  }

  if (lead.estimated_mortgage_balance && !lead.mortgage_balance) {
    normalized.mortgage_balance = lead.estimated_mortgage_balance;
  }

  if (lead.market_value && !lead.retail_value_estimate) {
    normalized.retail_value_estimate = lead.market_value;
  }

  if (lead.rental_estimate_low && lead.rental_estimate_high && !lead.rental_value) {
    const low = Number(lead.rental_estimate_low) || 0;
    const high = Number(lead.rental_estimate_high) || 0;
    normalized.rental_value = Math.round((low + high) / 2);
  }

  if (lead.rental_estimate_low && lead.rental_estimate_high && !lead.rental_value_estimate) {
    const low = Number(lead.rental_estimate_low) || 0;
    const high = Number(lead.rental_estimate_high) || 0;
    normalized.rental_value_estimate = Math.round((low + high) / 2);
  }

  if (lead.wholesale_value && !lead.wholesale_value_estimate) {
    normalized.wholesale_value_estimate = lead.wholesale_value;
  }

  return normalized;
}

async function handleSubmitLead(
  supabase: ReturnType<typeof createClient>,
  lead: Record<string, unknown>
) {
  const settings = await getSettings(supabase);

  const normalizedLead = normalizeLeadFields(lead);

  const [stageId, fieldIdMap] = await Promise.all([
    fetchPipelineStageId(settings, "New Lead"),
    fetchCustomFieldIdMap(settings),
  ]);

  const isCommercial = normalizedLead.lead_type === 'commercial';
  const propertyName = String(normalizedLead.property_name || "").trim();
  const firstName = String(normalizedLead.first_name || normalizedLead.owner_name || "").trim();
  const lastName = String(normalizedLead.last_name || "").trim();

  const ownerName = isCommercial && propertyName
    ? propertyName
    : (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || (propertyName || "Unknown"));
  const email = String(normalizedLead.contact1_email1 || normalizedLead.email || "").trim();
  const phone = String(normalizedLead.contact1_phone1 || normalizedLead.phone || "").trim();

  const leadTags = Array.isArray(normalizedLead.tags) ? normalizedLead.tags : [];
  const defaultTags = ["ssrei lead"];

  if (normalizedLead.dnc_toggle === true) {
    defaultTags.push("seller-dnc");
  }
  if (normalizedLead.litigator === true) {
    defaultTags.push("Litigator");
  }

  const allTags = [...new Set([...defaultTags, ...leadTags])];

  console.log(`=== Tags ===`);
  console.log(`DNC Toggle: ${normalizedLead.dnc_toggle}`);
  console.log(`Litigator: ${normalizedLead.litigator}`);
  console.log(`Tags from database: ${JSON.stringify(leadTags)}`);
  console.log(`Final tags to send to GHL: ${JSON.stringify(allTags)}`);

  if (normalizedLead.id && !normalizedLead.ssrei_web_app) {
    const appUrl = Deno.env.get("SUPABASE_URL") || "";
    const baseUrl = appUrl.replace(/\.supabase\.co.*/, ".vercel.app");
    normalizedLead.ssrei_web_app = `${baseUrl}#contact/${normalizedLead.id}`;
    console.log(`Generated SSREI Web App URL: ${normalizedLead.ssrei_web_app}`);
  }

  const contactCustomFields = buildCustomFieldsPayload(normalizedLead, fieldIdMap.contact);
  const opportunityCustomFields = buildCustomFieldsPayload(normalizedLead, fieldIdMap.opportunity);

  const contactPayload: Record<string, unknown> = {
    firstName,
    lastName,
    locationId: settings.ghl_location_id,
    address1: normalizedLead.mailing_address || normalizedLead.property_address,
    city: normalizedLead.city,
    state: normalizedLead.state,
    postalCode: normalizedLead.zip,
    tags: allTags,
    customFields: contactCustomFields,
  };
  if (email) contactPayload.email = email;
  if (phone) contactPayload.phone = phone;

  const existingContactId = await findExistingContact(settings, email, phone);

  let contactId: string;

  if (existingContactId) {
    const existingContactRes = await fetch(`${GHL_BASE}/contacts/${existingContactId}`, {
      headers: ghlHeaders(settings.ghl_api_key),
    });

    let mergedTags = allTags;
    if (existingContactRes.ok) {
      const existingContactData = await existingContactRes.json();
      const existingTags = (existingContactData.contact?.tags || []) as string[];
      mergedTags = [...new Set([...existingTags, ...allTags])];
    }

    const updatePayload = { ...contactPayload, tags: mergedTags } as any;
    delete updatePayload.locationId;

    const updateRes = await fetch(`${GHL_BASE}/contacts/${existingContactId}`, {
      method: "PUT",
      headers: ghlHeaders(settings.ghl_api_key),
      body: JSON.stringify(updatePayload),
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

      try {
        const errorData = JSON.parse(errText);
        if (errorData.statusCode === 400 && errorData.meta?.contactId) {
          console.log(`Contact already exists, using existing ID: ${errorData.meta.contactId}`);
          contactId = errorData.meta.contactId;

          const updatePayload = { ...contactPayload };
          delete updatePayload.locationId;

          const updateRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
            method: "PUT",
            headers: ghlHeaders(settings.ghl_api_key),
            body: JSON.stringify(updatePayload),
          });
          if (!updateRes.ok) {
            const updateErrText = await updateRes.text();
            throw new Error(`GHL update contact failed (${updateRes.status}): ${updateErrText}`);
          }
        } else {
          throw new Error(`GHL create contact failed (${contactRes.status}): ${errText}`);
        }
      } catch (parseError) {
        throw new Error(`GHL create contact failed (${contactRes.status}): ${errText}`);
      }
    } else {
      const contactData = await contactRes.json();
      contactId = contactData.contact?.id || "";
      if (!contactId) throw new Error("Failed to create GHL contact: no ID returned");
    }
  }

  let opportunityId = String(normalizedLead.ghl_opportunity_id || "").trim();

  if (opportunityId) {
    const updateOppPayload = {
      pipelineStageId: stageId,
      name: `${ownerName} - ${normalizedLead.property_address || ""}`,
      status: "open",
      customFields: opportunityCustomFields,
    };

    const updateOppRes = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
      method: "PUT",
      headers: ghlHeaders(settings.ghl_api_key),
      body: JSON.stringify(updateOppPayload),
    });

    if (!updateOppRes.ok) {
      const errText = await updateOppRes.text();
      console.error(`Failed to update existing opportunity: ${errText}`);
      opportunityId = "";
    } else {
      console.log(`Updated existing opportunity: ${opportunityId}`);
    }
  }

  if (!opportunityId) {
    const oppPayload = {
      pipelineId: settings.ghl_pipeline_id,
      locationId: settings.ghl_location_id,
      name: `${ownerName} - ${normalizedLead.property_address || ""}`,
      pipelineStageId: stageId,
      contactId,
      status: "open",
      customFields: opportunityCustomFields,
    };

    const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
      method: "POST",
      headers: ghlHeaders(settings.ghl_api_key),
      body: JSON.stringify(oppPayload),
    });

    if (!oppRes.ok) {
      const errText = await oppRes.text();
      try {
        const errorData = JSON.parse(errText);
        if (errorData.statusCode === 400 && errorData.message?.includes("duplicate opportunity")) {
          const searchRes = await fetch(
            `${GHL_BASE}/opportunities/search?location_id=${settings.ghl_location_id}&pipeline_id=${settings.ghl_pipeline_id}&contact_id=${contactId}`,
            { headers: ghlHeaders(settings.ghl_api_key) }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const opportunities = searchData.opportunities || [];
            if (opportunities.length > 0) {
              opportunityId = opportunities[0].id;
              console.log(`Found existing opportunity: ${opportunityId}`);

              const updateOppPayload = {
                pipelineStageId: stageId,
                name: `${ownerName} - ${normalizedLead.property_address || ""}`,
                status: "open",
                customFields: opportunityCustomFields,
              };

              const updateOppRes = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
                method: "PUT",
                headers: ghlHeaders(settings.ghl_api_key),
                body: JSON.stringify(updateOppPayload),
              });

              if (!updateOppRes.ok) {
                const updateErrText = await updateOppRes.text();
                throw new Error(`GHL update opportunity failed (${updateOppRes.status}): ${updateErrText}`);
              }
            } else {
              throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
            }
          } else {
            throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
          }
        } else {
          throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
        }
      } catch (parseError) {
        throw new Error(`GHL create opportunity failed (${oppRes.status}): ${errText}`);
      }
    } else {
      const oppData = await oppRes.json();
      opportunityId = oppData.opportunity?.id || "";
    }
  }

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

async function handleGetPipelineStages(
  supabase: ReturnType<typeof createClient>,
  providedSettings?: Partial<GHLSettings>
) {
  let settings: GHLSettings;
  if (providedSettings?.ghl_api_key && providedSettings?.ghl_location_id) {
    settings = {
      ghl_api_key: providedSettings.ghl_api_key,
      ghl_location_id: providedSettings.ghl_location_id,
      ghl_pipeline_id: providedSettings.ghl_pipeline_id || "",
    };
    console.log("Using provided settings for pipeline stages lookup");
  } else {
    settings = await getSettings(supabase);
  }

  if (!settings.ghl_api_key) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  if (!settings.ghl_location_id) {
    throw new Error("Location ID is missing. Please configure it in Settings.");
  }

  const apiKeyPreview = settings.ghl_api_key.substring(0, 10) + "...";
  console.log(`Testing GHL connection with API key: ${apiKeyPreview}`);
  console.log(`Location ID: ${settings.ghl_location_id}`);

  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${settings.ghl_location_id}`,
    { headers: ghlHeaders(settings.ghl_api_key) }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`GHL API Error (${res.status}):`, text);

    if (res.status === 401) {
      throw new Error(`Authentication failed. Please verify your API key is a valid Private Integration token. Status: ${res.status}, Response: ${text}`);
    }

    throw new Error(`GHL fetch pipelines failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const pipelines: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string; position?: number }>;
  }> = data.pipelines || [];

  if (!settings.ghl_pipeline_id) {
    const pipelineList = pipelines.map(p => `${p.name} (${p.id})`).join(", ");
    throw new Error(`Pipeline ID not configured. Available pipelines: ${pipelineList}`);
  }

  const pipeline = pipelines.find((p) => p.id === settings.ghl_pipeline_id);
  if (!pipeline) {
    const pipelineList = pipelines.map(p => `${p.name} (${p.id})`).join(", ");
    throw new Error(`Pipeline ${settings.ghl_pipeline_id} not found. Available: ${pipelineList}`);
  }

  const stages = pipeline.stages.map((s, idx) => ({
    id: s.id,
    name: s.name,
    position: s.position ?? idx,
  }));

  return { stages, pipelineId: pipeline.id, pipelineName: pipeline.name };
}

async function handleGetOpportunities(
  supabase: ReturnType<typeof createClient>,
  pipelineId: string
) {
  const settings = await getSettings(supabase);

  // Attempt 1: Specific pipeline search using standard list endpoint
  let url = `${GHL_BASE}/opportunities/search?location_id=${settings.ghl_location_id}&pipeline_id=${pipelineId}&status=all&limit=100`;
  console.log(`GHL Fetch URL (Specific): ${url}`);
  let res = await fetch(url, { headers: ghlHeaders(settings.ghl_api_key) });

  let rawOpps = [];
  let debugLogs = [];

  if (res.ok) {
    const data = await res.json();
    rawOpps = data.opportunities || [];
    debugLogs.push(`Specific search found ${rawOpps.length} opportunities`);
  } else {
    const text = await res.text();
    debugLogs.push(`Specific search failed (${res.status}): ${text}`);
  }

  // Attempt 2: Broad location search if no results found
  if (rawOpps.length === 0) {
    url = `${GHL_BASE}/opportunities/search?location_id=${settings.ghl_location_id}&status=all&limit=100`;
    debugLogs.push(`Broad fetch URL: ${url}`);
    res = await fetch(url, { headers: ghlHeaders(settings.ghl_api_key) });
    if (res.ok) {
      const data = await res.json();
      const allOpps = data.opportunities || [];
      debugLogs.push(`Broad search found ${allOpps.length} total opportunities for location`);

      // Manually filter by pipeline ID
      rawOpps = allOpps.filter((o: any) => {
        const oPid = o.pipelineId || o.pipeline_id;
        return oPid === pipelineId;
      });
      debugLogs.push(`Filtered broad search to ${rawOpps.length} matching pipeline ${pipelineId}`);
    } else {
      const text = await res.text();
      debugLogs.push(`Broad search failed (${res.status}): ${text}`);
    }
  }

  // Map fields with extreme caution
  const opportunities = rawOpps.map((o: any) => {
    const stageId = o.pipelineStageId || o.pipeline_stage_id || o.stageId || o.stage_id;
    let contactInfo = o.contact;
    if (!contactInfo && (o.contactId || o.contact_id)) {
      contactInfo = {
        id: o.contactId || o.contact_id,
        name: o.contactName || o.contact_name || "Unknown",
        email: o.contactEmail || o.contact_email,
        phone: o.contactPhone || o.contact_phone
      };
    }

    return {
      ...o,
      id: o.id,
      name: o.name || o.opportunityName || "No Name",
      pipelineId: o.pipelineId || o.pipeline_id || pipelineId,
      pipelineStageId: stageId,
      stageName: o.stageName || o.stage_name,
      status: o.status || "open",
      monetaryValue: o.monetaryValue ?? o.value ?? 0,
      contact: contactInfo
    };
  });

  return {
    opportunities,
    _proxy_version: "1.3",
    _debug: {
      pipelineId,
      logs: debugLogs,
      locationId: settings.ghl_location_id
    }
  };
}

async function handleUpdateOpportunityStage(
  supabase: ReturnType<typeof createClient>,
  opportunityId: string,
  stageId: string
) {
  const settings = await getSettings(supabase);
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders(settings.ghl_api_key),
    body: JSON.stringify({ pipelineStageId: stageId }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL update opportunity stage failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleGetContacts(
  supabase: ReturnType<typeof createClient>,
  query: string
) {
  const settings = await getSettings(supabase);
  const res = await fetch(
    `${GHL_BASE}/contacts/?locationId=${settings.ghl_location_id}&${query}`,
    { headers: ghlHeaders(settings.ghl_api_key) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL fetch contacts failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return { contacts: data.contacts || [] };
}

async function handleAddContactTag(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  tag: string
) {
  const settings = await getSettings(supabase);
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(settings.ghl_api_key),
    body: JSON.stringify({ tags: [tag] }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL add tag failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleRemoveContactTag(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  tag: string
) {
  const settings = await getSettings(supabase);
  const contactRes = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    headers: ghlHeaders(settings.ghl_api_key),
  });
  if (!contactRes.ok) {
    throw new Error(`Failed to fetch contact`);
  }
  const contactData = await contactRes.json();
  const currentTags = (contactData.contact?.tags || []) as string[];
  const newTags = currentTags.filter((t: string) => t !== tag);

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(settings.ghl_api_key),
    body: JSON.stringify({ tags: newTags }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL remove tag failed (${res.status}): ${errText}`);
  }
  return { success: true };
}

async function handleInviteUser(
  supabase: ReturnType<typeof createClient>,
  payload: { email: string; full_name: string; role: string; title: string }
) {
  const { email, full_name, role, title } = payload;
  if (!email || !full_name) throw new Error("Email and Full Name are required");

  console.log(`Inviting user: ${email} with role: ${role}`);

  // 1. Invite via Supabase Auth Admin
  const { data, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role, title },
  });

  if (inviteErr) {
    console.error("Invite error:", inviteErr);
    // If user already exists, we might want to just update the profile
    if (inviteErr.message.includes("already has been invited") || inviteErr.message.includes("already registered")) {
      // Continue to profile upsert
    } else {
      throw inviteErr;
    }
  }

  // 2. Upsert profile
  const userId = data?.user?.id;
  if (!userId) {
    // If we didn't get a user ID but it's not a fatal error, try to find user by email
    const { data: userData } = await supabase.from('user_profiles').select('id').eq('email', email).single();
    if (!userData?.id) throw new Error("User invited but could not retrieve ID for profile creation");

    await supabase.from('user_profiles').update({
      full_name,
      display_name: full_name,
      role: role || 'agent',
      title,
      is_active: true
    }).eq('id', userData.id);
  } else {
    await supabase.from('user_profiles').upsert({
      id: userId,
      email,
      full_name,
      display_name: full_name,
      role: role || 'agent',
      title,
      is_active: true
    }, { onConflict: 'id' });
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
      const result = await handleSubmitLead(supabase, body.contact || body.lead);
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

    if (req.method === "GET" && action === "get-pipeline-stages") {
      const ghl_api_key = url.searchParams.get("api_key");
      const ghl_location_id = url.searchParams.get("location_id");
      const ghl_pipeline_id = url.searchParams.get("pipeline_id");

      const provided = ghl_api_key && ghl_location_id ? { ghl_api_key, ghl_location_id, ghl_pipeline_id } : undefined;

      const result = await handleGetPipelineStages(supabase, provided as any);
      return jsonResponse(result);
    }

    if (req.method === "GET" && action === "get-opportunities") {
      const pipelineId = url.searchParams.get("pipelineId");
      if (!pipelineId) return jsonResponse({ error: "pipelineId is required" }, 400);
      const result = await handleGetOpportunities(supabase, pipelineId);
      return jsonResponse(result);
    }

    if (req.method === "PUT" && action === "update-opportunity-stage") {
      const body = await req.json();
      const { opportunityId, stageId } = body;
      if (!opportunityId || !stageId) {
        return jsonResponse({ error: "opportunityId and stageId are required" }, 400);
      }
      const result = await handleUpdateOpportunityStage(supabase, opportunityId, stageId);
      return jsonResponse(result);
    }

    if (req.method === "GET" && action === "get-contacts") {
      const query = url.searchParams.toString().replace(/action=[^&]*&?/, '');
      const result = await handleGetContacts(supabase, query);
      return jsonResponse(result);
    }

    if (req.method === "POST" && action === "add-contact-tag") {
      const body = await req.json();
      const { contactId, tag } = body;
      if (!contactId || !tag) {
        return jsonResponse({ error: "contactId and tag are required" }, 400);
      }
      const result = await handleAddContactTag(supabase, contactId, tag);
      return jsonResponse(result);
    }

    if (req.method === "POST" && action === "remove-contact-tag") {
      const body = await req.json();
      const { contactId, tag } = body;
      if (!contactId || !tag) {
        return jsonResponse({ error: "contactId and tag are required" }, 400);
      }
      const result = await handleRemoveContactTag(supabase, contactId, tag);
      return jsonResponse(result);
    }

    if (req.method === "POST" && action === "sync-dnc") {
      const body = await req.json();
      const { contact, dncEnabled } = body;
      if (!contact?.ghl_contact_id) {
        return jsonResponse({ error: "Contact with GHL ID is required" }, 400);
      }

      const settings = await getSettings(supabase);
      const ghlContactId = contact.ghl_contact_id;

      const contactRes = await fetch(`${GHL_BASE}/contacts/${ghlContactId}`, {
        headers: ghlHeaders(settings.ghl_api_key),
      });

      if (!contactRes.ok) {
        throw new Error("Failed to fetch contact from GHL");
      }

      const contactData = await contactRes.json();
      const currentTags = (contactData.contact?.tags || []) as string[];

      let newTags = currentTags.filter((t: string) => t !== "seller-dnc");
      if (dncEnabled) {
        newTags.push("seller-dnc");
      }

      const updateRes = await fetch(`${GHL_BASE}/contacts/${ghlContactId}`, {
        method: "PUT",
        headers: ghlHeaders(settings.ghl_api_key),
        body: JSON.stringify({ tags: newTags, dnd: dncEnabled }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`GHL DNC sync failed (${updateRes.status}): ${errText}`);
      }

      return jsonResponse({ success: true });
    }

    if (req.method === "POST" && action === "invite-user") {
      const body = await req.json();
      const result = await handleInviteUser(supabase, body);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
