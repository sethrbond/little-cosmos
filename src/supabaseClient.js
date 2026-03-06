import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yvugwhbjfshycxoyrluk.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dWd3aGJqZnNoeWN4b3lybHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc3MDYsImV4cCI6MjA4Nzg4MzcwNn0.8bDtEyYmPf6h0Zkqr9josqP3xrJFuZLtVxgNMAFkEnE'

export const supabase = createClient(supabaseUrl, supabaseKey)
