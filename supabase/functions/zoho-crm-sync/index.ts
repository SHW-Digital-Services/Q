// supabase/functions/zoho-crm-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    const zohoLeadData = {
      data: [
        {
          Last_Name: meta.last_name || "Unknown",
          First_Name: meta.first_name || "",
          Email: record.email || "",
          Phone: meta.phone || record.phone || "",
          Lead_Source: "From Q website"
        }
      ],
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