import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Share2, Eye, EyeOff, Shield, Users, User, Brain, BarChart3, MessageCircle } from 'lucide-react';

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
    share_profile: false,
    share_insights: false,
    share_conversations: false,
    share_ocean_profile: false,
    share_progress: false
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

  const updateSharingPreference = async (key: keyof SharingPreferences, value: boolean) => {
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

      const newPreferences = { ...preferences, [key]: value };

      // Upsert sharing preferences
      const { error } = await supabase
        .from('sharing_preferences')
        .upsert({
          user_id: user.id,
          manager_id: teamMembership.manager_id,
          ...newPreferences
        }, {
          onConflict: 'user_id,manager_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);
      onPreferencesChange?.(newPreferences);

      toast({
        title: value ? "Sharing Enabled" : "Sharing Disabled",
        description: `${getSharingLabel(key)} ${value ? 'will now be' : 'is no longer'} visible to your manager`,
      });

    } catch (error: any) {
      console.error('Error updating sharing preference:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update sharing preference",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getSharingLabel = (key: keyof SharingPreferences): string => {
    const labels = {
      share_profile: 'Profile Information',
      share_insights: 'Therapeutic Insights',
      share_conversations: 'Conversation History',
      share_ocean_profile: 'OCEAN Personality Profile',
      share_progress: 'Progress Reports'
    };
    return labels[key];
  };

  const getSharingIcon = (key: keyof SharingPreferences) => {
    const icons = {
      share_profile: User,
      share_insights: Brain,
      share_conversations: MessageCircle,
      share_ocean_profile: BarChart3,
      share_progress: BarChart3
    };
    const Icon = icons[key];
    return <Icon className="h-4 w-4" />;
  };

  const getSharingDescription = (key: keyof SharingPreferences): string => {
    const descriptions = {
      share_profile: 'Your name, role, and basic profile information',
      share_insights: 'Key insights and recommendations from your sessions',
      share_conversations: 'Your therapeutic conversation history and summaries',
      share_ocean_profile: 'Your OCEAN personality assessment results',
      share_progress: 'Your progress reports and session statistics'
    };
    return descriptions[key];
  };

  if (!hasManager) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Data Sharing
          </CardTitle>
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
    'share_ocean_profile',
    'share_progress'
  ];

  const sharedCount = Object.values(preferences).filter(Boolean).length;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Data Sharing with {managerName}
            </CardTitle>
            <CardDescription>
              Control what information you share with your manager
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={sharedCount > 0 ? "default" : "secondary"}>
              {sharedCount} of {sharingOptions.length} shared
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick toggle all */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <Label className="font-medium">Share All Data</Label>
              <p className="text-sm text-muted-foreground">
                Enable all sharing options at once
              </p>
            </div>
          </div>
          <Switch
            checked={sharedCount === sharingOptions.length}
            onCheckedChange={async (checked) => {
              // Update all preferences
              for (const option of sharingOptions) {
                await updateSharingPreference(option, checked);
              }
            }}
            disabled={saving}
          />
        </div>

        {/* Individual sharing options */}
        <div className="space-y-4">
          {sharingOptions.map((option) => (
            <div key={option} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getSharingIcon(option)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium">{getSharingLabel(option)}</Label>
                    {preferences[option] ? (
                      <Badge variant="default" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getSharingDescription(option)}
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences[option]}
                onCheckedChange={(checked) => updateSharingPreference(option, checked)}
                disabled={saving}
              />
            </div>
          ))}
        </div>

        {/* Privacy notice */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Privacy & Security
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                You have full control over your data. You can modify these settings anytime, 
                and your manager will only see information you explicitly choose to share.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SharingPreferences;