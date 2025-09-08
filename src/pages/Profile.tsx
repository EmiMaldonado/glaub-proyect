import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { Brain, Share2, Calendar, TrendingUp, Users, MessageSquare, Lightbulb, Target, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TeamManagement from '@/components/TeamManagement';

interface OceanData {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface ProfileData {
  personalityTitle: string;
  description: string;
  oceanData: OceanData;
  strengths: string[];
  growthOpportunities: string[];
  managerTips: string[];
  sessionsCount: number;
  lastSessionDate: string | null;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      // Fetch user's Supabase profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      } else {
        setUserProfile(profile);
      }

      // Fetch user conversations with OCEAN data
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user?.id)
        .not('ocean_signals', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSessions(conversations || []);

      if (conversations && conversations.length > 0) {
        // Get the most recent OCEAN data
        const latestConversation = conversations[0];
        const oceanSignals = latestConversation.ocean_signals as unknown as OceanData;

        // Generate profile data based on OCEAN scores
        const profile = generateProfileFromOcean(oceanSignals);
        profile.sessionsCount = conversations.length;
        profile.lastSessionDate = latestConversation.created_at;

        setProfileData(profile);
      } else {
        // No OCEAN data available yet
        setProfileData({
          personalityTitle: "Tu Perfil Personalizado",
          description: "Completa tu primera sesión para generar tu perfil OCEAN personalizado y obtener insights únicos sobre tu personalidad.",
          oceanData: {
            openness: 0,
            conscientiousness: 0,
            extraversion: 0,
            agreeableness: 0,
            neuroticism: 0
          },
          strengths: [],
          growthOpportunities: [],
          managerTips: [],
          sessionsCount: 0,
          lastSessionDate: null
        });
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del perfil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateProfileFromOcean = (ocean: OceanData): ProfileData => {
    // Convert neuroticism to resilience (invert the scale)
    const resilience = 100 - ocean.neuroticism;
    
    // Generate personality title based on highest traits
    const traits = [
      { name: 'Innovador', value: ocean.openness, threshold: 70 },
      { name: 'Confiable', value: ocean.conscientiousness, threshold: 70 },
      { name: 'Colaborador', value: ocean.extraversion, threshold: 70 },
      { name: 'Empático', value: ocean.agreeableness, threshold: 70 },
      { name: 'Resiliente', value: resilience, threshold: 70 }
    ];

    const strongTraits = traits.filter(t => t.value >= t.threshold);
    const personalityTitle = strongTraits.length > 0 
      ? `El ${strongTraits[0].name} ${strongTraits.length > 1 ? strongTraits[1].name : 'Estratégico'}`
      : 'El Profesional en Desarrollo';

    // Generate description
    const description = generatePersonalityDescription(ocean, resilience);

    // Generate strengths
    const strengths = generateStrengths(ocean, resilience);

    // Generate growth opportunities
    const growthOpportunities = generateGrowthOpportunities(ocean, resilience);

    // Generate manager tips
    const managerTips = generateManagerTips(ocean, resilience);

    return {
      personalityTitle,
      description,
      oceanData: {
        ...ocean,
        neuroticism: resilience // Convert to resilience for display
      },
      strengths,
      growthOpportunities,
      managerTips,
      sessionsCount: 0,
      lastSessionDate: null
    };
  };

  const generatePersonalityDescription = (ocean: OceanData, resilience: number): string => {
    const descriptions = [];
    
    if (ocean.openness > 60) {
      descriptions.push("Tu mentalidad innovadora te permite ver oportunidades donde otros ven desafíos");
    }
    if (ocean.conscientiousness > 60) {
      descriptions.push("tu enfoque metódico y confiable genera resultados consistentes");
    }
    if (ocean.extraversion > 60) {
      descriptions.push("tu energía colaborativa inspira y motiva a los equipos");
    }
    if (ocean.agreeableness > 60) {
      descriptions.push("tu capacidad empática construye relaciones sólidas y duraderas");
    }
    if (resilience > 60) {
      descriptions.push("tu resistencia emocional te ayuda a mantener la calma bajo presión");
    }

    return descriptions.length > 0 
      ? descriptions.slice(0, 2).join(', y ') + '.'
      : "Tu personalidad única combina diferentes fortalezas que te hacen valioso en cualquier equipo.";
  };

  const generateStrengths = (ocean: OceanData, resilience: number): string[] => {
    const strengths = [];
    
    if (ocean.openness > 60) {
      strengths.push("Innovación: Generas ideas creativas y abordas problemas desde perspectivas únicas");
    }
    if (ocean.conscientiousness > 60) {
      strengths.push("Confiabilidad: Cumples compromisos y mantienes altos estándares de calidad");
    }
    if (ocean.extraversion > 60) {
      strengths.push("Colaboración: Energizas equipos y facilitas comunicación efectiva");
    }
    if (ocean.agreeableness > 60) {
      strengths.push("Armonía: Construyes consenso y mantienes relaciones positivas");
    }
    if (resilience > 60) {
      strengths.push("Resistencia: Mantienes el rendimiento bajo presión y te adaptas al cambio");
    }

    return strengths.slice(0, 3);
  };

  const generateGrowthOpportunities = (ocean: OceanData, resilience: number): string[] => {
    const opportunities = [];
    
    if (ocean.openness < 50) {
      opportunities.push("Para expandir tu lado innovador, participa en sesiones de brainstorming con equipos diversos");
    }
    if (ocean.conscientiousness < 50) {
      opportunities.push("Desarrolla sistemas de organización personal para aumentar tu efectividad");
    }
    if (ocean.extraversion < 50) {
      opportunities.push("Practica presentaciones en grupos pequeños para aumentar tu comodidad social");
    }
    if (resilience < 50) {
      opportunities.push("Explora técnicas de mindfulness para fortalecer tu resistencia emocional");
    }

    return opportunities.slice(0, 2);
  };

  const generateManagerTips = (ocean: OceanData, resilience: number): string[] => {
    const tips = [];
    
    if (ocean.extraversion > 60) {
      tips.push("Prefiero recibir feedback en conversaciones cara a cara y disfruto colaborar en la resolución de problemas");
    } else {
      tips.push("Valoro el tiempo para procesar información antes de las reuniones y prefiero feedback por escrito inicial");
    }
    
    if (ocean.conscientiousness > 60) {
      tips.push("Trabajo mejor con objetivos claros y plazos definidos, y aprecio reconocimiento por la calidad de mi trabajo");
    } else {
      tips.push("Me beneficio de check-ins regulares y estructura adicional para mantener el enfoque en prioridades");
    }
    
    if (ocean.openness > 60) {
      tips.push("Me motivan proyectos que involucren innovación y oportunidades para proponer nuevas ideas");
    } else {
      tips.push("Prefiero procesos establecidos y me siento cómodo con cambios implementados gradualmente");
    }

    return tips.slice(0, 3);
  };

  const handleShareProfile = async () => {
    try {
      // This would integrate with the email functionality
      toast({
        title: "Compartir Perfil",
        description: "Esta funcionalidad estará disponible próximamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo compartir el perfil.",
        variant: "destructive",
      });
    }
  };

  const chartData = profileData ? [
    { trait: 'Innovación', value: profileData.oceanData.openness, fullMark: 100 },
    { trait: 'Confiabilidad', value: profileData.oceanData.conscientiousness, fullMark: 100 },
    { trait: 'Colaboración', value: profileData.oceanData.extraversion, fullMark: 100 },
    { trait: 'Armonía', value: profileData.oceanData.agreeableness, fullMark: 100 },
    { trait: 'Resistencia', value: profileData.oceanData.neuroticism, fullMark: 100 },
  ] : [];

  const chartConfig = {
    value: {
      label: "Puntuación",
      color: "hsl(var(--therapeutic-primary))",
    },
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto text-center p-8">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Sin datos de perfil</h2>
          <p className="text-muted-foreground mb-4">
            Completa tu primera sesión para generar tu perfil personalizado.
          </p>
          <Button asChild>
            <a href="/conversation">Iniciar Primera Sesión</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tu Perfil OCEAN</h1>
        <p className="text-muted-foreground">
          Insights personalizados basados en {profileData.sessionsCount} sesión{profileData.sessionsCount !== 1 ? 'es' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Profile */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Insight Card */}
          <Card className="therapeutic-gradient border-0 text-primary-foreground calming-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  {profileData.personalityTitle}
                </CardTitle>
              </div>
              <CardDescription className="text-primary-foreground/90 text-base leading-relaxed">
                {profileData.description}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Visual Profile Display */}
          <Card className="insight-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Tu Perfil OCEAN Interactivo
              </CardTitle>
              <CardDescription>
                Pasa el cursor sobre los puntos para ver detalles específicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 && (
                <ChartContainer config={chartConfig} className="h-[400px] w-full">
                  <RadarChart data={chartData}>
                    <ChartTooltip 
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{data.trait}: {data.value}%</p>
                              <p className="text-sm text-muted-foreground">
                                {data.value >= 70 ? 'Fortaleza destacada' : 
                                 data.value >= 50 ? 'Área equilibrada' : 
                                 'Oportunidad de crecimiento'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <PolarGrid />
                    <PolarAngleAxis dataKey="trait" className="text-sm" />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={false}
                    />
                    <Radar
                      dataKey="value"
                      stroke="hsl(var(--therapeutic-primary))"
                      fill="hsl(var(--therapeutic-primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--therapeutic-primary))", strokeWidth: 2, r: 4 }}
                    />
                  </RadarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Actionable Insights List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <Card className="progress-highlight">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-success" />
                  Tus Superpoderes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {profileData.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {index + 1}
                      </Badge>
                      <p className="text-sm leading-relaxed">{strength}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Growth Opportunities */}
            <Card className="insight-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-therapeutic-primary" />
                  Oportunidades de Crecimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {profileData.growthOpportunities.map((opportunity, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-1 text-xs">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Tip
                      </Badge>
                      <p className="text-sm leading-relaxed">{opportunity}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Manager Guide & History */}
        <div className="space-y-6">
          {/* Manager Approach Guide */}
          <Card className="calming-shadow border-therapeutic-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-therapeutic-primary" />
                Trabajando Mejor con tu Manager
              </CardTitle>
              <CardDescription>
                Consejos específicos para comunicación efectiva
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {profileData.managerTips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-therapeutic-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <MessageSquare className="h-3 w-3 text-therapeutic-primary" />
                    </div>
                    <p className="text-sm leading-relaxed">{tip}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Session History & Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Historial de Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{profileData.sessionsCount} sesiones completadas</p>
                  {profileData.lastSessionDate && (
                    <p className="text-sm text-muted-foreground">
                      Última: {new Date(profileData.lastSessionDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{profileData.sessionsCount}</Badge>
              </div>

              {sessions.slice(0, 3).map((session, index) => (
                <div key={session.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <span className="text-sm text-muted-foreground">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {session.duration_minutes || 0}min
                  </Badge>
                </div>
              ))}

              <Button 
                onClick={handleShareProfile}
                className="w-full mt-4 therapeutic-gradient border-0"
                size="lg"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Compartir Insights con Manager
              </Button>
            </CardContent>
          </Card>
        </div>
        </div>
        
        {/* Team Management Section */}
        <div className="mt-8">
          <TeamManagement userProfile={userProfile} />
        </div>
      </div>
  );
};

export default Profile;