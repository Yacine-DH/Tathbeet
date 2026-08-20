import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { migrate } from './storage'
import type { AppState } from './types'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Sync is entirely optional: with no keys configured the app behaves exactly as
 * it did before — local-only, no account, no network.
 */
export const cloudConfigured = Boolean(URL && ANON_KEY)

const client: SupabaseClient | null = cloudConfigured
  ? createClient(URL!, ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

const TABLE = 'states'

export interface CloudUser {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}

function toUser(session: Session | null): CloudUser | null {
  if (!session?.user) return null
  const meta = session.user.user_metadata ?? {}
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatar: (meta.avatar_url as string) ?? null,
  }
}

export async function currentUser(): Promise<CloudUser | null> {
  if (!client) return null
  const { data } = await client.auth.getSession()
  return toUser(data.session)
}

/** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe. */
export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  if (!client) return () => {}
  const { data } = client.auth.onAuthStateChange((_event, session) => cb(toUser(session)))
  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle(): Promise<void> {
  if (!client) throw new Error('Sync is not configured')
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    // Come back to the same page — works on both the phone and localhost.
    options: { redirectTo: window.location.href.split('#')[0] },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await client?.auth.signOut()
}

/** The account's stored state, or null when this is the first device. */
export async function pullState(): Promise<AppState | null> {
  if (!client) return null
  const { data, error } = await client.from(TABLE).select('state').maybeSingle()
  if (error) throw error
  if (!data?.state) return null
  // Run it through the same migration path as a local save.
  return migrate(data.state as Partial<AppState>)
}

export async function pushState(userId: string, state: AppState): Promise<void> {
  if (!client) return
  const { error } = await client
    .from(TABLE)
    .upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}
