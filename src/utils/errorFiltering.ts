/**
 * Error filtering utilities to distinguish between app errors and external script errors
 */

export interface ErrorFilter {
  isExternalError: boolean;
  errorType: 'app' | 'external' | 'browser_extension' | 'tracking_script' | 'cors';
  shouldLog: boolean;
  description: string;
}

export function analyzeError(error: Error | string): ErrorFilter {
  const errorMessage = typeof error === 'string' ? error : error.message?.toLowerCase() || '';
  const errorStack = typeof error === 'string' ? '' : error.stack?.toLowerCase() || '';
  
  // Browser extension patterns
  if (errorMessage.includes('chrome-extension') || 
      errorMessage.includes('moz-extension') ||
      errorMessage.includes('listener indicated an asynchronous response')) {
    return {
      isExternalError: true,
      errorType: 'browser_extension',
      shouldLog: false,
      description: 'Browser extension error - safe to ignore'
    };
  }
  
  // Tracking/Analytics script patterns
  if (errorMessage.includes('google') || 
      errorMessage.includes('gads') || 
      errorMessage.includes('doubleclick') ||
      errorMessage.includes('googleads') ||
      errorMessage.includes('email, phone are mandatory fields')) {
    return {
      isExternalError: true,
      errorType: 'tracking_script',
      shouldLog: false,
      description: 'Third-party tracking script error - safe to ignore'
    };
  }
  
  // CORS/postMessage errors
  if (errorMessage.includes('postmessage') || 
      errorMessage.includes('target origin') || 
      errorMessage.includes('recipient window') ||
      errorMessage.includes('cross-origin')) {
    return {
      isExternalError: true,
      errorType: 'cors',
      shouldLog: false,
      description: 'Cross-origin communication error - likely from external scripts'
    };
  }
  
  // Generic script errors (often from external sources)
  if (errorMessage.includes('script error') || 
      errorMessage.includes('non-same-origin')) {
    return {
      isExternalError: true,
      errorType: 'external',
      shouldLog: false,
      description: 'Generic script error from external source'
    };
  }
  
  // If no external patterns match, treat as app error
  return {
    isExternalError: false,
    errorType: 'app',
    shouldLog: true,
    description: 'Application error - requires attention'
  };
}

export function setupConsoleErrorFiltering() {
  if (typeof window === 'undefined') return;
  
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console.error to filter external script errors
  console.error = (...args: any[]) => {
    const errorStr = args.join(' ');
    const analysis = analyzeError(errorStr);
    
    if (analysis.shouldLog) {
      originalError.apply(console, args);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, show filtered errors as warnings
      originalWarn.apply(console, [`🔍 Filtered ${analysis.errorType}:`, ...args]);
    }
  };
  
  // Global error handler for unhandled errors
  window.addEventListener('error', (event) => {
    const analysis = analyzeError(event.error || event.message);
    
    if (!analysis.shouldLog) {
      event.preventDefault(); // Prevent default error handling for external errors
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🔍 Filtered ${analysis.errorType}: ${analysis.description}`, event);
      }
    }
  });
  
  // Global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const analysis = analyzeError(event.reason);
    
    if (!analysis.shouldLog) {
      event.preventDefault();
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🔍 Filtered promise rejection (${analysis.errorType}): ${analysis.description}`, event);
      }
    }
  });
}

export function setupDevelopmentErrorHelpers() {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
  
  // Add helper function to window for debugging
  (window as any).debugErrors = {
    analyzeError,
    clearConsole: () => console.clear(),
    showOnlyAppErrors: () => {
      console.log('🎯 Showing only application errors. External script errors are filtered.');
    }
  };
  
  console.log('🔧 Development error filtering enabled. Use window.debugErrors for utilities.');
}