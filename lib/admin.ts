import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/** The one account that can approve admin requests. */
export const SUPERADMIN_EMAIL = 'tdong1919@gmail.com'

export type AdminLevel = 'superadmin' | 'admin' | null

export interface AdminContext {
  userId: string
  email: string | null
  level: AdminLevel
}

/**
 * Resolve the current user's admin level:
 *  - 'superadmin' → the fixed SUPERADMIN_EMAIL (can approve others)
 *  - 'admin'      → has an approved admin_accounts row
 *  - null         → not an admin
 * Returns null entirely if not logged in.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (user.email === SUPERADMIN_EMAIL) {
    return { userId: user.id, email: user.email, level: 'superadmin' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { data } = await svc
    .from('admin_accounts')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: user.email ?? null,
    level: data?.status === 'approved' ? 'admin' : null,
  }
}
