import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// Initialize the single Supabase client for the React app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
