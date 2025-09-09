import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Brain, 
  TrendingUp, 
  Users, 
  Calendar,
  Plus,
  History,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();

  const stats = [
    {
      title: "Conversaciones",
      value: "0",
      description: "Total realizadas",
      icon: MessageCircle,
      color: "text-primary"
    },
    {
      title: "Perfil OCEAN",
      value: "Pendiente",
      description: "Estado actual",
      icon: Brain,
      color: "text-secondary"
    },
    {
      title: "Insights",
      value: "0",
      description: "Compartidos",
      icon: TrendingUp,
      color: "text-accent"
    },
    {
      title: "Equipo",
      value: "0",
      description: "Miembros",
      icon: Users,
      color: "text-muted-foreground"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          ¡Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="text-lg text-muted-foreground">
          Bienvenido a tu dashboard personal. Aquí puedes ver tu progreso y comenzar nuevas conversaciones.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft hover:shadow-medium transition-smooth">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">Nueva Conversación</CardTitle>
            </div>
            <Badge variant="secondary" className="ml-auto">
              10-15 min
            </Badge>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Inicia una conversación empática con nuestra IA para descubrir nuevos insights sobre tu personalidad.
            </CardDescription>
            <Button variant="empathy" className="w-full" asChild>
              <Link to="/conversation">
                <Plus className="mr-2 h-4 w-4" />
                Comenzar Conversación
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-medium transition-smooth">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center">
                <History className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">Historial</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Revisa tus conversaciones anteriores y observa la evolución de tu perfil OCEAN a lo largo del tiempo.
            </CardDescription>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/history">
                <Calendar className="mr-2 h-4 w-4" />
                Ver Historial
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Summary Highlights & Profile */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Últimos Insights</span>
            </CardTitle>
            <CardDescription>
              Highlights de tu conversación más reciente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              No hay conversaciones completadas aún. Inicia tu primera conversación para ver insights personalizados aquí.
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span>Los insights aparecerán después de completar una conversación</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-secondary" />
              <span>Mi Perfil</span>
            </CardTitle>
            <CardDescription>
              Gestiona tu información personal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Completa tu perfil para una experiencia más personalizada
              </p>
              <div className="flex flex-col space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    Ver Perfil
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-xs" disabled>
                  <Users className="mr-1 h-3 w-3" />
                  Gestión de Equipo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Primeros Pasos</span>
          </CardTitle>
          <CardDescription>
            Te ayudamos a comenzar con PersonaInsights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                  1
                </div>
                <h3 className="font-semibold">Completa tu perfil</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Añade información básica para personalizar tu experiencia.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/profile">
                  <Settings className="mr-1 h-3 w-3" />
                  Ir al perfil
                </Link>
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground text-sm font-bold">
                  2
                </div>
                <h3 className="font-semibold">Primera conversación</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Inicia tu primera conversación para generar tu perfil OCEAN.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/conversation">
                  <MessageCircle className="mr-1 h-3 w-3" />
                  Comenzar
                </Link>
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-accent-foreground text-sm font-bold">
                  3
                </div>
                <h3 className="font-semibold">Invita a tu equipo</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Invita a miembros de tu equipo para obtener insights grupales.
              </p>
              <Button variant="outline" size="sm" disabled>
                <Users className="mr-1 h-3 w-3" />
                Próximamente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;