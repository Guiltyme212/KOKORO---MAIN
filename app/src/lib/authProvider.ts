import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export type AuthSession = {
  accessToken: string;
  email: string;
  userId: string;
};

export type AuthProvider = {
  restoreSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
};

function publicSession(session: Session | null): AuthSession | null {
  const email = session?.user.email?.trim().toLowerCase();
  if (!session || !email) return null;
  return {
    accessToken: session.access_token,
    email,
    userId: session.user.id,
  };
}

export class SupabaseEmailAuthProvider implements AuthProvider {
  private readonly client: SupabaseClient | null;

  constructor() {
    this.client = getSupabase();
  }

  get supabase(): SupabaseClient {
    if (!this.client) throw new Error('AUTH_NOT_CONFIGURED');
    return this.client;
  }

  async restoreSession(): Promise<AuthSession | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return publicSession(data.session);
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.restoreSession())?.accessToken ?? null;
  }

  fromSession(session: Session | null): AuthSession | null {
    return publicSession(session);
  }
}

export const webAuthProvider = new SupabaseEmailAuthProvider();
