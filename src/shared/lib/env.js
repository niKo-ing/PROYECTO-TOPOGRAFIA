// Variables de entorno (Vercel -> Project Settings -> Environment Variables):
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET, GEMINI_API_KEY, RESEND_API_KEY, EMAIL_FROM
export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value ?? fallback;
}

export function isProd() {
  return process.env.NODE_ENV === "production";
}

export const ENV_NOTES = `
Variables de entorno requeridas (Vercel Project Settings -> Environment Variables):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SESSION_SECRET
- GEMINI_API_KEY
- RESEND_API_KEY
- EMAIL_FROM
`;
