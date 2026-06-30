// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js' // Note: corrected package name to @supabase/supabase-js

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing!")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Crucial: Switches from localStorage to sessionStorage 
    // so data clears when the browser tab/window is closed.
    storage: window.sessionStorage, 
    autoRefreshToken: true,
    persistSession: true // Keeps session alive during active tab reloads
  }
})