import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Target, 
  Lightbulb, 
  Calendar, 
  Clock, 
  TrendingUp,
  Users,
  Share2,
  Bell,
  Settings
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import SharingPreferences from '@/components/SharingPreferences';

interface EmployeeProfile {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  manager_id?: string;
  job_position?: string;
  created_at: string;
}

interface ManagerProfile {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  team_name?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface EmployeeSharingPreferences {
  share_ocean_profile: boolean;
  share_conversations: boolean;
  share_insights: boolean;
  share_progress: boolean;
  share_profile: boolean;
  share_strengths: boolean;
  share_manager_recommendations: boolean;
}

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sharingPrefs, setSharingPrefs] = useState<EmployeeSharingPreferences>({
    share_ocean_profile: false,
    share_conversations: false,
    share_insights: false,
    share_progress: false,
    share_profile: false,
    share_strengths: false,
    share_manager_recommendations: false
  });
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
      fetchNotifications();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get employee profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Get manager info if employee has a manager
      if (profileData.manager_id) {
        const { data: managerData, error: managerError } = await supabase
          .from('profiles')
          .select('id, full_name, display_name, avatar_url, team_name')
          .eq('id', profileData.manager_id)
          .single();

        if (!managerError && managerData) {
          setManager(managerData);
        }
      }

      // Get sharing preferences
      const { data: sharingData, error: sharingError } = await supabase
        .from('sharing_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!sharingError && sharingData) {
        setSharingPrefs({
          share_ocean_profile: sharingData.share_ocean_profile || false,
          share_conversations: sharingData.share_conversations || false,
          share_insights: sharingData.share_insights || false,
          share_progress: sharingData.share_progress || false,
          share_profile: sharingData.share_profile || false,
          share_strengths: sharingData.share_strengths || false,
          share_manager_recommendations: sharingData.share_manager_recommendations || false
        });
      }

    } catch (error: any) {
      console.error('Error fetching employee data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_notifications', {
        target_user_id: user.id
      });

      if (!error && data) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSharingPreferencesChange = (preferences: any) => {
    setSharingPrefs(preferences);
  };

  const sendManagerInvitation = async () => {
    const email = prompt('Enter the email address of the person you want to invite as your manager:');
    if (!email) return;

    try {
      console.log('Sending manager invitation to:', email);
      
      const { data, error } = await supabase.functions.invoke('employee-invite-manager', {
        body: { managerEmail: email.trim() }
      });

      if (error) {
        console.error('Error sending manager invitation:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to send manager invitation",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Manager Request Sent!",
        description: `Manager request sent to ${email}. They will receive an invitation to become your manager.`,
      });

      fetchNotifications();
    } catch (error: any) {
      console.error('Error in sendManagerInvitation:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Employee Header */}
        <div className="mb-8">
          <Card className="bg-gradient-primary text-primary-foreground">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16 border-2 border-primary-foreground/20">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                    <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">
                      {(profile?.display_name || profile?.full_name || 'E')?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-bold">
                      {profile?.display_name || profile?.full_name || 'Employee'}
                    </h1>
                    <p className="text-primary-foreground/80">
                      {profile?.job_position || 'Team Member'}
                    </p>
                    {manager && (
                      <p className="text-sm text-primary-foreground/70">
                        Manager: {manager.display_name || manager.full_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {unreadNotifications.length > 0 && (
                    <div className="relative">
                      <Bell className="h-6 w-6" />
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {unreadNotifications.length}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ocean">OCEAN Profile</TabsTrigger>
            <TabsTrigger value="strengths">Strengths</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="sharing">Data Sharing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +2 from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Insights Generated</CardTitle>
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    +3 from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Progress Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">78%</div>
                  <p className="text-xs text-muted-foreground">
                    +5% from last week
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Team Status */}
            {!manager && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Manager Assigned</h3>
                    <p className="text-muted-foreground mb-4">
                      Invite someone to be your manager to unlock team features and insights sharing.
                    </p>
                    <Button 
                      onClick={() => sendManagerInvitation()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Invite Manager
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications */}
            {notifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Recent Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {notifications.slice(0, 5).map((notification) => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg border ${
                        notification.read 
                          ? 'bg-muted/50 text-muted-foreground' 
                          : 'bg-primary/5 border-primary/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <p className="text-xs mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markNotificationAsRead(notification.id)}
                            className="text-xs"
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* OCEAN Profile Tab */}
          <TabsContent value="ocean" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  OCEAN Personality Profile
                  {sharingPrefs.share_ocean_profile && (
                    <Badge variant="outline" className="text-primary">
                      <Share2 className="h-3 w-3 mr-1" />
                      Shared
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">OCEAN Profile Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Complete more conversation sessions to generate your personality insights.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strengths Tab */}
          <TabsContent value="strengths" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Personal Strengths
                  {sharingPrefs.share_strengths && (
                    <Badge variant="outline" className="text-primary">
                      <Share2 className="h-3 w-3 mr-1" />
                      Shared
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Strengths Analysis Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Your personalized strengths will appear here after more sessions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Meeting History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="recent" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="recent">Last Meeting</TabsTrigger>
                    <TabsTrigger value="historical">Historical</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="recent" className="mt-6">
                    <div className="text-center py-12">
                      <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Recent Meetings</h3>
                      <p className="text-muted-foreground">
                        Start a conversation session to see your meeting history here.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="historical" className="mt-6">
                    <div className="text-center py-12">
                      <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Historical Data</h3>
                      <p className="text-muted-foreground">
                        Historical meeting data will appear here as you complete more sessions.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sharing Tab */}
          <TabsContent value="sharing" className="space-y-6">
            <SharingPreferences 
              userProfile={profile}
              managerId={manager?.id}
              onPreferencesChange={handleSharingPreferencesChange}
            />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default EmployeeDashboard;