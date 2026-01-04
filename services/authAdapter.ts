import { supabase } from './supabase';

// Mock User Interface
export interface User {
  email: string;
  id: string;
}

// Local Storage Keys
const LOCAL_STORAGE_USER_KEY = 'slideremix_user';
const LOCAL_STORAGE_USERS_DB_KEY = 'slideremix_users_db';

// Helper to simulate DB delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authAdapter = {
  // Check if we are using real database
  isSupabaseEnabled: !!supabase,

  // Get current session/user
  async getCurrentUser(): Promise<User | null> {
    if (this.isSupabaseEnabled && supabase) {
      const { data } = await supabase.auth.getUser();
      return data.user ? { email: data.user.email!, id: data.user.id } : null;
    } else {
      // Local Storage Fallback
      const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    }
  },

  // Sign In
  async signIn(email: string, password: string): Promise<{ user?: User; error?: string }> {
    if (this.isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      // Handle the case where email confirmation is required but not yet done
      if (error) {
        if (error.message.includes('Email not confirmed')) {
           return { error: 'Please check your email to confirm your account first.' };
        }
        if (error.message.includes('Invalid login credentials')) {
           return { error: 'Invalid email or password. If you just signed up, please check your email.' };
        }
        return { error: error.message };
      }
      
      return { user: { email: data.user!.email!, id: data.user!.id } };
    } else {
      // Local Mock Logic
      await delay(800);
      
      // Default Demo Account
      if (email === 'demo@slideremix.com' && password === '123456') {
        const user = { email, id: 'demo-123' };
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
        return { user };
      }

      // Check "Registered" users in local storage
      const usersDb = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_DB_KEY) || '{}');
      if (usersDb[email] && usersDb[email] === password) {
         const user = { email, id: `local-${Date.now()}` };
         localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
         return { user };
      }

      return { error: 'Invalid login credentials' };
    }
  },

  // Sign Up
  async signUp(email: string, password: string): Promise<{ user?: User; error?: string; message?: string }> {
    if (this.isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      return { message: 'Confirmation email sent! Please check your inbox.' };
    } else {
      // Local Mock Logic
      await delay(800);
      
      const usersDb = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_DB_KEY) || '{}');
      if (usersDb[email]) {
        return { error: 'User already exists' };
      }
      
      usersDb[email] = password;
      localStorage.setItem(LOCAL_STORAGE_USERS_DB_KEY, JSON.stringify(usersDb));
      
      // Auto login after signup for local
      const user = { email, id: `local-${Date.now()}` };
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      
      return { user };
    }
  },

  // Sign Out
  async signOut() {
    if (this.isSupabaseEnabled && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  }
};
