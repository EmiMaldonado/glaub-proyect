import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, User, AlertCircle } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface EmployeeProfile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
}

interface AddEmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEmployee: (employeeId: string) => void;
  selectedSlot: number | null;
}

const AddEmployeeModal = ({ open, onOpenChange, onAddEmployee, selectedSlot }: AddEmployeeModalProps) => {
  const [email, setEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [foundUser, setFoundUser] = useState<EmployeeProfile | null>(null);
  const [searched, setSearched] = useState(false);

  const resetModal = () => {
    setEmail("");
    setFoundUser(null);
    setSearched(false);
    setSearchLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetModal();
    }
    onOpenChange(newOpen);
  };

  const searchUserByEmail = async () => {
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    try {
      setSearchLoading(true);
      setFoundUser(null);
      setSearched(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name, avatar_url')
        .eq('email', email.trim())
        .single();

      if (error || !data) {
        setFoundUser(null);
        toast({
          title: "User Not Found",
          description: "No user found with this email address. Make sure they have registered an account first.",
          variant: "destructive"
        });
      } else {
        setFoundUser(data);
        toast({
          title: "User Found",
          description: `Found ${data.display_name || data.full_name || 'user'}`,
        });
      }
    } catch (err) {
      console.error('Error searching for user:', err);
      toast({
        title: "Search Error",
        description: "Failed to search for user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
      setSearched(true);
    }
  };

  const handleAddEmployee = () => {
    if (foundUser) {
      onAddEmployee(foundUser.id);
      resetModal();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !searchLoading) {
      if (foundUser) {
        handleAddEmployee();
      } else {
        searchUserByEmail();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Add Employee to Slot {selectedSlot}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Search Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Employee Email Address</Label>
            <div className="flex space-x-2">
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searchLoading}
                className="flex-1"
              />
              <Button 
                onClick={searchUserByEmail}
                disabled={searchLoading || !email.trim()}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {searchLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searched && !foundUser && !searchLoading && (
            <div className="p-4 bg-error-light border border-error-border rounded-md">
              <div className="flex items-center space-x-2 text-error">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">
                  User not found with email: <strong>{email}</strong>
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure the employee has registered an account first.
              </p>
            </div>
          )}

          {/* Found User Display */}
          {foundUser && (
            <div className="p-4 bg-success-light border border-success-border rounded-md">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={foundUser.avatar_url} alt={foundUser.display_name || foundUser.full_name} />
                  <AvatarFallback className="bg-primary-100 text-primary-600">
                    {(foundUser.display_name || foundUser.full_name || foundUser.email)?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {foundUser.display_name || foundUser.full_name || 'Unknown'}
                  </h3>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-3 w-3 mr-1" />
                    <span>{foundUser.email}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Ready to add
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-3 bg-info-light border border-info-border rounded-md">
            <p className="text-sm text-info-foreground">
              <strong>How to add employees:</strong>
            </p>
            <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal space-y-1">
              <li>Enter the employee's registered email address</li>
              <li>Click search to find their profile</li>
              <li>Confirm to add them to slot {selectedSlot}</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddEmployee}
            disabled={!foundUser || searchLoading}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            Add to Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeModal;