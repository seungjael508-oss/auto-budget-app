import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ResolveUserResult {
  userId?: string
  error?: Response
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function resolveRequestUserId(
  req: Request,
  supabase: SupabaseClient,
  serviceRoleKey: string,
  requestedUserId?: string,
): Promise<ResolveUserResult> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return { error: jsonResponse({ ok: false, error: 'Authorization 헤더 필수' }, 401) }
  }

  // Internal service-role calls may pass userId explicitly.
  if (token === serviceRoleKey) {
    if (!requestedUserId) {
      return { error: jsonResponse({ ok: false, error: 'service role 호출은 userId 필수' }, 400) }
    }
    return { userId: requestedUserId }
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return { error: jsonResponse({ ok: false, error: '유효하지 않은 사용자 토큰' }, 401) }
  }

  if (requestedUserId && requestedUserId !== data.user.id) {
    return { error: jsonResponse({ ok: false, error: 'userId 불일치' }, 403) }
  }

  return { userId: data.user.id }
}
