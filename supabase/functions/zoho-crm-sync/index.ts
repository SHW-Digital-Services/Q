// supabase/functions/zoho-crm-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getEnvUrl(name: string, fallback: string): string {
  return (Deno.env.get(name) || fallback).replace(/\/+$/, "");
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
    ["Source", "Q Intelligence account"],
    ["Privacy level", toText(meta.q_privacy_level)],
    ["CRM sync consent", typeof meta.q_crm_sync_consent === "boolean" ? String(meta.q_crm_sync_consent) : ""],
    ["Profile updated", toText(meta.q_profile_updated_at)]
  ];

  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
    .slice(0, 32000);
}

async function deleteBiginContactByEmail(baseApiUrl: string, accessToken: string, email: string) {
  const searchResponse = await fetch(`${baseApiUrl}/search?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
  });

  if (searchResponse.status === 204) {
    return { deleted: false, message: "Contact not found in Zoho Bigin." };
  }

  const searchResult = await searchResponse.json();
  const contactId = searchResult.data?.[0]?.id;

  if (!contactId) {
    return { deleted: false, message: "Contact ID was not available in Zoho Bigin search result.", result: searchResult };
  }

  const deleteResponse = await fetch(`${baseApiUrl}?ids=${contactId}`, {
    method: "DELETE",
    headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
  });

  const deleteResult = await deleteResponse.json();
  return { deleted: deleteResponse.ok, result: deleteResult };
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.type === 'DELETE' ? payload.old_record : payload.record; 
    const oldRecord = payload.old_record;
    const webhookSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET");

    if (webhookSecret && req.headers.get("x-q-zoho-secret") !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook request." }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      });
    }

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

    const accountsUrl = getEnvUrl("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.eu");
    const apiBaseUrl = getEnvUrl("ZOHO_API_BASE_URL", "https://www.zohoapis.eu/bigin/v2");
    const baseApiUrl = `${apiBaseUrl}/Contacts`;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing Zoho credentials in environment variables.");
    }

    const tokenResponse = await fetch(
      `${accountsUrl}/oauth/v2/token?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`,
      { method: "POST" }
    );
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok || tokenData.error) {
      throw new Error(`Zoho Token Error: ${tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    if (payload.type === 'DELETE') {
      const deleteResult = await deleteBiginContactByEmail(baseApiUrl, accessToken, record.email);
      
      return new Response(JSON.stringify({ success: true, result: deleteResult }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const meta = record.raw_user_meta_data || {};

    if (meta.q_crm_sync_consent === false) {
      const deleteResult = await deleteBiginContactByEmail(baseApiUrl, accessToken, record.email);
      return new Response(JSON.stringify({ success: true, message: "CRM sync consent is disabled. Matching Zoho Bigin Contact delete attempted.", result: deleteResult }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { firstName, lastName } = splitDisplayName(meta);
    const profileDescription = buildProfileDescription(meta);
    const contactRecord: Record<string, unknown> = {
      Last_Name: lastName,
      First_Name: firstName,
      Email: record.email || "",
      Mobile: meta.phone || record.phone || "",
      Description: profileDescription,
      Tag: [{ name: "Q website" }]
    };

    const zohoContactData = {
      data: [contactRecord],
      duplicate_check_fields: ["Email"]
    };

    const zohoResponse = await fetch(`${baseApiUrl}/upsert`, {
      method: "POST",
      headers: {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(zohoContactData)
    });

    const zohoResult = await zohoResponse.json();

    if (!zohoResponse.ok || zohoResult.data?.[0]?.status === "error") {
      return new Response(JSON.stringify({ error: "Zoho Bigin Contact upsert failed.", result: zohoResult }), {
        headers: { "Content-Type": "application/json" },
        status: 502,
      });
    }

    return new Response(JSON.stringify({ success: true, result: zohoResult }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Zoho Bigin sync error.";
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
})
