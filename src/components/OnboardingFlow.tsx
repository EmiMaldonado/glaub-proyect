import React, { useState } from 'react';
import { Shield, Lock, UserCheck, CheckCircle, Mic, Briefcase, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OnboardingData {
  workArea: string;
  positionLevel: string;
  gender: string;
  privacyConsent: boolean;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    workArea: '',
    positionLevel: '',
    gender: '',
    privacyConsent: false,
  });

  const totalSteps = 4;

  const updateFormData = (field: keyof OnboardingData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStep2Valid = () => {
    return formData.workArea.trim() !== '' && formData.positionLevel !== '' && formData.gender !== '';
  };

  const isStep3Valid = () => {
    return formData.privacyConsent;
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Store data in localStorage
    localStorage.setItem('onboardingData', JSON.stringify(formData));
    onComplete(formData);
  };

  const renderProgressIndicator = () => (
    <div className="flex justify-center mb-8">
      <div className="flex items-center space-x-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <React.Fragment key={i}>
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i + 1 <= currentStep
                  ? 'bg-primary shadow-primary'
                  : 'bg-gray-200'
              }`}
            />
            {i < totalSteps - 1 && (
              <div
                className={`w-8 h-0.5 transition-all duration-300 ${
                  i + 1 < currentStep ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const renderScreen1 = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">Welcome</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Understanding your personality and soft skills
        </p>
        <div className="bg-card border rounded-lg p-6 text-left">
          <p className="text-base text-card-foreground leading-relaxed">
            This platform helps companies and managers understand employee/candidate personality 
            and soft skills through empathetic AI conversations. We generate OCEAN model-based 
            profiles and personalized recommendations for development and motivation. We're 
            focused on human experience. Thank you for trusting us.
          </p>
        </div>
      </div>
      <Button 
        onClick={handleNext}
        size="lg"
        className="w-full sm:w-auto px-8"
      >
        Start
      </Button>
    </div>
  );

  const renderScreen2 = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Personal Information</h2>
        <p className="text-muted-foreground">Help us personalize your experience</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workArea" className="text-sm font-medium">
            Work Area
          </Label>
          <Input
            id="workArea"
            placeholder="e.g., Marketing, Engineering, Sales"
            value={formData.workArea}
            onChange={(e) => updateFormData('workArea', e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="positionLevel" className="text-sm font-medium">
            Position Level
          </Label>
          <Select 
            value={formData.positionLevel} 
            onValueChange={(value) => updateFormData('positionLevel', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select your level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intern">Intern</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="director">Director</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Gender</Label>
          <RadioGroup
            value={formData.gender}
            onValueChange={(value) => updateFormData('gender', value)}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="male" id="male" />
              <Label htmlFor="male" className="text-sm">Male</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="female" id="female" />
              <Label htmlFor="female" className="text-sm">Female</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="other" />
              <Label htmlFor="other" className="text-sm">Other</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="prefer-not-to-answer" id="prefer-not" />
              <Label htmlFor="prefer-not" className="text-sm">Prefer not to answer</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!isStep2Valid()}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderScreen3 = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Your privacy is our priority</h2>
        <p className="text-muted-foreground">We're committed to protecting your data</p>
      </div>

      <div className="grid gap-6 mb-8">
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1">Encrypted conversations</h3>
                <p className="text-sm text-muted-foreground">
                  Everything you share is protected with enterprise-grade encryption
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1">No training</h3>
                <p className="text-sm text-muted-foreground">
                  Your conversations aren't used to train AI models
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-1">Full control</h3>
                <p className="text-sm text-muted-foreground">
                  You decide what to share and can delete your data anytime
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border mb-8">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="privacy-consent"
              checked={formData.privacyConsent}
              onCheckedChange={(checked) => updateFormData('privacyConsent', checked as boolean)}
            />
            <Label
              htmlFor="privacy-consent"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I agree to share my data to generate personalized insights and improve my experience
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={!isStep3Valid()}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderScreen4 = () => (
    <div className="text-center max-w-lg mx-auto">
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success-foreground" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">All set!</h2>
        <p className="text-lg text-muted-foreground">
          You can now start exploring your strengths and development areas
        </p>
      </div>
      
      <Button 
        onClick={handleComplete}
        size="lg"
        className="w-full sm:w-auto px-8"
      >
        Go to Dashboard
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {renderProgressIndicator()}
        
        <div className="transition-all duration-500 ease-in-out">
          {currentStep === 1 && renderScreen1()}
          {currentStep === 2 && renderScreen2()}
          {currentStep === 3 && renderScreen3()}
          {currentStep === 4 && renderScreen4()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;