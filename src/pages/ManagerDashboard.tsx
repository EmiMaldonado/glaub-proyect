import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Trash2, Mail, BarChart3 } from "lucide-react";
import AddEmployeeModal from "@/components/AddEmployeeModal";
import TeamMemberSharedData from "@/components/TeamMemberSharedData";
import ManagementRecommendations from "@/components/ManagementRecommendations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";

interface EmployeeProfile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
}

interface ManagerProfile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
  user_id: string;
}

interface TeamMembership {
  id: string;
  manager_id: string;
  employee_1_id?: string;
  employee_2_id?: string;
  employee_3_id?: string;
  employee_4_id?: string;
  employee_5_id?: string;
  employee_6_id?: string;
  employee_7_id?: string;
  employee_8_id?: string;
  employee_9_id?: string;
  employee_10_id?: string;
  employee_1?: EmployeeProfile;
  employee_2?: EmployeeProfile;
  employee_3?: EmployeeProfile;
  employee_4?: EmployeeProfile;
  employee_5?: EmployeeProfile;
  employee_6?: EmployeeProfile;
  employee_7?: EmployeeProfile;
  employee_8?: EmployeeProfile;
  employee_9?: EmployeeProfile;
  employee_10?: EmployeeProfile;
  created_at: string;
  updated_at: string;
}

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [teamData, setTeamData] = useState<TeamMembership | null>(null);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Initialize team record if doesn't exist
  const initializeTeam = async () => {
    if (!user?.id || !managerProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('manager_id', managerProfile.id)
        .maybeSingle();
        
      if (!data && !error) {
        await supabase
          .from('team_memberships')
          .insert({ manager_id: managerProfile.id });
      }
    } catch (err) {
      console.log("Initializing team record...");
      await supabase
        .from('team_memberships')
        .insert({ manager_id: managerProfile.id });
    }
  };

  // Fetch team data with all employee relationships
  const fetchTeamData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get manager profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!profile) {
        toast({
          title: "Error",
          description: "Manager profile not found",
          variant: "destructive"
        });
        return;
      }

      setManagerProfile(profile);

      // Initialize team if needed
      const { data: existingTeam } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('manager_id', profile.id)
        .maybeSingle();
        
      if (!existingTeam) {
        await supabase
          .from('team_memberships')
          .insert({ manager_id: profile.id });
      }

      // Get team data with all employee profiles
      const { data: team, error } = await supabase
        .from('team_memberships')
        .select(`
          *,
          employee_1:profiles!employee_1_id(id, email, full_name, display_name, avatar_url),
          employee_2:profiles!employee_2_id(id, email, full_name, display_name, avatar_url),
          employee_3:profiles!employee_3_id(id, email, full_name, display_name, avatar_url),
          employee_4:profiles!employee_4_id(id, email, full_name, display_name, avatar_url),
          employee_5:profiles!employee_5_id(id, email, full_name, display_name, avatar_url),
          employee_6:profiles!employee_6_id(id, email, full_name, display_name, avatar_url),
          employee_7:profiles!employee_7_id(id, email, full_name, display_name, avatar_url),
          employee_8:profiles!employee_8_id(id, email, full_name, display_name, avatar_url),
          employee_9:profiles!employee_9_id(id, email, full_name, display_name, avatar_url),
          employee_10:profiles!employee_10_id(id, email, full_name, display_name, avatar_url)
        `)
        .eq('manager_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching team data:', error);
        toast({
          title: "Error",
          description: "Failed to load team data",
          variant: "destructive"
        });
      } else {
        setTeamData(team);
      }
    } catch (err) {
      console.error('Error in fetchTeamData:', err);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Add employee to first available slot
  const addEmployee = async (employeeId: string) => {
    if (!teamData || !managerProfile?.id) return;

    const slots = ['employee_1_id', 'employee_2_id', 'employee_3_id', 'employee_4_id', 'employee_5_id', 
                  'employee_6_id', 'employee_7_id', 'employee_8_id', 'employee_9_id', 'employee_10_id'];
    
    try {
      for (let slot of slots) {
        if (!teamData[slot as keyof TeamMembership]) {
          const { error } = await supabase
            .from('team_memberships')
            .update({ [slot]: employeeId })
            .eq('manager_id', managerProfile.id);

          if (error) throw error;

          toast({
            title: "Success",
            description: "Employee added to team successfully"
          });
          
          fetchTeamData();
          setAddEmployeeOpen(false);
          break;
        }
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      toast({
        title: "Error",
        description: "Failed to add employee to team",
        variant: "destructive"
      });
    }
  };

  // Remove employee from slot
  const removeEmployee = async (slotNumber: number) => {
    if (!managerProfile?.id) return;

    try {
      const slotName = `employee_${slotNumber}_id`;
      
      const { error } = await supabase
        .from('team_memberships')
        .update({ [slotName]: null })
        .eq('manager_id', managerProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee removed from team"
      });
      
      fetchTeamData();
    } catch (err) {
      console.error('Error removing employee:', err);
      toast({
        title: "Error",
        description: "Failed to remove employee",
        variant: "destructive"
      });
    }
  };

  // Get active team members for insights display
  const getActiveTeamMembers = () => {
    if (!teamData) return [];
    
    const members = [];
    for (let i = 1; i <= 10; i++) {
      const employee = teamData[`employee_${i}` as keyof TeamMembership];
      if (employee) {
        members.push(employee);
      }
    }
    return members;
  };

  const EmployeeCard = ({ slotNumber, employee }: { slotNumber: number; employee?: EmployeeProfile }) => {
    if (employee) {
      return (
        <Card className="transition-all duration-200 hover:shadow-md border border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                Slot {slotNumber}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-error hover:text-error hover:bg-error-light">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Employee</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {employee.display_name || employee.full_name} from your team?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => removeEmployee(slotNumber)}
                      className="bg-error hover:bg-error/90 text-error-foreground"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={employee.avatar_url} alt={employee.display_name || employee.full_name} />
                <AvatarFallback className="bg-primary-100 text-primary-600">
                  {(employee.display_name || employee.full_name || employee.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-medium text-foreground">
                  {employee.display_name || employee.full_name || 'Unknown'}
                </h3>
                <div className="flex items-center justify-center mt-1 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[150px]">{employee.email}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="transition-all duration-200 hover:shadow-md border-2 border-dashed border-border bg-card hover:bg-card-hover">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <Badge variant="outline" className="text-xs">
              Slot {slotNumber}
            </Badge>
            <div className="text-center space-y-2">
              <User className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Empty Slot</h3>
              <Button 
                onClick={() => {
                  setSelectedSlot(slotNumber);
                  setAddEmployeeOpen(true);
                }}
                size="sm" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Employee
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
        {/* Manager Header */}
        <div className="mb-8">
          <Card className="bg-gradient-primary text-primary-foreground">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16 border-2 border-primary-foreground/20">
                  <AvatarImage src={managerProfile?.avatar_url} alt={managerProfile?.display_name} />
                  <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">
                    {(managerProfile?.display_name || managerProfile?.full_name || 'M')?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">
                    {managerProfile?.display_name || managerProfile?.full_name || 'Manager'}
                  </CardTitle>
                  <p className="text-primary-foreground/80 flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-2" />
                    {managerProfile?.email || user?.email}
                  </p>
                  <Badge variant="secondary" className="mt-2 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30">
                    Team Manager
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Management Recommendations Section */}
        <div className="mb-8">
          <ManagementRecommendations 
            teamMembers={getActiveTeamMembers().map(member => ({
              id: member.id,
              name: member.display_name || member.full_name || 'Unknown',
              email: member.email,
              sessionCount: 0, // TODO: Add session count from shared data
              needsAttention: false, // TODO: Add attention indicators
            }))}
            managerId={managerProfile?.id || ''} 
          />
        </div>
        
        {/* Team Insights Section */}
        <div className="mb-8">
          <TeamMemberSharedData 
            teamMembers={getActiveTeamMembers()} 
            managerId={managerProfile?.id || ''} 
          />
        </div>

        {/* Team Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Team Members (10 Slots)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {Array.from({ length: 10 }, (_, index) => {
              const slotNumber = index + 1;
              const employeeKey = `employee_${slotNumber}` as keyof TeamMembership;
              const employee = teamData?.[employeeKey] as EmployeeProfile;
              
              return (
                <EmployeeCard
                  key={slotNumber}
                  slotNumber={slotNumber}
                  employee={employee}
                />
              );
            })}
          </div>
        </div>

        {/* Team Stats */}
        <Card className="bg-background-secondary">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <h3 className="text-2xl font-bold text-primary">
                  {Object.values(teamData || {}).filter((value, index, array) => 
                    index >= 2 && index <= 11 && value !== null
                  ).length}
                </h3>
                <p className="text-sm text-muted-foreground">Active Members</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-muted-foreground">
                  {10 - Object.values(teamData || {}).filter((value, index, array) => 
                    index >= 2 && index <= 11 && value !== null
                  ).length}
                </h3>
                <p className="text-sm text-muted-foreground">Available Slots</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-success">10</h3>
                <p className="text-sm text-muted-foreground">Total Capacity</p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-info">
                  {teamData?.created_at ? new Date(teamData.created_at).toLocaleDateString() : 'N/A'}
                </h3>
                <p className="text-sm text-muted-foreground">Team Created</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Employee Modal */}
        <AddEmployeeModal
          open={addEmployeeOpen}
          onOpenChange={setAddEmployeeOpen}
          onAddEmployee={addEmployee}
          selectedSlot={selectedSlot}
        />
      </div>
    </div>
  );
};

export default ManagerDashboard;