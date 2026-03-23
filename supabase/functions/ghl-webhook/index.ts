import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Parse payload from GHL
    const payload = await req.json();
    console.log("GHL Webhook Payload Received:", JSON.stringify(payload, null, 2));

    const ghlContactId = payload.contact_id || payload.id;
    if (!ghlContactId) {
      throw new Error("No contact_id or id found in payload");
    }

    // 2. Map GHL fields to SSREI Contact columns
    // payload.firstName, payload.lastName, payload.email, payload.phone, etc.
    const contactData: Record<string, any> = {
      ghl_contact_id: ghlContactId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      property_address: payload.address1,
      property_city: payload.city,
      property_state: payload.state,
      property_zip: payload.postalCode,
      contact1_email1: payload.email,
      contact1_phone1: payload.phone,
      source: "Deal Automator",
      source_detail: "GHL Webhook",
      updated_at: new Date().toISOString(),
    };

    // Handle Custom Fields if present
    if (payload.customFields) {
      const customFieldMap: Record<string, any> = {};
      
      // Usually customFields is an object where keys are IDs or field keys
      // If it's an array, we flatten it
      if (Array.isArray(payload.customFields)) {
        payload.customFields.forEach((cf: any) => {
          if (cf.id) customFieldMap[cf.id] = cf.value;
          if (cf.key) customFieldMap[cf.key] = cf.value;
        });
      } else {
        Object.assign(customFieldMap, payload.customFields);
      }

      // Mapping table for custom fields (GHL key -> SSREI DB Column)
      const mappingTable: Record<string, string> = {
        "deal_automator_url": "deal_automator_url",
        "avm": "avm",
        "ltv": "ltv",
        "estimated_equity": "estimated_equity",
        "retail_value_estimate": "retail_value_estimate",
        "assessed_value": "assessed_value",
        "sqft": "sqft",
        "units": "units",
        "year_built": "year_built",
        "lot_size": "lot_size",
        "parcel_number": "parcel_number",
        "last_sale_date": "last_sale_date",
        "last_sale_price": "last_sale_price"
        // Add more as needed based on GHL custom field keys
      };

      for (const [ghlKey, dbCol] of Object.entries(mappingTable)) {
        if (customFieldMap[ghlKey] !== undefined) {
          contactData[dbCol] = customFieldMap[ghlKey];
        }
      }
    }

    // 3. Upsert into 'contacts' table
    // We match by ghl_contact_id.
    const { data: upsertData, error: upsertError } = await supabase
      .from("contacts")
      .upsert(contactData, { 
        onConflict: "ghl_contact_id",
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Supabase Upsert Error:", upsertError);
      throw upsertError;
    }

    // 4. Log Activity
    await supabase.from("contact_activity_logs").insert({
      contact_id: upsertData.id,
      action: "Webhook Update",
      action_detail: `Updated via GoHighLevel inbound webhook. Source set to Deal Automator.`,
      action_by: "System",
    });

    return new Response(JSON.stringify({ success: true, id: upsertData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Webhook processing failed:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
