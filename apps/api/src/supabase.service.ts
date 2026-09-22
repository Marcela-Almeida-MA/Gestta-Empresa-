import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient | null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    this.client = url && serviceRoleKey
      ? createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  }

  isConfigured() {
    return this.client !== null;
  }

  getClient() {
    if (!this.client) {
      throw new Error('Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    }

    return this.client;
  }
}
