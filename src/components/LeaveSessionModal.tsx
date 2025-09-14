import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface LeaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDelete?: () => void;
}

const LeaveSessionModal: React.FC<LeaveSessionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDelete
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <AlertTriangle className="h-5 w-5" />
            Pause Session?
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Your session will be paused and saved. You can continue this conversation 
            later from the dashboard whenever you're ready.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your conversation progress will be saved and you can resume exactly where you left off from the dashboard.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete conversation
            </Button>
          )}
          <Button 
            variant="secondary" 
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Pause session & continue later
          </Button>
          <Button variant="outline" onClick={onClose}>
            Continue session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveSessionModal;