import { BaseDatabase } from './base';
import { GrindSession } from './types';

export class GrindSessionsService extends BaseDatabase {
  async startGrindSession(userId: number, locationId: number, notes?: string): Promise<GrindSession> {
    try {
      const sessionData = {
        user_id: userId,
        location_id: locationId,
        start_time: new Date().toISOString(),
        notes: notes || null
      };

      const { data, error } = await this.supabase
        .from('grind_sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;
      return data as GrindSession;
    } catch (error) {
      console.error('Error starting grind session:', error);
      throw error;
    }
  }

  async endGrindSession(sessionId: number): Promise<GrindSession> {
    try {
      const endTime = new Date().toISOString();
      
      // First get the session to calculate duration
      const { data: session, error: fetchError } = await this.supabase
        .from('grind_sessions')
        .select('start_time')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      const startTime = new Date(session.start_time);
      const endTimeDate = new Date(endTime);
      const durationMinutes = Math.round((endTimeDate.getTime() - startTime.getTime()) / (1000 * 60));

      // Calculate total session value
      const { data: lootData, error: lootError } = await this.supabase
        .from('session_loot')
        .select('estimated_value')
        .eq('session_id', sessionId);

      if (lootError) throw lootError;

      const totalValue = lootData.reduce((sum, loot) => sum + (loot.estimated_value || 0), 0);

      // Update the session
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .update({
          end_time: endTime,
          duration_minutes: durationMinutes,
          total_value: totalValue
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as GrindSession;
    } catch (error) {
      console.error('Error ending grind session:', error);
      throw error;
    }
  }

  async getUserGrindSessions(userId: number, limit: number = 50): Promise<GrindSession[]> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select(`
          *,
          locations (name, region)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as GrindSession[];
    } catch (error) {
      console.error('Error fetching user grind sessions:', error);
      throw error;
    }
  }

  async getActiveGrindSession(userId: number): Promise<GrindSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select(`
          *,
          locations (name, region)
        `)
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as GrindSession | null;
    } catch (error) {
      console.error('Error fetching active grind session:', error);
      throw error;
    }
  }

  async getGrindSessionById(sessionId: number): Promise<GrindSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select(`
          *,
          locations (name, region),
          users (username)
        `)
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as GrindSession | null;
    } catch (error) {
      console.error('Error fetching grind session:', error);
      throw error;
    }
  }

  async updateGrindSession(sessionId: number, updates: Partial<Omit<GrindSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<GrindSession> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as GrindSession;
    } catch (error) {
      console.error('Error updating grind session:', error);
      throw error;
    }
  }

  async deleteGrindSession(sessionId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('grind_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting grind session:', error);
      throw error;
    }
  }

  async getGrindSessionStats(userId: number, days: number = 30): Promise<{
    totalSessions: number;
    totalDuration: number;
    totalValue: number;
    averageSessionDuration: number;
    averageSessionValue: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select('duration_minutes, total_value')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .not('end_time', 'is', null); // Only completed sessions

      if (error) throw error;

      const totalSessions = data.length;
      const totalDuration = data.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
      const totalValue = data.reduce((sum, session) => sum + (session.total_value || 0), 0);
      
      return {
        totalSessions,
        totalDuration,
        totalValue,
        averageSessionDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
        averageSessionValue: totalSessions > 0 ? Math.round(totalValue / totalSessions) : 0,
      };
    } catch (error) {
      console.error('Error fetching grind session stats:', error);
      throw error;
    }
  }
}

export const grindSessionsService = new GrindSessionsService();
