// Chiavi pubbliche di Supabase (Project Settings > API). La "anon key" è fatta per stare nel
// browser: la sicurezza sta nelle regole RLS di supabase/schema.sql. NON mettere qui la service_role.
export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''

// Accesso su invito: l'app si apre solo con login e non esiste la registrazione libera.
// Gli account li crea il proprietario da Supabase > Authentication > Users > Add user.
export const REQUIRE_LOGIN = true
export const ALLOW_SIGNUP = false
