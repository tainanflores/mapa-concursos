import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && chaveAnonima
  ? createClient(url, chaveAnonima, {
    auth: {
      detectSessionInUrl: false,
      persistSession: true,
    },
  })
  : null;

export const supabaseConfigurado = supabase !== null;
