// Single shared Supabase client for the whole app.
// Keys come from environment variables (see .env.example) so they are not
// hard-coded in the source. The publishable/anon key is safe to ship to the
// browser because Row Level Security in the database limits every user to
// their own rows.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and fill in your project URL and key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
