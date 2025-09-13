import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthGuard from "@/components/AuthGuard";
import Navigation from "@/components/Navigation";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";
import ChatConversation from "./pages/ChatConversation";
import VoiceConversation from "./pages/VoiceConversation";
import VoiceAssistant from "./pages/VoiceAssistant";

import SessionRecap from "./pages/SessionRecap";
import SessionSummary from "./pages/SessionSummary";
import ConversationSelector from "./pages/ConversationSelector";
import ResetPassword from "./pages/ResetPassword";
import OnboardingFlow from "@/components/OnboardingFlow";

const queryClient = new QueryClient();

// Separate component to use useNavigate hook
const OnboardingRoute = () => {
  const navigate = useNavigate();
  
  return (
    <AuthGuard>
      <OnboardingFlow onComplete={(data) => {
        console.log('Onboarding completed with data:', data);
        navigate('/dashboard');
      }} />
    </AuthGuard>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <div className="min-h-screen bg-gradient-subtle">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={
                  <>
                    <Navigation />
                    <Index />
                  </>
                } />
                <Route path="/auth" element={
                  <AuthGuard requireAuth={false}>
                    <Auth />
                  </AuthGuard>
                } />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/voice-assistant" element={<VoiceAssistant />} />
                <Route path="/500" element={<ServerError />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={
                  <AuthGuard>
                    <Navigation />
                    <Dashboard />
                  </AuthGuard>
                } />
                <Route path="/conversation" element={
                  <AuthGuard>
                    <ConversationSelector />
                  </AuthGuard>
                } />
                <Route path="/conversation/chat" element={
                  <AuthGuard>
                    <ChatConversation />
                  </AuthGuard>
                } />
                <Route path="/conversation/voice" element={
                  <AuthGuard>
                    <VoiceConversation />
                  </AuthGuard>
                } />
                <Route path="/session-summary" element={
                  <AuthGuard>
                    <SessionSummary />
                  </AuthGuard>
                } />
                <Route path="/history" element={
                  <AuthGuard>
                    <Navigation />
                    <div className="container mx-auto px-4 py-8">
                      <h1 className="text-2xl font-bold">History</h1>
                      <p>This functionality will be implemented in the next level.</p>
                    </div>
                  </AuthGuard>
                } />
                <Route path="/onboarding" element={<OnboardingRoute />} />
                <Route path="/session-recap" element={
                  <AuthGuard>
                    <SessionRecap />
                  </AuthGuard>
                } />
                <Route path="/settings" element={
                  <AuthGuard>
                    <Navigation />
                    <div className="container mx-auto px-4 py-8">
                      <h1 className="text-2xl font-bold">Settings</h1>
                      <p>This functionality will be implemented in the next level.</p>
                    </div>
                  </AuthGuard>
                } />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
