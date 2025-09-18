import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Settings } from 'lucide-react';

interface SharingPreferencesProps {
  userProfile: any;
  managerId?: string;
  onPreferencesChange?: (preferences: SharingPreferences) => void;
}

interface SharingPreferences {
  share_profile: boolean;
  share_insights: boolean;
  share_conversations: boolean;
  share_ocean_profile: boolean;
  share_progress: boolean;
}

const SharingPreferences: React.FC<SharingPreferencesProps> = ({
  userProfile,
  managerId,
  onPreferencesChange
}) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SharingPreferences>({
    share_profile: true,
    share_insights: true,
    share_conversations: true,
    share_ocean_profile: true,
    share_progress: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasManager, setHasManager] = useState(false);
  const [managerName, setManagerName] = useState<string>('');

  useEffect(() => {
    if (user && userProfile) {
      loadSharingPreferences();
      checkManagerStatus();
    }
  }, [user, userProfile, managerId]);

  const checkManagerStatus = async () => {
    if (!userProfile?.id) return;

    try {
      // Check if user is part of any team (has a manager)
      const { data: teamMembership } = await supabase
        .from('team_memberships')
        .select(`
          manager_id,
          manager:profiles!manager_id(full_name, display_name)
        `)
        .or(
          `employee_1_id.eq.${userProfile.id},employee_2_id.eq.${userProfile.id},employee_3_id.eq.${userProfile.id},employee_4_id.eq.${userProfile.id},employee_5_id.eq.${userProfile.id},employee_6_id.eq.${userProfile.id},employee_7_id.eq.${userProfile.id},employee_8_id.eq.${userProfile.id},employee_9_id.eq.${userProfile.id},employee_10_id.eq.${userProfile.id}`
        )
        .maybeSingle();

      if (teamMembership) {
        setHasManager(true);
        setManagerName(teamMembership.manager?.display_name || teamMembership.manager?.full_name || 'Your Manager');
      } else {
        setHasManager(false);
      }
    } catch (error) {
      console.error('Error checking manager status:', error);
    }
  };

  const loadSharingPreferences = async () => {
    if (!user?.id || !userProfile?.id) return;

    setLoading(true);
    try {
      // Get the user's manager from team memberships
      const { data: teamMembership } = await supabase
        .from('team_memberships')
        .select('manager_id')
        .or(
          `employee_1_id.eq.${userProfile.id},employee_2_id.eq.${userProfile.id},employee_3_id.eq.${userProfile.id},employee_4_id.eq.${userProfile.id},employee_5_id.eq.${userProfile.id},employee_6_id.eq.${userProfile.id},employee_7_id.eq.${userProfile.id},employee_8_id.eq.${userProfile.id},employee_9_id.eq.${userProfile.id},employee_10_id.eq.${userProfile.id}`
        )
        .maybeSingle();

      if (teamMembership) {
        const { data: existingPrefs } = await supabase
          .from('sharing_preferences')
          .select('*')
          .eq('user_id', user.id)
          .eq('manager_id', teamMembership.manager_id)
          .maybeSingle();

        if (existingPrefs) {
          const newPrefs = {
            share_profile: existingPrefs.share_profile,
            share_insights: existingPrefs.share_insights,
            share_conversations: existingPrefs.share_conversations,
            share_ocean_profile: existingPrefs.share_ocean_profile,
            share_progress: existingPrefs.share_progress
          };
          setPreferences(newPrefs);
          onPreferencesChange?.(newPrefs);
        }
      }
    } catch (error) {
      console.error('Error loading sharing preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAllPreferences = async () => {
    if (!user?.id || !userProfile?.id || !hasManager) return;

    setSaving(true);
    try {
      // Get the user's manager ID
      const { data: teamMembership } = await supabase
        .from('team_memberships')
        .select('manager_id')
        .or(
          `employee_1_id.eq.${userProfile.id},employee_2_id.eq.${userProfile.id},employee_3_id.eq.${userProfile.id},employee_4_id.eq.${userProfile.id},employee_5_id.eq.${userProfile.id},employee_6_id.eq.${userProfile.id},employee_7_id.eq.${userProfile.id},employee_8_id.eq.${userProfile.id},employee_9_id.eq.${userProfile.id},employee_10_id.eq.${userProfile.id}`
        )
        .single();

      if (!teamMembership) {
        throw new Error('Manager not found');
      }

      // Upsert sharing preferences
      const { error } = await supabase
        .from('sharing_preferences')
        .upsert({
          user_id: user.id,
          manager_id: teamMembership.manager_id,
          ...preferences,
          share_ocean_profile: true // Always shared
        }, {
          onConflict: 'user_id,manager_id'
        });

      if (error) throw error;

      onPreferencesChange?.(preferences);

      toast({
        title: "Preferences Updated",
        description: "Your data sharing preferences have been saved successfully",
      });

    } catch (error: any) {
      console.error('Error updating sharing preferences:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update sharing preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getSharingLabel = (key: keyof SharingPreferences): string => {
    const labels = {
      share_profile: 'Profile',
      share_insights: 'Insights',
      share_conversations: 'Conversations',
      share_ocean_profile: 'OCEAN profile',
      share_progress: 'Progress'
    };
    return labels[key];
  };

  if (!hasManager) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your preferences</CardTitle>
          <CardDescription>
            Join a team to enable data sharing with your manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              You need to be part of a team to configure data sharing preferences
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sharingOptions: Array<keyof SharingPreferences> = [
    'share_profile',
    'share_insights', 
    'share_conversations',
    'share_progress'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Your preferences
        </CardTitle>
        <CardDescription>
          Choose what you want to share with {managerName}. No personal details of conversations will be shared - this only helps create better communication strategies with management.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checkbox list */}
        <div className="space-y-3">
          {sharingOptions.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={option}
                checked={preferences[option]}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, [option]: checked as boolean }))
                }
              />
              <Label htmlFor={option} className="text-sm font-medium">
                {getSharingLabel(option)}
              </Label>
            </div>
          ))}
        </div>

        {/* Always shared OCEAN profile */}
        <div className="pt-2 border-t">
          <div className="flex items-center space-x-2 opacity-75">
            <Checkbox checked={true} disabled={true} />
            <Label className="text-sm font-medium text-muted-foreground">
              OCEAN profile (always shared)
            </Label>
          </div>
        </div>

        {/* Update button */}
        <Button 
          onClick={updateAllPreferences} 
          disabled={saving}
          className="w-full mt-4"
        >
          {saving ? 'Saving...' : 'Update preferences'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SharingPreferences;