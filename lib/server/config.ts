// Import this module only from server routes. No NEXT_PUBLIC_ / VITE_ secrets.
export type ServerEnvironment = {
  [key: string]: string | undefined;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  STATREPORT_SIGNING_SECRET?: string;
  AI_TIMEOUT_MS?: string;
  AI_PROVIDER?: string;
};
export function getConfig(env: ServerEnvironment = process.env) {
  return {
    apiKey: env.OPENAI_API_KEY?.trim() || '',
    model: env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
    signingSecret: env.STATREPORT_SIGNING_SECRET || '',
    provider: env.AI_PROVIDER || 'openai',
    timeoutMs: Math.max(
      1000,
      Math.min(Number(env.AI_TIMEOUT_MS) || 90000, 120000),
    ),
  };
}
export function publicConfig(env: ServerEnvironment = process.env) {
  const c = getConfig(env),
    configured =
      !!c.apiKey && c.signingSecret.length >= 32 && c.provider === 'openai';
  return {
    configured,
    provider: 'OpenAI',
    message: configured
      ? 'Server credentials are configured. Model availability is checked on submission.'
      : 'Configure OPENAI_API_KEY and STATREPORT_SIGNING_SECRET on the server. You can explore the fixed sample report while setup is incomplete.',
  };
}
