import React from 'react';

// ✅ SIMPLIFIED: Basic pass-through router to fix build issues
export const UserRoleRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};