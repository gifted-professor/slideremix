import { supabase } from './supabase';
import { SlideData, ElementSettings } from '../types';

export interface Project {
  id: string;
  title: string;
  thumbnail_url?: string;
  slide_data: SlideData;
  element_settings: Record<string, ElementSettings>;
  created_at: string;
}

export const dbService = {
  async saveProject(title: string, slideData: SlideData, elementSettings: Record<string, ElementSettings>, thumbnailUrl?: string) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title,
        slide_data: slideData,
        element_settings: elementSettings,
        thumbnail_url: thumbnailUrl
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  async getProjects() {
     if (!supabase) return [];
     
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return [];

     const { data, error } = await supabase
       .from('projects')
       .select('*')
       .order('created_at', { ascending: false });
       
     if (error) throw error;
     return data as Project[];
  },

  async deleteProject(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  }
};
