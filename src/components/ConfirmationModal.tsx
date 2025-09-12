import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Send, User, UserCheck, FileText, CheckCircle, Target } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    recipient: 'user' | 'manager';
    categories: string[];
    additionalNotes?: string;
  }) => void;
  categorizedSummary: {
    insights: string[];
    summary: string[];
    strengths: string[];
    followUp: string[];
  };
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  categorizedSummary
}) => {
  const [recipient, setRecipient] = useState<'user' | 'manager'>('user');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['insights', 'summary', 'strengths', 'followUp']);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const categories = [
    {
      id: 'insights',
      label: 'Insights Terapéuticos',
      description: 'Descubrimientos y revelaciones de la sesión',
      icon: User,
      count: categorizedSummary?.insights?.length || 0,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      id: 'summary',
      label: 'Resumen de Conversación',
      description: 'Puntos principales discutidos',
      icon: FileText,
      count: categorizedSummary?.summary?.length || 0,
      color: 'text-green-600 bg-green-50 border-green-200'
    },
    {
      id: 'strengths',
      label: 'Puntos Fuertes',
      description: 'Fortalezas identificadas del paciente',
      icon: CheckCircle,
      count: categorizedSummary?.strengths?.length || 0,
      color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      id: 'followUp',
      label: 'Plan de Seguimiento',
      description: 'Recomendaciones y próximos pasos',
      icon: Target,
      count: categorizedSummary?.followUp?.length || 0,
      color: 'text-orange-600 bg-orange-50 border-orange-200'
    }
  ];

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleConfirm = () => {
    console.log('Sending summary with:', { recipient, categories: selectedCategories, additionalNotes });
    onConfirm({
      recipient,
      categories: selectedCategories,
      additionalNotes: additionalNotes.trim() || undefined
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Resumen de Sesión
          </DialogTitle>
          <DialogDescription>
            Configura cómo deseas enviar el resumen de tu sesión terapéutica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">¿A quién deseas enviar el resumen?</Label>
            <RadioGroup value={recipient} onValueChange={(value) => setRecipient(value as 'user' | 'manager')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="user" id="user" />
                <Label htmlFor="user" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Solo para mí (copia personal)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manager" id="manager" />
                <Label htmlFor="manager" className="flex items-center gap-2 cursor-pointer">
                  <UserCheck className="h-4 w-4" />
                  A mi terapeuta/manager
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">¿Qué secciones deseas incluir?</Label>
            <div className="grid grid-cols-1 gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategories.includes(category.id);
                
                return (
                  <Card 
                    key={category.id} 
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected ? category.color : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleCategoryToggle(category.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={isSelected}
                        onChange={() => handleCategoryToggle(category.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{category.label}</span>
                          <span className="text-xs text-muted-foreground">
                            ({category.count} elementos)
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notas adicionales (opcional)
            </Label>
            <Textarea
              id="notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Añade cualquier contexto adicional o comentarios que consideres importantes..."
              className="min-h-[80px]"
            />
          </div>

          {/* Summary Preview */}
          <Card className="p-4 bg-muted/30">
            <div className="text-xs text-muted-foreground">
              <strong>Vista previa del envío:</strong>
              <br />
              Destinatario: {recipient === 'user' ? 'Solo para ti' : 'Terapeuta/Manager'}
              <br />
              Secciones: {selectedCategories.length} de {categories.length} seleccionadas
              {additionalNotes && (
                <>
                  <br />
                  Notas adicionales: Incluidas
                </>
              )}
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedCategories.length === 0}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Enviar Resumen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;