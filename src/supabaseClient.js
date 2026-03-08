import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://neduoxnmlotrygulngrv.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZHVveG5tbG90cnlndWxuZ3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjI3NjgsImV4cCI6MjA4ODUzODc2OH0.KrJtuXbBj-5rmcpByA1leTAjuuD13dw4S-QYtWirpcA'

export const supabase = createClient(supabaseUrl, supabaseKey)
