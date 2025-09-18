// Testing utilities for Phase 2 components
export const testViewSwitchNavigation = () => {
  console.log('Testing Dashboard View Switch Navigation...');
  
  // Test personal view button
  const personalButton = document.querySelector('[data-testid="personal-view-button"]');
  if (personalButton) {
    console.log('✓ Personal view button found');
  } else {
    console.log('✗ Personal view button not found');
  }
  
  // Test manager view button
  const managerButton = document.querySelector('[data-testid="manager-view-button"]');
  if (managerButton) {
    console.log('✓ Manager view button found');
  } else {
    console.log('✗ Manager view button not found');
  }
  
  // Test breadcrumbs
  const breadcrumbs = document.querySelector('[data-testid="dashboard-breadcrumbs"]');
  if (breadcrumbs) {
    console.log('✓ Breadcrumbs component found');
  } else {
    console.log('✗ Breadcrumbs component not found');
  }
  
  // Test view switch container
  const viewSwitch = document.querySelector('[data-testid="dashboard-view-switch"]');
  if (viewSwitch) {
    console.log('✓ View switch container found');
  } else {
    console.log('✗ View switch container not found');
  }
  
  console.log('View switch navigation test completed.');
};

// Test manager capabilities hook
export const testManagerCapabilities = (capabilities: any) => {
  console.log('Testing Manager Capabilities:', capabilities);
  
  const requiredProps = ['isManager', 'hasTeamMembers', 'canAccessManagerDashboard', 'loading'];
  const missingProps = requiredProps.filter(prop => !(prop in capabilities));
  
  if (missingProps.length === 0) {
    console.log('✓ All required capabilities properties present');
  } else {
    console.log('✗ Missing capabilities properties:', missingProps);
  }
  
  return capabilities;
};