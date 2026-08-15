import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * JSON API Route Handler. Deliberately uses explicit 401/403 JSON
 * responses instead of the redirect-based requireUser()/requireRole()
 * guards: Route Handlers are frequently called by client-side
 * fetch()/SWR, where an HTTP redirect to an HTML page is not a useful
 * response for a JSON consumer. This mirrors the pattern Next.js's own
 * docs use for Route Handlers (see app/api/route.ts example under
 * "Protecting Routes").
 *
 * Every authenticated role (ADMIN, MASTER, OPERATOR, VIEWER) may read
 * the dashboard summary (see permissions.js "monitoring.view").
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
