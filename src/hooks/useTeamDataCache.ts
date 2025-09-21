import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface CachedData {
  personalityData: any;
  teamDescription: string;
  teamStrengths: any[];
  recommendations: any[];
  analyticsData: any;
  timestamp: number;
  memberHash: string;
  sessionHash: string;
}

interface UseTeamDataCacheOptions {
  managerId: string;
  teamMembers: TeamMember[];
  cacheKey: string;
  ttl?: number; // Time to live in milliseconds (default 30 minutes)
}

export const useTeamDataCache = ({ 
  managerId, 
  teamMembers, 
  cacheKey,
  ttl = 30 * 60 * 1000 // 30 minutes default
}: UseTeamDataCacheOptions) => {
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Generate hash from team members to detect changes
  const generateMemberHash = useCallback((members: TeamMember[]): string => {
    const memberIds = members
      .map(m => `${m.id}-${m.created_at}`)
      .sort()
      .join('|');
    return btoa(memberIds); // Base64 encode for consistent hashing
  }, []);

  // Generate hash from recent sessions to detect new sessions
  const generateSessionHash = useCallback(async (members: TeamMember[]): Promise<string> => {
    if (members.length === 0) return '';
    
    try {
      const userIds = members.map(m => m.user_id);
      const { data: sessions } = await supabase
        .from('conversations')
        .select('id, created_at, user_id')
        .in('user_id', userIds)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(50);

      if (!sessions || sessions.length === 0) return '';
      
      const sessionStr = sessions
        .map(s => `${s.id}-${s.created_at}`)
        .join('|');
      return btoa(sessionStr);
    } catch (error) {
      console.error('Error generating session hash:', error);
      return '';
    }
  }, []);

  // Check if cached data exists and is valid
  const getCachedData = useCallback((key: string): CachedData | null => {
    try {
      const stored = localStorage.getItem(`team_cache_${key}`);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      const now = Date.now();
      
      // Check if data is expired
      if (now - parsed.timestamp > ttl) {
        localStorage.removeItem(`team_cache_${key}`);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Error reading cached data:', error);
      return null;
    }
  }, [ttl]);

  // Store data in cache
  const setCacheData = useCallback(async (
    key: string, 
    data: Omit<CachedData, 'timestamp' | 'memberHash' | 'sessionHash'>
  ) => {
    try {
      const memberHash = generateMemberHash(teamMembers);
      const sessionHash = await generateSessionHash(teamMembers);
      
      const cacheData: CachedData = {
        ...data,
        timestamp: Date.now(),
        memberHash,
        sessionHash
      };
      
      localStorage.setItem(`team_cache_${key}`, JSON.stringify(cacheData));
      setCachedData(cacheData);
      setIsStale(false);
    } catch (error) {
      console.error('Error storing cached data:', error);
    }
  }, [teamMembers, generateMemberHash, generateSessionHash]);

  // Invalidate cache
  const invalidateCache = useCallback((key: string) => {
    localStorage.removeItem(`team_cache_${key}`);
    setCachedData(null);
    setIsStale(true);
  }, []);

  // Check cache validity on component mount and team member changes
  useEffect(() => {
    const checkCacheValidity = async () => {
      if (!managerId || teamMembers.length === 0) {
        setCachedData(null);
        return;
      }

      const cached = getCachedData(cacheKey);
      if (!cached) {
        setIsStale(true);
        return;
      }

      // Check if team members changed
      const currentMemberHash = generateMemberHash(teamMembers);
      if (cached.memberHash !== currentMemberHash) {
        console.log('Team members changed, invalidating cache');
        invalidateCache(cacheKey);
        return;
      }

      // Check if new sessions were created
      const currentSessionHash = await generateSessionHash(teamMembers);
      if (cached.sessionHash !== currentSessionHash) {
        console.log('New sessions detected, invalidating cache');
        invalidateCache(cacheKey);
        return;
      }

      // Cache is valid
      setCachedData(cached);
      setIsStale(false);
    };

    checkCacheValidity();
  }, [managerId, teamMembers, cacheKey, getCachedData, generateMemberHash, generateSessionHash, invalidateCache]);

  // Set up real-time listeners for cache invalidation
  useEffect(() => {
    if (!managerId) return;

    const channels: any[] = [];

    // Listen for team member changes
    const teamMemberChannel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${managerId}`
        },
        (payload) => {
          console.log('Team member change detected:', payload);
          invalidateCache(cacheKey);
        }
      )
      .subscribe();

    channels.push(teamMemberChannel);

    // Listen for new conversations from team members
    if (teamMembers.length > 0) {
      const userIds = teamMembers.map(m => m.user_id);
      
      const conversationChannel = supabase
        .channel('team-conversations-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversations'
          },
          (payload) => {
            // Check if the new conversation belongs to a team member
            if (userIds.includes(payload.new.user_id)) {
              console.log('New team conversation detected:', payload);
              // Add small delay to allow session to be processed
              setTimeout(() => invalidateCache(cacheKey), 2000);
            }
          }
        )
        .subscribe();

      channels.push(conversationChannel);
    }

    // Cleanup subscriptions
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [managerId, teamMembers, cacheKey, invalidateCache]);

  return {
    cachedData,
    isStale,
    setCacheData,
    invalidateCache: () => invalidateCache(cacheKey),
    isCacheValid: cachedData !== null && !isStale
  };
};