import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  return (
    <div className={cn("flex items-center justify-center", sizeClasses[size], className)}>
      <style>{`
        .loader {
          width: 64px;
          height: 48px;
          position: relative;
          animation: split 1s ease-in infinite alternate;
          margin: 0 auto;
        }
        .loader::before, .loader::after {
          content: '';
          position: absolute;
          height: 48px;
          width: 48px;
          border-radius: 50%;
          left: 0;
          top: 0;
          transform: translateX(-10px);
          background: hsl(var(--primary));
          opacity: 0.75;
        }
        .loader::after {
          left: auto;
          right: 0;
          background: transparent;
          transform: translateX(10px);
        }
        @keyframes split {
          0%, 25% { width: 64px; }
          100% { width: 148px; }
        }
      `}</style>
      <div className="loader" />
    </div>
  );
};

export default LoadingSpinner;
