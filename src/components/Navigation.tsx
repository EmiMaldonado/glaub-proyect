import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, MessageCircle, Mic, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  
  return <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" className="h-10 w-auto" />
          </Link>
          
          {/* Hamburger Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMenu}
            className="p-2"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </nav>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="absolute left-0 right-0 top-full bg-background border-b shadow-lg">
            <div className="container mx-auto px-4 py-4 space-y-4">
              {user ? (
                <>
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                      <AvatarFallback>
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="font-medium">{user.user_metadata?.full_name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/conversation" onClick={() => setIsMenuOpen(false)}>
                        Start Conversation
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="w-full justify-start">
                      <Link to="/settings" onClick={() => setIsMenuOpen(false)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:text-destructive" 
                      onClick={() => {
                        handleSignOut();
                        setIsMenuOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log Out
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Button variant="ghost" asChild className="w-full justify-start">
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button variant="default" asChild className="w-full justify-start">
                    <Link to="/auth?mode=signup" onClick={() => setIsMenuOpen(false)}>
                      Start Free
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>;
};
export default Navigation;