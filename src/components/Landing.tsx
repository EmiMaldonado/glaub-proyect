import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Users, Shield, TrendingUp, MessageCircle, Target, CheckCircle, ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">PersonaInsights</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost">Iniciar Sesión</Button>
            <Button variant="hero">Comenzar Gratis</Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit">
                🚀 Ahora en Beta
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Descubre la personalidad de tu equipo a través de 
                <span className="bg-gradient-hero bg-clip-text text-transparent"> conversaciones empáticas</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Una plataforma que ayuda a empresas y managers a comprender las soft skills y personalidad 
                de empleados y candidatos mediante IA conversacional, generando insights basados en ciencia 
                para motivar y desarrollar mejor a cada persona.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="empathy" size="lg" className="text-lg px-8">
                Empezar Conversación
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8">
                Ver Demo
              </Button>
            </div>
            <div className="flex items-center space-x-8 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>10-15 min por sesión</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Control total de privacidad</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Basado en modelo OCEAN</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <img 
              src={heroImage}
              alt="Plataforma de insights de personalidad"
              className="rounded-2xl shadow-strong w-full h-auto"
            />
            <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-medium shadow-medium">
              🧠 IA Empática
            </div>
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Para cada miembro de tu organización
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Una solución completa que beneficia a empleados, managers y empresas
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="shadow-soft hover:shadow-medium transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle>Para Empleados/Candidatos</CardTitle>
              <CardDescription>Autoconocimiento sin sentirse evaluado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Conversaciones empáticas y naturales</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Desarrollo personal basado en evidencia</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Control total sobre información compartida</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Historial de evolución personal</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-hero rounded-lg flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle>Para Managers</CardTitle>
              <CardDescription>Insights accionables para motivar mejor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Recomendaciones específicas por persona</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Dashboard centralizado del equipo</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Preparación efectiva para 1-1s</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Estrategias de motivación personalizadas</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-accent rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-accent-foreground" />
              </div>
              <CardTitle>Para Empresas</CardTitle>
              <CardDescription>Cultura organizacional mejorada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Mejor fit cultural en contrataciones</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Desarrollo de talento más efectivo</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Reducción de rotación</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <span className="text-sm">Equipos más productivos y satisfechos</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-16 bg-muted/30 rounded-3xl my-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Cómo funciona
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Un proceso simple y empático en tres pasos
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto shadow-medium">
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">1. Conversación Natural</h3>
            <p className="text-muted-foreground">
              Charla de 10-15 minutos con nuestra IA empática. Sin preguntas intimidantes, 
              solo una conversación fluida y natural.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-hero rounded-full flex items-center justify-center mx-auto shadow-medium">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">2. Análisis OCEAN</h3>
            <p className="text-muted-foreground">
              Generamos tu perfil de personalidad basado en el modelo científico Big Five (OCEAN), 
              con insights profundos y recomendaciones personalizadas.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto shadow-medium">
              <Shield className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">3. Control Total</h3>
            <p className="text-muted-foreground">
              Tú decides qué compartir y con quién. Control granular de privacidad 
              y transparencia completa sobre tus datos.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 bg-gradient-hero rounded-3xl p-12 text-primary-foreground shadow-strong">
          <h2 className="text-3xl md:text-4xl font-bold">
            ¿Listo para conocer mejor a tu equipo?
          </h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Únete a la beta gratuita y descubre cómo las conversaciones empáticas 
            pueden transformar la forma en que entiendes y motivas a tu equipo.
          </p>
          <Button variant="accent" size="lg" className="text-lg px-8 shadow-medium">
            Comenzar Beta Gratuita
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">PersonaInsights</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 PersonaInsights. Desarrollando el futuro de la comprensión humana.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;