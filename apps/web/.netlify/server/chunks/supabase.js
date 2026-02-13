import { createClient } from "@supabase/supabase-js";
const PUBLIC_SUPABASE_URL = "https://bgjeaqpvsgfsfacnsilu.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_SDttAKs-cBM9V4uDK9XRuw_2_5-UZoR";
let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}
export {
  getSupabase as g
};
