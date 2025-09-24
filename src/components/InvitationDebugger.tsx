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
