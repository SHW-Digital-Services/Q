// supabase/functions/zoho-crm-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => toText(item)).filter(Boolean)
    : [];
}

function splitDisplayName(meta: Record<string, unknown>): { firstName: string; lastName: string } {
  const explicitFirstName = toText(meta.first_name);
  const explicitLastName = toText(meta.last_name);
  if (explicitFirstName || explicitLastName) {
    return {
      firstName: explicitFirstName,
      lastName: explicitLastName || "Unknown"
    };
  }

  const nameParts = toText(meta.name).split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return { firstName: "", lastName: "Unknown" };
  if (nameParts.length === 1) return { firstName: "", lastName: nameParts[0] };

  return {
    firstName: nameParts.slice(0, -1).join(" "),
    lastName: nameParts[nameParts.length - 1]
  };
}

function buildProfileDescription(meta: Record<string, unknown>): string {
  const lines = [
    ["Preferred name", toText(meta.name)],
    ["Pronouns", toText(meta.q_pronouns)],
    ["Location/region", toText(meta.q_location_region)],
    ["Life stage", toText(meta.q_life_stage)],
    ["Privacy level", toText(meta.q_privacy_level)],
    ["AI memory enabled", typeof meta.q_opt_in_memory === "boolean" ? String(meta.q_opt_in_memory) : ""],
    ["Identity notes", toList(meta.q_identity_tags).join(", ")],
    ["Saved goals", toList(meta.q_saved_goals).join(", ")],
    ["Profile updated", toText(meta.q_profile_updated_at)]
  ];

  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
    .slice(0, 32000);
}

async function findWritableLeadNameField(accessToken: string): Promise<string | null> {
  const fieldsResponse = await fetch("https://www.zohoapis.eu/crm/v6/settings/fields?module=Leads", {
    method: "GET",
    headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
  });

  if (!fieldsResponse.ok) return null;

  const fieldsResult = await fieldsResponse.json();
  const fields = Array.isArray(fieldsResult.fields) ? fieldsResult.fields : [];
  const candidate = fields.find((field: Record<string, unknown>) => {
    const apiName = toText(field.api_name);
    const fieldLabel = toText(field.field_label);
    const displayLabel = toText(field.display_label);
    const readOnly = field.read_only === true || field.field_read_only === true;

    return (
      !readOnly &&
      apiName !== "Full_Name" &&
      apiName !== "First_Name" &&
      apiName !== "Last_Name" &&
      (apiName === "Lead_Name" || fieldLabel === "Lead Name" || displayLabel === "Lead Name")
    );
  });

  return candidate ? toText(candidate.api_name) : null;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.type === 'DELETE' ? payload.old_record : payload.record; 
    const oldRecord = payload.old_record;

    if (!record || !record.email) {
      return new Response(JSON.stringify({ success: true, message: "Ignored: No valid email." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payload.type === 'UPDATE') {
      // Prevent race conditions by ignoring background updates that happen immediately upon creation
      const createdAt = new Date(record.created_at).getTime();
      const updatedAt = new Date(record.updated_at || new Date().toISOString()).getTime();
      
      if (updatedAt - createdAt < 5000) {
        return new Response(JSON.stringify({ success: true, message: "Ignored: Immediate update after insert (race condition prevention)." }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const emailChanged = record.email !== oldRecord?.email;
      const phoneChanged = record.phone !== oldRecord?.phone;
      const metaStr = JSON.stringify(record.raw_user_meta_data || {});
      const oldMetaStr = JSON.stringify(oldRecord?.raw_user_meta_data || {});
      
      if (!emailChanged && !phoneChanged && metaStr === oldMetaStr) {
        return new Response(JSON.stringify({ success: true, message: "Ignored: Relevant data unmodified." }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const clientId = Deno.env.get("ZOHO_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
    const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");

    const accountsUrl = "https://accounts.zoho.eu"; 
    const baseApiUrl = "https://www.zohoapis.eu/crm/v6/Leads";

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing Zoho credentials in environment variables.");
    }

    const tokenResponse = await fetch(
      `${accountsUrl}/oauth/v2/token?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`,
      { method: "POST" }
    );
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`Zoho Token Error: ${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    if (payload.type === 'DELETE') {
      const searchResponse = await fetch(`${baseApiUrl}/search?email=${record.email}`, {
        method: "GET",
        headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
      });
      
      if (searchResponse.status === 204) {
        return new Response(JSON.stringify({ success: true, message: "Delete ignored: Lead not found in Zoho." }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const searchResult = await searchResponse.json();
      const leadId = searchResult.data?.[0]?.id;

      if (!leadId) {
         return new Response(JSON.stringify({ success: true, message: "Delete failed: ID extraction error." }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const deleteResponse = await fetch(`${baseApiUrl}?ids=${leadId}`, {
        method: "DELETE",
        headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
      });

      const deleteResult = await deleteResponse.json();
      
      return new Response(JSON.stringify({ success: true, result: deleteResult }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const meta = record.raw_user_meta_data || {};
    const { firstName, lastName } = splitDisplayName(meta);
    const preferredName = toText(meta.name);
    const profileDescription = buildProfileDescription(meta);
    const leadNameField = preferredName ? await findWritableLeadNameField(accessToken) : null;
    const leadRecord: Record<string, unknown> = {
      Last_Name: lastName,
      First_Name: firstName,
      Email: record.email || "",
      Phone: meta.phone || record.phone || "",
      Lead_Source: "From Q website",
      Description: profileDescription
    };

    if (leadNameField) {
      leadRecord[leadNameField] = preferredName;
    }

    const zohoLeadData = {
      data: [leadRecord],
      duplicate_check_fields: ["Email"]
    };

    const zohoResponse = await fetch(`${baseApiUrl}/upsert`, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(zohoLeadData)
    });

    const zohoResult = await zohoResponse.json();

    return new Response(JSON.stringify({ success: true, result: zohoResult }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
})
