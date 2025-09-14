import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send } from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, message?: string) => void;
  managerProfile: any;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  managerProfile
}) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Creating invitation for:', email.trim());
      
      // Create invitation in database
      const token = crypto.randomUUID();
      const { data: invitation, error } = await supabase
        .from('invitations')
        .insert({
          manager_id: managerProfile.id,
          email: email.trim(),
          status: 'pending',
          token: token
        })
        .select('token')
        .single();

      if (error) {
        console.error('Error creating invitation:', error);
        
        // Check for duplicate invitation
        if (error.code === '23505') { // unique_violation
          toast({
            title: "Invitation already exists",
            description: "An invitation has already been sent to this email address",
            variant: "destructive",
          });
          return;
        }
        
        throw error;
      }

      // Generate invitation URL
      const invitationUrl = `${window.location.origin}/invitation/${invitation.token}`;
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(invitationUrl);
        
        toast({
          title: "Invitation Created!",
          description: `Invitation URL has been copied to clipboard. Share it with ${email.trim()} to join your team.`,
        });
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
        toast({
          title: "Invitation Created!",
          description: `Invitation has been created for ${email.trim()}. Please share the invitation URL with them.`,
        });
      }

      // Call parent handler
      onInvite(email.trim(), message.trim() || undefined);
      
      // Reset form
      setEmail('');
      setMessage('');
      onClose();
      
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({
        title: "Error creating invitation",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. The person will receive a link to accept or decline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal note to your invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Creating...' : 'Send Invitation'}
            </Button>
          </div>
        </form>

        <div className="text-sm text-muted-foreground mt-4">
          <p>
            <strong>Team:</strong> {managerProfile?.team_name || `${managerProfile?.display_name || managerProfile?.full_name}'s Team`}
          </p>
          <p className="mt-1">
            The invitation link will be copied to your clipboard. You can then share it via email, 
            messaging, or any other communication method.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberModal;