import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  MessageCircle, 
  Brain, 
  TrendingUp, 
  Users, 
  Calendar,
  Plus,
  History,
  Settings,
  Target,
  Lightbulb,
  Share2,
  UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

const Dashboard = () => {
  const { user } = useAuth();
  const [lastConversation, setLastConversation] = useState<any>(null);
  const [oceanProfile, setOceanProfile] = useState<any>(null);
  const [sharingSettings, setSharingSettings] = useState({
    profile: false,
    insights: false,
    strengths: false,
    opportunities: false,
    manager: false,
    team: false
  });
  const [stats, setStats] = useState({
    totalConversations: 0,
    completedConversations: 0,
    sharedInsights: 0,
    teamMembers: 0
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      // Load conversations count
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, status, insights, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Load last conversation with insights
      const { data: lastConv } = await supabase
        .from('conversations')
        .select(`
          *,
          key_insights (
            insights,
            personality_notes,
            next_steps
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastConv) {
        setLastConversation(lastConv);
        if (lastConv.insights) {
          setOceanProfile(lastConv.insights);
        }
      }

      setStats({
        totalConversations: conversations?.length || 0,
        completedConversations: conversations?.filter(c => c.status === 'completed').length || 0,
        sharedInsights: 0, // TODO: implement sharing tracking
        teamMembers: 0 // TODO: implement team member count
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleSharingToggle = (setting: string) => {
    setSharingSettings(prev => ({
      ...prev,
      [setting]: !prev[setting as keyof typeof prev]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          ¡Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="text-lg text-muted-foreground">
          Tu espacio personal para el autoconocimiento y desarrollo profesional.
        </p>
      </div>

      {/* Section 1: Nueva Conversación - Prominent */}
      <Card className="bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Nueva Conversación</h2>
              <p className="text-primary-foreground/90">
                Inicia una sesión de 10-15 minutos para descubrir nuevos insights sobre tu personalidad
              </p>
              <Button 
                variant="secondary" 
                size="lg" 
                className="mt-4"
                asChild
              >
                <Link to="/conversation">
                  <Plus className="mr-2 h-5 w-5" />
                  Comenzar Ahora
                </Link>
              </Button>
            </div>
            <div className="hidden md:block">
              <MessageCircle className="h-16 w-16 text-primary-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Tu Última Reunión */}
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Tu Última Reunión
            </CardTitle>
            <CardDescription>
              {lastConversation ? 
                `Completada el ${new Date(lastConversation.created_at).toLocaleDateString()}` :
                'Aún no has completado ninguna conversación'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={sharingSettings.insights}
              onCheckedChange={() => handleSharingToggle('insights')}
            />
            <span className="text-sm text-muted-foreground">Compartir con Manager</span>
          </div>
        </CardHeader>
        <CardContent>
          {lastConversation ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duración:</span>
                  <p className="font-medium">{lastConversation.duration_minutes || 15} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">Conversación Completa</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Insights:</span>
                  <p className="font-medium">{lastConversation.key_insights?.insights?.length || 3} generados</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/history">
                  <History className="mr-1 h-3 w-3" />
                  Ver Historial Completo
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Completa tu primera conversación para ver un resumen aquí
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Tu Perfil OCEAN */}
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-secondary" />
              Tu Perfil OCEAN
            </CardTitle>
            <CardDescription>
              Dimensiones de personalidad basadas en tus conversaciones
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={sharingSettings.profile}
              onCheckedChange={() => handleSharingToggle('profile')}
            />
            <span className="text-sm text-muted-foreground">Compartir con Manager</span>
          </div>
        </CardHeader>
        <CardContent>
          {oceanProfile ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{oceanProfile.openness || 0}%</div>
                <div className="text-xs text-muted-foreground">Apertura</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{oceanProfile.conscientiousness || 0}%</div>
                <div className="text-xs text-muted-foreground">Responsabilidad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{oceanProfile.extraversion || 0}%</div>
                <div className="text-xs text-muted-foreground">Extraversión</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{oceanProfile.agreeableness || 0}%</div>
                <div className="text-xs text-muted-foreground">Amabilidad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{100 - (oceanProfile.neuroticism || 0)}%</div>
                <div className="text-xs text-muted-foreground">Estabilidad</div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Completa una conversación para generar tu perfil OCEAN personalizado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Puntos Fuertes y Oportunidades */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Puntos Fuertes
              </CardTitle>
              <CardDescription>
                Tus principales fortalezas identificadas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.strengths}
                onCheckedChange={() => handleSharingToggle('strengths')}
              />
              <span className="text-sm text-muted-foreground">Compartir</span>
            </div>
          </CardHeader>
          <CardContent>
            {lastConversation?.key_insights?.insights ? (
              <ul className="space-y-2">
                {lastConversation.key_insights.insights.slice(0, 3).map((insight: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{insight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Completa una conversación para identificar tus fortalezas
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                Oportunidades de Crecimiento
              </CardTitle>
              <CardDescription>
                Áreas para tu desarrollo profesional
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.opportunities}
                onCheckedChange={() => handleSharingToggle('opportunities')}
              />
              <span className="text-sm text-muted-foreground">Compartir</span>
            </div>
          </CardHeader>
          <CardContent>
            {lastConversation?.key_insights?.next_steps ? (
              <ul className="space-y-2">
                {lastConversation.key_insights.next_steps.slice(0, 3).map((step: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Los pasos recomendados aparecerán después de tu primera conversación
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Trabajar con tu Manager y Construir tu Equipo */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Trabajar con tu Manager
              </CardTitle>
              <CardDescription>
                Mejora la comunicación y colaboración
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.manager}
                onCheckedChange={() => handleSharingToggle('manager')}
              />
              <span className="text-sm text-muted-foreground">Compartir</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Comparte insights seleccionados con tu manager para mejorar la comunicación y el desarrollo profesional.
            </p>
            <Button variant="outline" size="sm" disabled>
              <Share2 className="mr-1 h-3 w-3" />
              Enviar Invitación
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Construir tu Equipo
              </CardTitle>
              <CardDescription>
                Insights grupales y dinámicas de equipo
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.team}
                onCheckedChange={() => handleSharingToggle('team')}
              />
              <span className="text-sm text-muted-foreground">Compartir</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Miembros del equipo:</span>
                <span className="font-medium">{stats.teamMembers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Insights compartidos:</span>
                <span className="font-medium">{stats.sharedInsights}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Users className="mr-1 h-3 w-3" />
              Gestionar Equipo
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;