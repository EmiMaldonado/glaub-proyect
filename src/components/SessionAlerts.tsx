import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SessionEndConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

interface NavigationWarningProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export const SessionEndConfirmation: React.FC<SessionEndConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-fade-in">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-lg font-semibold">Ready to wrap up?</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Just a friendly reminder - when you're ready to end this conversation, we'll create personalized insights and recommendations based on our chat today.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Continue Chatting
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1"
          >
            Yes, I'm Ready
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const NavigationWarning: React.FC<NavigationWarningProps> = ({
  isOpen,
  onStay,
  onLeave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onStay} />
      
      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-lg p-6 mx-4 max-w-md w-full animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <h3 className="text-lg font-semibold">Leave session?</h3>
        </div>
        
        <p className="text-muted-foreground mb-6">
          Leaving will end your session and lose current progress. Are you sure you want to continue?
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={onStay}
            className="flex-1"
          >
            Stay
          </Button>
          <Button
            variant="destructive"
            onClick={onLeave}
            className="flex-1"
          >
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
};