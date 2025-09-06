import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  Palette,
  Type,
  Eye,
  Layers
} from 'lucide-react';

/**
 * Design System Demo Component
 * 
 * This component showcases the comprehensive backend admin design system.
 * Use this as a reference for implementing consistent UI elements.
 * 
 * FOR BACKEND/ADMIN USE ONLY - Not for end users
 */
export const DesignSystemDemo = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-12">
        
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Backend Admin Design System</h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive design tokens and components for professional admin interfaces
          </p>
        </div>

        {/* Color Palette */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color System
            </CardTitle>
            <CardDescription>
              Professional color palette with semantic meanings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Primary Colors */}
            <div>
              <h3 className="font-semibold mb-3">Primary Brand Colors</h3>
              <div className="grid grid-cols-10 gap-2">
                {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                  <div key={shade} className="space-y-2">
                    <div 
                      className={`h-16 w-full rounded-lg bg-primary-${shade} border`}
                    />
                    <p className="text-xs text-center text-muted-foreground">{shade}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Semantic Colors */}
            <div>
              <h3 className="font-semibold mb-3">Semantic Status Colors</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="h-16 w-full rounded-lg bg-success" />
                  <p className="text-sm font-medium">Success</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 w-full rounded-lg bg-warning" />
                  <p className="text-sm font-medium">Warning</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 w-full rounded-lg bg-error" />
                  <p className="text-sm font-medium">Error</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 w-full rounded-lg bg-info" />
                  <p className="text-sm font-medium">Info</p>
                </div>
              </div>
            </div>

            {/* Gray Scale */}
            <div>
              <h3 className="font-semibold mb-3">Neutral Grays</h3>
              <div className="grid grid-cols-10 gap-2">
                {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                  <div key={shade} className="space-y-2">
                    <div 
                      className={`h-16 w-full rounded-lg bg-gray-${shade} border`}
                    />
                    <p className="text-xs text-center text-muted-foreground">{shade}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography Scale
            </CardTitle>
            <CardDescription>
              Consistent text sizing and weights for admin interfaces
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="text-5xl font-bold">5XL Heading (48px)</div>
              <div className="text-4xl font-bold">4XL Heading (36px)</div>
              <div className="text-3xl font-bold">3XL Heading (30px)</div>
              <div className="text-2xl font-semibold">2XL Heading (24px)</div>
              <div className="text-xl font-semibold">XL Heading (20px)</div>
              <div className="text-lg font-medium">Large Text (18px)</div>
              <div className="text-base font-normal">Base Text (16px)</div>
              <div className="text-sm text-muted-foreground">Small Text (14px)</div>
              <div className="text-xs text-muted-foreground">Extra Small Text (12px)</div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Font Weights</h4>
                <div className="space-y-1 text-sm">
                  <div className="font-thin">Thin (100)</div>
                  <div className="font-light">Light (300)</div>
                  <div className="font-normal">Normal (400)</div>
                  <div className="font-medium">Medium (500)</div>
                  <div className="font-semibold">Semibold (600)</div>
                  <div className="font-bold">Bold (700)</div>
                  <div className="font-extrabold">Extrabold (800)</div>
                  <div className="font-black">Black (900)</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Line Heights</h4>
                <div className="space-y-1 text-sm">
                  <div className="leading-tight">Tight line height</div>
                  <div className="leading-snug">Snug line height</div>
                  <div className="leading-normal">Normal line height</div>
                  <div className="leading-relaxed">Relaxed line height</div>
                  <div className="leading-loose">Loose line height</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shadows */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Shadow System
            </CardTitle>
            <CardDescription>
              Professional shadow styles for depth and hierarchy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-6">
              {['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl'].map((size) => (
                <div key={size} className="space-y-3">
                  <div 
                    className={`h-20 w-full rounded-lg bg-card shadow-${size} border`}
                  />
                  <p className="text-sm text-center font-medium">Shadow {size}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-6 grid grid-cols-4 gap-6">
              <div className="space-y-3">
                <div className="h-20 w-full rounded-lg bg-card shadow-primary border" />
                <p className="text-sm text-center font-medium">Primary Shadow</p>
              </div>
              <div className="space-y-3">
                <div className="h-20 w-full rounded-lg bg-card shadow-success border" />
                <p className="text-sm text-center font-medium">Success Shadow</p>
              </div>
              <div className="space-y-3">
                <div className="h-20 w-full rounded-lg bg-card shadow-warning border" />
                <p className="text-sm text-center font-medium">Warning Shadow</p>
              </div>
              <div className="space-y-3">
                <div className="h-20 w-full rounded-lg bg-card shadow-error border" />
                <p className="text-sm text-center font-medium">Error Shadow</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Components */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Component Examples
            </CardTitle>
            <CardDescription>
              Common admin interface components using the design system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Buttons */}
            <div>
              <h3 className="font-semibold mb-3">Buttons</h3>
              <div className="flex gap-3 flex-wrap">
                <Button variant="default">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            {/* Status Badges */}
            <div>
              <h3 className="font-semibold mb-3">Status Badges</h3>
              <div className="flex gap-3 flex-wrap">
                <Badge className="bg-success text-success-foreground">Active</Badge>
                <Badge className="bg-warning text-warning-foreground">Pending</Badge>
                <Badge className="bg-error text-error-foreground">Error</Badge>
                <Badge className="bg-info text-info-foreground">Info</Badge>
                <Badge variant="secondary">Draft</Badge>
              </div>
            </div>

            {/* Alert Messages */}
            <div>
              <h3 className="font-semibold mb-3">Alert Messages</h3>
              <div className="space-y-4">
                <Alert className="border-success-border bg-success-light">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertTitle className="text-success">Success</AlertTitle>
                  <AlertDescription className="text-success-foreground">
                    Your operation completed successfully.
                  </AlertDescription>
                </Alert>
                
                <Alert className="border-warning-border bg-warning-light">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertTitle className="text-warning">Warning</AlertTitle>
                  <AlertDescription className="text-warning-foreground">
                    Please review this information carefully.
                  </AlertDescription>
                </Alert>
                
                <Alert className="border-error-border bg-error-light">
                  <AlertCircle className="h-4 w-4 text-error" />
                  <AlertTitle className="text-error">Error</AlertTitle>
                  <AlertDescription className="text-error-foreground">
                    Something went wrong. Please try again.
                  </AlertDescription>
                </Alert>
                
                <Alert className="border-info-border bg-info-light">
                  <Info className="h-4 w-4 text-info" />
                  <AlertTitle className="text-info">Information</AlertTitle>
                  <AlertDescription className="text-info-foreground">
                    Here's some helpful information for you.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Guidelines */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Guidelines</CardTitle>
            <CardDescription>
              Best practices for using this design system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <h4 className="font-semibold">Color Usage</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use primary colors for main actions and branding</li>
                <li>Use semantic colors (success, warning, error, info) for status indication</li>
                <li>Use gray scale for neutral elements and text hierarchy</li>
                <li>Always ensure sufficient contrast ratios for accessibility</li>
              </ul>
              
              <h4 className="font-semibold mt-4">Typography</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use consistent font sizes from the scale</li>
                <li>Maintain proper text hierarchy with font weights</li>
                <li>Use appropriate line heights for readability</li>
              </ul>
              
              <h4 className="font-semibold mt-4">Shadows</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use lighter shadows (xs, sm) for subtle elevation</li>
                <li>Use medium shadows (base, md) for cards and modals</li>
                <li>Use stronger shadows (lg, xl, 2xl) for prominent elements</li>
                <li>Use colored shadows sparingly for special emphasis</li>
              </ul>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};