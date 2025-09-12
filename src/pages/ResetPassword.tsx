import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [error, setError] = useState("");
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const handleRecoveryFlow = async () => {
      // Check for hash parameters from Supabase recovery flow
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const token = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (!token || type !== 'recovery') {
        setError("No valid reset token provided. Please request a new password reset.");
        setValidToken(false);
        return;
      }
      
      setValidToken(true);
      
      // Set the session with the recovery token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: hashParams.get('refresh_token') || ''
      });
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setError("Invalid or expired reset link. Please request a new one.");
        setValidToken(false);
      }
    };
    
    handleRecoveryFlow();
  }, []);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (password.length > 128) {
      return "Password must be less than 128 characters";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)";
    }
    return null;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      // Use Supabase's built-in updateUser method
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error("Reset password error:", updateError);
        setError(updateError.message || "Failed to update password");
        return;
      }

      setIsUpdated(true);
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated. You can now sign in.",
      });
      
      // Sign out after password reset so user can sign in with new password
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (validToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>
              This reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isUpdated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Password Updated Successfully</CardTitle>
            <CardDescription>
              Your password has been changed. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" className="h-6 w-auto" />
          </Link>
        </div>

        <Card className="shadow-medium">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Create a New Password</CardTitle>
            <CardDescription>
              Create a strong password with at least 8 characters including uppercase, lowercase, numbers, and special characters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
                {password !== confirmPassword && confirmPassword && (
                  <p className="text-sm text-destructive">Passwords don't match</p>
                )}
              </div>
              
              {error && (
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || password !== confirmPassword || validatePassword(password) !== null}
              >
                {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;