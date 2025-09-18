import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  TrendingUp, 
  MessageCircle, 
  Target, 
  Settings,
  BarChart3,
  User
} from 'lucide-react';
import TeamManagementInterface from './TeamManagementInterface';
import ManagerInsightsDashboard from './ManagerInsightsDashboard';
import MeetingHistoryTabs from '@/components/MeetingHistoryTabs';
import NotificationSystem from '@/components/NotificationSystem';
import DashboardBreadcrumbs from "@/components/DashboardBreadcrumbs";
import DashboardViewSwitch from "@/components/DashboardViewSwitch";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface ManagerProfile {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  team_name: string;
}

const ModernManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (user) {
      loadManagerData();
    }
  }, [user]);

  const loadManagerData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load manager profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== 'manager') {
        toast({
          title: "Access Denied",
          description: "Only managers can access this dashboard",
          variant: "destructive"
        });
        return;
      }

      setManagerProfile(profile);

      // Load team members
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('manager_id', profile.id)
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;

      setTeamMembers(members || []);

    } catch (error: any) {
      console.error('Error loading manager data:', error);
      toast({
        title: "Error Loading Dashboard",
        description: error.message || "Failed to load manager dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamUpdate = () => {
    loadManagerData();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading manager dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!managerProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Manager profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <DashboardBreadcrumbs />
        <DashboardViewSwitch />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name}'s Team`}
            </h1>
            <p className="text-lg text-muted-foreground">
              Manage your team of {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            <User className="mr-1 h-3 w-3" />
            Manager
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Team Members</span>
            </div>
            <p className="text-2xl font-bold">{teamMembers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Active Sessions</span>
            </div>
            <p className="text-2xl font-bold">--</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Shared Insights</span>
            </div>
            <p className="text-2xl font-bold">--</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Team Progress</span>
            </div>
            <p className="text-2xl font-bold">--</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Team Insights</TabsTrigger>
          <TabsTrigger value="management">Team Management</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground mt-4 mb-4">No team members yet</p>
                    <Button onClick={() => setActiveTab('management')} variant="outline">
                      <Users className="mr-2 h-4 w-4" />
                      Add Team Members
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedMember(member);
                          setActiveTab('insights');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{member.display_name || member.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Team Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">Team analytics coming soon</p>
                  <p className="text-sm text-muted-foreground">View aggregated team insights and progress</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <ManagerInsightsDashboard 
            teamMembers={teamMembers}
            managerId={managerProfile.id}
            selectedMember={selectedMember}
            onMemberSelect={setSelectedMember}
          />
        </TabsContent>

        {/* Team Management Tab */}
        <TabsContent value="management" className="space-y-6">
          <div className="space-y-6">
            {/* Notifications for Manager */}
            <NotificationSystem maxDisplayed={3} />
            
            {/* Team Management Interface */}
            <TeamManagementInterface 
              managerProfile={managerProfile}
              teamMembers={teamMembers}
              onTeamUpdate={handleTeamUpdate}
            />
            
            {/* Meeting History for Manager */}
            <Card>
              <CardHeader>
                <CardTitle>Team Meeting History</CardTitle>
              </CardHeader>
              <CardContent>
                <MeetingHistoryTabs />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModernManagerDashboard;