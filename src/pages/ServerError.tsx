import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerCrash, Home, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const ServerError = () => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-medium text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ServerCrash className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Error del Servidor</CardTitle>
          <CardDescription>
            Estamos experimentando problemas técnicos. Nuestro equipo está trabajando para solucionarlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Error 500 - Internal Server Error</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Intentar de Nuevo
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Volver al Inicio
              </Link>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Si el problema persiste, contacta a soporte@glaub.com
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServerError;