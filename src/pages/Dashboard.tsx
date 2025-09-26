import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useManagerCapabilities } from "@/hooks/useManagerCapabilities";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import ModernManagerDashboard from "@/components/ModernManagerDashboard";
import LoadingSpinner from "@/components/LoadingSpinner";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isManager, canAccessManagerDashboard, loading } = useManagerCapabilities();

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Route to appropriate dashboard based on user capabilities
  if (canAccessManagerDashboard) {
    return <ModernManagerDashboard />;
  } else {
    return <EmployeeDashboard />;
  }
};

export default Dashboard;