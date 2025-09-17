import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, Calendar, Users, ArrowRight, SkipForward } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface OnboardingData {
  age: number | null;
  gender: string;
  job_position: string;
}

interface OnboardingErrors {
  age?: string;
  gender?: string;
  job_position?: string;
}

const PostRegistrationOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({
    age: null,
    gender: '',
    job_position: ''
  });
  const [errors, setErrors] = useState<OnboardingErrors>({});

  // Common job positions for autocomplete suggestions
  const jobSuggestions = [
    'Software Engineer', 'Product Manager', 'Designer', 'Data Scientist', 'Marketing Manager',
    'Sales Representative', 'HR Manager', 'Finance Analyst', 'Customer Success Manager',
    'Operations Manager', 'Business Analyst', 'Project Manager', 'DevOps Engineer',
    'Quality Assurance', 'Content Writer', 'Social Media Manager', 'Consultant',
    'Teacher', 'Nurse', 'Doctor', 'Lawyer', 'Accountant', 'Student', 'Other'
  ];

  const [jobSuggestionFilter, setJobSuggestionFilter] = useState('');
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);

  const filteredJobSuggestions = jobSuggestions.filter(job =>
    job.toLowerCase().includes(jobSuggestionFilter.toLowerCase())
  );

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking onboarding status:', error);
          toast({
            title: "Error",
            description: "Failed to check onboarding status",
            variant: "destructive"
          });
          return;
        }

        if (profile?.onboarding_completed) {
          // User has already completed onboarding, redirect to dashboard
          navigate('/dashboard');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in checkOnboardingStatus:', error);
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, navigate]);

  const validateForm = (): boolean => {
    const newErrors: OnboardingErrors = {};

    // Job position is required
    if (!formData.job_position.trim()) {
      newErrors.job_position = 'Job position is required';
    }

    // Age validation (optional but if provided, must be valid)
    if (formData.age !== null && (formData.age < 16 || formData.age > 100)) {
      newErrors.age = 'Age must be between 16 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not found. Please try logging in again.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          age: formData.age,
          gender: formData.gender || null,
          job_position: formData.job_position,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Welcome to Gläub!",
        description: "Your profile has been set up successfully.",
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipOptional = async () => {
    if (!user) return;

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          job_position: formData.job_position || 'Not specified',
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Welcome to Gläub!",
        description: "You can update your profile information later in settings.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-foreground mb-2">
              Complete Your Profile
            </CardTitle>
            <p className="text-muted-foreground text-lg">
              Help us personalize your experience with just a few details
            </p>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">
              Step 2 of 2
            </Badge>
            <span className="text-sm text-muted-foreground">Almost there!</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Position - Required */}
            <div className="space-y-2">
              <Label htmlFor="job_position" className="flex items-center gap-2 text-sm font-medium">
                <Briefcase className="h-4 w-4 text-primary" />
                Job Position / Role *
              </Label>
              <div className="relative">
                <Input
                  id="job_position"
                  type="text"
                  placeholder="e.g., Software Engineer, Marketing Manager"
                  value={formData.job_position}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, job_position: e.target.value }));
                    setJobSuggestionFilter(e.target.value);
                    setShowJobSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowJobSuggestions(formData.job_position.length > 0)}
                  onBlur={() => setTimeout(() => setShowJobSuggestions(false), 200)}
                  className={errors.job_position ? 'border-red-500' : ''}
                  required
                />
                
                {/* Job suggestions dropdown */}
                {showJobSuggestions && filteredJobSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredJobSuggestions.slice(0, 8).map((job, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, job_position: job }));
                          setShowJobSuggestions(false);
                        }}
                      >
                        {job}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.job_position && (
                <p className="text-sm text-red-600">{errors.job_position}</p>
              )}
            </div>

            {/* Age - Optional */}
            <div className="space-y-2">
              <Label htmlFor="age" className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                Age (Optional)
              </Label>
              <Select
                value={formData.age?.toString() || ''}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  age: value ? parseInt(value) : null 
                }))}
              >
                <SelectTrigger className={errors.age ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select your age" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  <SelectItem value="">Prefer not to say</SelectItem>
                  {Array.from({ length: 68 }, (_, i) => i + 16).map((age) => (
                    <SelectItem key={age} value={age.toString()}>
                      {age} years old
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.age && (
                <p className="text-sm text-red-600">{errors.age}</p>
              )}
            </div>

            {/* Gender - Optional */}
            <div className="space-y-2">
              <Label htmlFor="gender" className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                Gender (Optional)
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  <SelectItem value="">Prefer not to say</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              
              {formData.job_position.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipOptional}
                  disabled={submitting}
                  className="sm:w-auto"
                >
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip Optional Fields
                </Button>
              )}
            </div>
          </form>

          {/* Privacy Note */}
          <div className="text-center pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Your information is securely stored and used only to enhance your experience. 
              You can update these details anytime in your profile settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostRegistrationOnboarding;