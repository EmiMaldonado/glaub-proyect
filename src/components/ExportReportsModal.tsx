import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Download, 
  FileText, 
  BarChart3, 
  Users, 
  Calendar as CalendarIcon,
  Filter,
  Check
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExportReportsModalProps {
  teamMembers: Array<{ id: string; name: string; email: string }>;
  onExport: (exportConfig: ExportConfig) => Promise<void>;
  children: React.ReactNode;
}

interface ExportConfig {
  reportType: 'individual' | 'team' | 'comparative';
  format: 'pdf' | 'csv' | 'json';
  dateRange: { start: Date; end: Date };
  selectedMembers: string[];
  includeMetrics: {
    sessions: boolean;
    engagement: boolean;
    insights: boolean;
    oceanProfile: boolean;
    trends: boolean;
  };
}

const ExportReportsModal: React.FC<ExportReportsModalProps> = ({ 
  teamMembers, 
  onExport, 
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    reportType: 'team',
    format: 'pdf',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    },
    selectedMembers: teamMembers.map(m => m.id),
    includeMetrics: {
      sessions: true,
      engagement: true,
      insights: true,
      oceanProfile: false,
      trends: true
    }
  });

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    setExportConfig(prev => ({
      ...prev,
      selectedMembers: checked 
        ? [...prev.selectedMembers, memberId]
        : prev.selectedMembers.filter(id => id !== memberId)
    }));
  };

  const handleMetricToggle = (metric: keyof ExportConfig['includeMetrics'], checked: boolean) => {
    setExportConfig(prev => ({
      ...prev,
      includeMetrics: {
        ...prev.includeMetrics,
        [metric]: checked
      }
    }));
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await onExport(exportConfig);
      toast({
        title: "Export Successful",
        description: "Your report has been generated and downloaded.",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error generating your report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypeOptions = [
    { value: 'individual', label: 'Individual Reports', description: 'Separate report for each team member' },
    { value: 'team', label: 'Team Overview', description: 'Aggregated team analytics and insights' },
    { value: 'comparative', label: 'Comparative Analysis', description: 'Side-by-side member comparison' }
  ];

  const formatOptions = [
    { value: 'pdf', label: 'PDF Document', icon: FileText },
    { value: 'csv', label: 'CSV Spreadsheet', icon: BarChart3 },
    { value: 'json', label: 'JSON Data', icon: FileText }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Team Reports
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Report Type</label>
            <Select value={exportConfig.reportType} onValueChange={(value: any) => 
              setExportConfig(prev => ({ ...prev, reportType: value }))
            }>
              <SelectTrigger className="bg-background border border-border">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {reportTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-accent">
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((format) => {
                const Icon = format.icon;
                return (
                  <Button
                    key={format.value}
                    variant={exportConfig.format === format.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportConfig(prev => ({ ...prev, format: format.value as any }))}
                    className="flex items-center gap-2 p-3 h-auto"
                  >
                    <Icon className="h-4 w-4" />
                    <div className="text-left">
                      <p className="text-xs font-medium">{format.label}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Date Range</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start bg-background">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {exportConfig.dateRange.start.toLocaleDateString()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border border-border shadow-lg z-50">
                  <Calendar
                    mode="single"
                    selected={exportConfig.dateRange.start}
                    onSelect={(date) => date && setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: date }
                    }))}
                  />
                </PopoverContent>
              </Popover>
              
              <span className="flex items-center text-muted-foreground">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start bg-background">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {exportConfig.dateRange.end.toLocaleDateString()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border border-border shadow-lg z-50">
                  <Calendar
                    mode="single"
                    selected={exportConfig.dateRange.end}
                    onSelect={(date) => date && setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: date }
                    }))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Team Member Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Team Members</label>
            <div className="space-y-2 max-h-32 overflow-y-auto border border-border rounded-md p-3 bg-muted/30">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={member.id}
                    checked={exportConfig.selectedMembers.includes(member.id)}
                    onCheckedChange={(checked) => handleMemberToggle(member.id, checked as boolean)}
                  />
                  <label htmlFor={member.id} className="text-sm flex-1 cursor-pointer">
                    {member.name}
                    <span className="text-xs text-muted-foreground ml-2">({member.email})</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportConfig(prev => ({ 
                  ...prev, 
                  selectedMembers: teamMembers.map(m => m.id) 
                }))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportConfig(prev => ({ 
                  ...prev, 
                  selectedMembers: [] 
                }))}
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Metrics to Include */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Include Metrics</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(exportConfig.includeMetrics).map(([metric, included]) => (
                <div key={metric} className="flex items-center space-x-2">
                  <Checkbox
                    id={`metric-${metric}`}
                    checked={included}
                    onCheckedChange={(checked) => 
                      handleMetricToggle(metric as keyof ExportConfig['includeMetrics'], checked as boolean)
                    }
                  />
                  <label htmlFor={`metric-${metric}`} className="text-sm capitalize cursor-pointer">
                    {metric.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Export Summary */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="font-medium text-sm mb-2">Export Summary</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Type: {reportTypeOptions.find(r => r.value === exportConfig.reportType)?.label}</p>
              <p>Format: {formatOptions.find(f => f.value === exportConfig.format)?.label}</p>
              <p>Members: {exportConfig.selectedMembers.length} selected</p>
              <p>Period: {exportConfig.dateRange.start.toLocaleDateString()} - {exportConfig.dateRange.end.toLocaleDateString()}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleExport}
              disabled={isExporting || exportConfig.selectedMembers.length === 0}
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportReportsModal;