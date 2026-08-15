import 'server-only';
import { headers } from 'next/headers';

/**
 * Captures "from where" for the audit trail (requirement: audit trail
 * for who/when/where). `headers()` reflects the incoming request in
 * Server Actions and Route Handlers alike. Behind a proxy/load balancer,
 * the real client IP is in `x-forwarded-for` (first entry); Vercel also
 * sets `x-real-ip`. Falls back to null if neither is present (e.g. local
 * dev without a proxy).
 */
export async function getRequestContext() {
  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (headerList.get('x-real-ip') ?? null);
  const userAgent = headerList.get('user-agent') ?? null;

  return { ipAddress, userAgent };
}
