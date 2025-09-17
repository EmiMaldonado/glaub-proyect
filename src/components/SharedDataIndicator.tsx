import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Share2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SharedDataIndicatorProps {
  isShared: boolean;
  label?: string;
  variant?: 'default' | 'subtle' | 'prominent';
  className?: string;
}

const SharedDataIndicator: React.FC<SharedDataIndicatorProps> = ({
  isShared,
  label,
  variant = 'default',
  className
}) => {
  if (variant === 'subtle') {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        isShared ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
        className
      )}>
        {isShared ? (
          <>
            <Eye className="h-3 w-3" />
            <span>Shared with manager</span>
          </>
        ) : (
          <>
            <EyeOff className="h-3 w-3" />
            <span>Private</span>
          </>
        )}
      </div>
    );
  }

  if (variant === 'prominent') {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
        isShared 
          ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
        className
      )}>
        {isShared ? (
          <>
            <Share2 className="h-4 w-4" />
            <span>{label || 'Shared with Manager'}</span>
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            <span>{label || 'Private Data'}</span>
          </>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <Badge 
      variant={isShared ? "default" : "outline"} 
      className={cn(
        "text-xs",
        isShared 
          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
        className
      )}
    >
      {isShared ? (
        <>
          <Eye className="h-3 w-3 mr-1" />
          {label || 'Shared'}
        </>
      ) : (
        <>
          <EyeOff className="h-3 w-3 mr-1" />
          {label || 'Private'}
        </>
      )}
    </Badge>
  );
};

export default SharedDataIndicator;