import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Users, Building, MessageCircle, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-image-new.jpg";
const Landing = () => {
  return <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
        
      </header>

    <div className="p-6">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center rounded-[32px] overflow-hidden bg-cover bg-center bg-no-repeat" style={{
        backgroundImage: `url(${heroImage})`,
        width: '100%',
        height: '100vh'
      }}>
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(36, 71, 110, 0.05)' }}></div>
        <div className="relative w-full h-full flex items-center justify-end pl-6 pr-[5%] py-[5%]">
          <div className="w-full max-w-2xl text-right text-white space-y-8">
            <Badge className="bg-warning/50 text-warning-foreground px-3 py-1 text-xs font-medium rounded-full backdrop-blur-sm">
              ⚠️ This is not a real company, this is Master's thesis project
            </Badge>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-lg">
              Build Stronger Teams,<br />
              One Conversation<br />
              at a Time
            </h1>
            
            <p className="text-l md:text-base text-white/90 max-w-2xl drop-shadow-md">
              Get personalized insights to help every individual thrive.<br />It's not about evaluating, it's about understanding.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <Button size="default" className="bg-primary text-primary-foreground hover:bg-primary-700 text-sm md:text-lg px-4 md:px-8 py-2 md:py-3" asChild>
                <Link to="/auth?mode=signup">
                  Start conversation →
                </Link>
              </Button>
              <Button variant="outline" size="default" className="border-2 border-white text-white bg-transparent hover:bg-white hover:text-primary text-sm md:text-lg px-4 md:px-8 py-2 md:py-3" asChild>
                <Link to="/auth">
                  Register
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              For every member of the company
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover a comprehensive solution that benefits employees, managers, and companies alike
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-semibold">For Employees</CardTitle>
                <CardDescription>Self-awareness without feeling evaluated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Natural, empathetic conversations</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Evidence-based personal development</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Complete control over shared information</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Personal evolution history</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-semibold">For Managers</CardTitle>
                <CardDescription>Actionable insights to better motivate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Person-specific recommendations</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Centralized team dashboard</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Effective 1-1 preparation</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Personalized motivation strategies</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl font-semibold">For Companies</CardTitle>
                <CardDescription>Improve organizational culture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Better cultural fit in hiring</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">More effective talent development</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">Reduced turnover</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">More productive and satisfied teams</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="text-lg font-medium text-primary">How it works</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              A simple and empathetic three-step process
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white" style={{ backgroundColor: '#A5C7B9' }}>
                1
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Natural<br />Conversation</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                10-15 minute empathetic chat with our AI. No intimidating questions, 
                just a fluid and natural conversation.
              </p>
            </div>

            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white" style={{ backgroundColor: '#A5C7B9' }}>
                2
              </div>
              <h3 className="text-2xl font-semibold text-foreground">OCEAN Analysis and Insights</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                We generate your personality profile based on the scientific Big Five (OCEAN) model, 
                with deep insights and personalized recommendations.
              </p>
            </div>

            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white" style={{ backgroundColor: '#A5C7B9' }}>
                3
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Share with<br />Total Control</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                You decide what to share and with whom. Granular privacy control 
                and complete transparency about your data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <img src="/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" className="h-8 w-auto" onError={e => {
              (e.currentTarget as HTMLElement).style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
            }} />
              <span className="text-xl font-bold hidden">Gläub</span>
            </div>
            <p className="text-sm text-gray-400 text-center">
              This platform is part of a Master's thesis research project exploring AI-driven personality insights in workplace settings.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;
