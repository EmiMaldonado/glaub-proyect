import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Users, Mail, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked';
  invited_at: string;
  accepted_at?: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  created_at: string;
}

interface TeamManagementProps {
  userProfile: any;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ userProfile }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [fetchingData, setFetchingData] = useState(true);

  const isManager = userProfile?.role === 'manager';

  useEffect(() => {
    if (user && userProfile) {
      fetchInvitations();
      fetchTeamMembers();
    }
  }, [user, userProfile]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('manager_id', userProfile.id)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations((data || []) as Invitation[]);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      setFetchingData(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('manager_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setFetchingData(false);
    }
  };

  const sendInvitation = async () => {
    if (!email) {
      toast({
        title: "Email requerido",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email },
      });

      if (error) throw error;

      toast({
        title: "¡Invitación enviada!",
        description: `Se ha enviado una invitación a ${email}`,
      });

      setEmail('');
      fetchInvitations(); // Refresh invitations list
    } catch (error: any) {
      toast({
        title: "Error al enviar invitación",
        description: error.message || "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-success"><CheckCircle className="w-3 h-3 mr-1" />Aceptado</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="text-destructive"><XCircle className="w-3 h-3 mr-1" />Revocado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Show team building section for employees
  if (!isManager && teamMembers.length === 0 && invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Construye tu Equipo
          </CardTitle>
          <CardDescription>
            Invita a miembros de tu equipo para desbloquear funciones de gestión
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-email">Email del miembro del equipo</Label>
            <div className="flex gap-2">
              <Input
                id="team-email"
                type="email"
                placeholder="ejemplo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendInvitation()}
              />
              <Button onClick={sendInvitation} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Enviando...' : 'Invitar'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Cuando alguien acepte tu invitación, automáticamente obtendrás acceso a funciones de gestión de equipo.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Manager view or employee with team
  return (
    <div className="space-y-6">
      {/* Team Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mi Equipo ({teamMembers.length})
          </CardTitle>
          <CardDescription>
            Miembros actuales de tu equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingData ? (
            <p className="text-muted-foreground">Cargando equipo...</p>
          ) : teamMembers.length > 0 ? (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {(member.display_name || member.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{member.display_name || member.full_name || 'Usuario'}</p>
                      <p className="text-sm text-muted-foreground">
                        Se unió el {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay miembros en tu equipo aún.</p>
          )}
        </CardContent>
      </Card>

      {/* Invite New Members Section */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitar Nuevo Miembro
            </CardTitle>
            <CardDescription>
              Envía una invitación para expandir tu equipo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email del nuevo miembro</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendInvitation()}
                />
                <Button onClick={sendInvitation} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? 'Enviando...' : 'Invitar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invitations Status */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones Enviadas</CardTitle>
            <CardDescription>
              Estado de las invitaciones que has enviado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Enviado el {new Date(invitation.invited_at).toLocaleDateString()}
                        {invitation.accepted_at && 
                          ` • Aceptado el ${new Date(invitation.accepted_at).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(invitation.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamManagement;