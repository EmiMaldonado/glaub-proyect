import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Invitation {
  id: string;
  manager_id: string;
  status: string;
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface UseUnifiedInvitationsReturn {
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useUnifiedInvitations = (): UseUnifiedInvitationsReturn => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestInProgress, setRequestInProgress] = useState(false);

  // ✅ FUNCIÓN SIN DEPENDENCIAS CIRCULARES
  const fetchInvitations = useCallback(async () => {
    // Prevenir múltiples requests simultáneos
    if (requestInProgress) {
      console.log('Request already in progress, skipping...');
      return;
    }

    try {
      setRequestInProgress(true);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .limit(50) // Limitar resultados para evitar sobrecarga
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      setRequestInProgress(false);
    }
  }, []); // ✅ SIN DEPENDENCIAS CIRCULARES

  // ✅ EJECUTAR SOLO UNA VEZ AL MONTAR
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    loading,
    error,
    refetch: fetchInvitations
  };
};
