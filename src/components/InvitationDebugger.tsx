import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle, XCircle, Bug } from 'lucide-react';

const InvitationDebugger: React.FC = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [invitationType, setInvitationType] = useState<'team_join' | 'manager_request'>('manager_request');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const debugInvitation = async () => {
    if (!email || !user) return;
    
    setLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const debug: any = {
        timestamp: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email
        },
        request: {
          email: email.trim(),
          invitationType,
          emailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
          isOwnEmail: email.trim().toLowerCase() === user.email?.toLowerCase()
        }
      };

      // Check user profile and permissions
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      debug.profile = {
        found: !!profile,
        error: profileError?.message,
        canManageTeams: (profile as any)?.can_manage_teams,
        canBeManaged: (profile as any)?.can_be_managed,
        role: profile?.role,
        id: profile?.id
      };

      // Check existing invitations
      const { data: existingInvs, error: existingError } = await supabase
        .from('invitations')
        .select('*')
        .eq('email', email.trim())
        .eq('invitation_type', invitationType);

      debug.existingInvitations = {
        count: existingInvs?.length || 0,
        error: existingError?.message,
        invitations: existingInvs?.map(inv => ({
          id: inv.id,
          status: inv.status,
          created_at: inv.created_at,
          expires_at: inv.expires_at
        }))
      };

      // Check session
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      debug.session = {
        hasSession: !!session.session,
        error: sessionError?.message,
        hasAccessToken: !!session.session?.access_token
      };

      // Try to call the Edge Function
      const requestBody = {
        email: email.trim(),
        invitationType,
        teamId: profile?.id
      };

      debug.edgeFunctionRequest = requestBody;

      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('unified-invitation', {
          body: requestBody,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.access_token}`
          }
        });

        debug.edgeFunctionResponse = {
          success: !edgeError,
          data: edgeData,
          error: edgeError ? {
            name: edgeError.name,
            message: edgeError.message,
            stack: edgeError.stack,
            context: edgeError.context
          } : null
        };

      } catch (edgeErr: any) {
        debug.edgeFunctionResponse = {
          success: false,
          error: {
            name: edgeErr.name,
            message: edgeErr.message,
            stack: edgeErr.stack
          }
        };
      }

      setDebugInfo(debug);

    } catch (err: any) {
      setError(`Debug failed: ${err.message}`);
      console.error('Debug error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === true) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (success === false) return <XCircle className="h-4 w-4 text-red-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Invitation System Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="debug-email">Email to invite</Label>
            <Input
              id="debug-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
          <div>
            <Label htmlFor="debug-type">Invitation Type</Label>
            <select
              id="debug-type"
              value={invitationType}
              onChange={(e) => setInvitationType(e.target.value as any)}
              className="w-full p-2 border rounded"
            >
              <option value="manager_request">Manager Request</option>
              <option value="team_join">Team Join</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={debugInvitation} disabled={loading || !email.trim()}>
              {loading ? 'Debugging...' : 'Debug Invitation'}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {/* Debug Results */}
        {debugInfo && (
          <div className="space-y-4">
            {/* Request Validation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(debugInfo.request.emailValid && !debugInfo.request.isOwnEmail)}
                  Request Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Email Format:</span>
                  <Badge variant={debugInfo.request.emailValid ? 'default' : 'destructive'}>
                    {debugInfo.request.emailValid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Self-Invitation:</span>
                  <Badge variant={debugInfo.request.isOwnEmail ? 'destructive' : 'default'}>
                    {debugInfo.request.isOwnEmail ? 'Yes (Invalid)' : 'No (Valid)'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Invitation Type:</span>
                  <Badge variant="outline">{debugInfo.request.invitationType}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Profile Check */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(debugInfo.profile.found && !debugInfo.profile.error)}
                  User Profile & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Profile Found:</span>
                  <Badge variant={debugInfo.profile.found ? 'default' : 'destructive'}>
                    {debugInfo.profile.found ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {debugInfo.profile.error && (
                  <div className="text-red-600">Error: {debugInfo.profile.error}</div>
                )}
                <div className="flex justify-between">
                  <span>Can Manage Teams:</span>
                  <Badge variant={debugInfo.profile.canManageTeams ? 'default' : 'secondary'}>
                    {String(debugInfo.profile.canManageTeams)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Can Be Managed:</span>
                  <Badge variant={debugInfo.profile.canBeManaged !== false ? 'default' : 'secondary'}>
                    {String(debugInfo.profile.canBeManaged)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Role:</span>
                  <Badge variant="outline">{debugInfo.profile.role || 'N/A'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Existing Invitations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(debugInfo.existingInvitations.count === 0)}
                  Existing Invitations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Count:</span>
                  <Badge variant={debugInfo.existingInvitations.count === 0 ? 'default' : 'destructive'}>
                    {debugInfo.existingInvitations.count}
                  </Badge>
                </div>
                {debugInfo.existingInvitations.invitations?.map((inv: any, idx: number) => (
                  <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                    <div>Status: {inv.status}</div>
                    <div>Created: {new Date(inv.created_at).toLocaleString()}</div>
                    {inv.expires_at && <div>Expires: {new Date(inv.expires_at).toLocaleString()}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Session Check */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(debugInfo.session.hasSession && debugInfo.session.hasAccessToken)}
                  Authentication Session
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Has Session:</span>
                  <Badge variant={debugInfo.session.hasSession ? 'default' : 'destructive'}>
                    {String(debugInfo.session.hasSession)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Has Access Token:</span>
                  <Badge variant={debugInfo.session.hasAccessToken ? 'default' : 'destructive'}>
                    {String(debugInfo.session.hasAccessToken)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Edge Function Response */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(debugInfo.edgeFunctionResponse?.success)}
                  Edge Function Response
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Success:</span>
                  <Badge variant={debugInfo.edgeFunctionResponse?.success ? 'default' : 'destructive'}>
                    {String(debugInfo.edgeFunctionResponse?.success)}
                  </Badge>
                </div>
                
                {debugInfo.edgeFunctionResponse?.error && (
                  <div className="space-y-1">
                    <div className="font-medium text-red-600">Error Details:</div>
                    <div className="p-2 bg-red-50 rounded text-xs">
                      <div><strong>Name:</strong> {debugInfo.edgeFunctionResponse.error.name}</div>
                      <div><strong>Message:</strong> {debugInfo.edgeFunctionResponse.error.message}</div>
                      {debugInfo.edgeFunctionResponse.error.context && (
                        <div className="mt-2">
                          <strong>Context:</strong>
                          <pre className="mt-1 whitespace-pre-wrap">
                            {JSON.stringify(debugInfo.edgeFunctionResponse.error.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {debugInfo.edgeFunctionResponse?.data && (
                  <div className="space-y-1">
                    <div className="font-medium text-green-600">Response Data:</div>
                    <pre className="p-2 bg-green-50 rounded text-xs whitespace-pre-wrap">
                      {JSON.stringify(debugInfo.edgeFunctionResponse.data, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw Debug Data */}
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">View Raw Debug Data</summary>
              <pre className="mt-2 p-4 bg-gray-50 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvitationDebugger;
