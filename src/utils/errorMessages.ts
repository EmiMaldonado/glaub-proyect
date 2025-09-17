/**
 * Comprehensive Error Message Dictionary
 * Centralized English error messages for consistent user experience
 */

export const ERROR_MESSAGES = {
  // Authentication Errors
  AUTH: {
    INVALID_CREDENTIALS: {
      title: "Invalid Credentials",
      description: "Incorrect email or password. Please check your credentials and try again."
    },
    LOGIN_ERROR: {
      title: "Login Error", 
      description: "Failed to sign in. Please try again."
    },
    REGISTRATION_ERROR: {
      title: "Registration Error",
      description: "Failed to create account. Please try again."
    },
    SIGNUP_FAILED: {
      title: "Sign Up Failed",
      description: "Could not create your account. Please try again."
    },
    PASSWORD_RESET_ERROR: {
      title: "Password Reset Error",
      description: "Failed to send password reset email. Please try again."
    },
    EMAIL_CONFIRMATION_ERROR: {
      title: "Email Confirmation Error", 
      description: "Failed to confirm email address. Please try again."
    },
    SESSION_EXPIRED: {
      title: "Session Expired",
      description: "Your session has expired. Please sign in again."
    },
    ACCESS_DENIED: {
      title: "Access Denied",
      description: "You don't have permission to access this resource."
    }
  },

  // Audio/Voice Errors
  AUDIO: {
    PLAYBACK_ERROR: {
      title: "Playback Error",
      description: "Could not play audio. Please try again."
    },
    RECORDING_ERROR: {
      title: "Recording Error", 
      description: "Could not start recording. Please check microphone permissions."
    },
    MICROPHONE_ERROR: {
      title: "Microphone Error",
      description: "Microphone access required for voice features."
    },
    PROCESSING_ERROR: {
      title: "Processing Error",
      description: "Could not process your voice message. Please try again."
    },
    VOICE_SYNTHESIS_ERROR: {
      title: "Voice Synthesis Error",
      description: "Could not convert text to speech. Please try again."
    }
  },

  // Data/API Errors  
  DATA: {
    LOAD_ERROR: {
      title: "Loading Error",
      description: "Failed to load data. Please refresh and try again."
    },
    SAVE_ERROR: {
      title: "Save Error", 
      description: "Could not save changes. Please try again."
    },
    DELETE_ERROR: {
      title: "Delete Error",
      description: "Could not delete item. Please try again."
    },
    UPDATE_ERROR: {
      title: "Update Error",
      description: "Failed to update information. Please try again."
    },
    NETWORK_ERROR: {
      title: "Network Error",
      description: "Connection failed. Please check your internet and try again."
    },
    SERVER_ERROR: {
      title: "Server Error", 
      description: "Server is temporarily unavailable. Please try again later."
    }
  },

  // Conversation Errors
  CONVERSATION: {
    DELETE_ERROR: {
      title: "Delete Error",
      description: "Could not delete conversation. Please try again."
    },
    SEND_ERROR: {
      title: "Send Error",
      description: "Could not send message. Please try again."
    },
    LOAD_ERROR: {
      title: "Loading Error", 
      description: "Failed to load conversation. Please refresh and try again."
    }
  },

  // Team Management Errors
  TEAM: {
    INVITATION_ERROR: {
      title: "Invitation Error",
      description: "Failed to send invitation. Please try again."
    },
    MEMBER_REMOVE_ERROR: {
      title: "Remove Member Error",
      description: "Could not remove team member. Please try again."
    },
    LEAVE_TEAM_ERROR: {
      title: "Leave Team Error", 
      description: "Failed to leave team. Please try again."
    },
    UPDATE_TEAM_ERROR: {
      title: "Update Team Error",
      description: "Could not update team information. Please try again."
    }
  },

  // Form Validation Errors
  VALIDATION: {
    EMAIL_REQUIRED: {
      title: "Email Required",
      description: "Please enter a valid email address."
    },
    EMAIL_INVALID: {
      title: "Invalid Email",
      description: "Please enter a valid email address format."
    },
    PASSWORD_REQUIRED: {
      title: "Password Required", 
      description: "Please enter a password."
    },
    FIELDS_REQUIRED: {
      title: "Required Fields",
      description: "Please fill in all required fields."
    }
  },

  // General Errors
  GENERAL: {
    UNEXPECTED_ERROR: {
      title: "Unexpected Error",
      description: "An unexpected error occurred. Please try again."
    },
    FEATURE_UNAVAILABLE: {
      title: "Feature Unavailable",
      description: "This feature is temporarily unavailable. Please try again later."
    },
    PERMISSION_DENIED: {
      title: "Permission Denied", 
      description: "You don't have permission to perform this action."
    },
    TIMEOUT_ERROR: {
      title: "Request Timeout",
      description: "The request took too long. Please try again."
    }
  }
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: {
      title: "Welcome!",
      description: "You have successfully signed in."
    },
    LOGOUT_SUCCESS: {
      title: "Signed Out", 
      description: "You have been successfully signed out."
    },
    REGISTRATION_SUCCESS: {
      title: "Account Created",
      description: "Your account has been created successfully."
    },
    EMAIL_CONFIRMED: {
      title: "Email Confirmed",
      description: "Your email address has been verified."
    }
  },
  
  CONVERSATION: {
    MESSAGE_SENT: {
      title: "Message Sent",
      description: "Your message has been sent successfully."
    },
    CONVERSATION_DELETED: {
      title: "Conversation Deleted", 
      description: "All conversation information has been removed."
    },
    SUMMARY_SENT: {
      title: "📧 Summary Sent",
      description: "Summary sent successfully."
    }
  },

  TEAM: {
    INVITATION_SENT: {
      title: "Invitation Sent!",
      description: "Team invitation has been sent successfully."
    },
    MEMBER_ADDED: {
      title: "Member Added",
      description: "Team member has been added successfully."
    },
    TEAM_UPDATED: {
      title: "Team Updated",
      description: "Team information has been updated successfully."
    }
  }
} as const;

// Helper function to get error message
export const getErrorMessage = (category: keyof typeof ERROR_MESSAGES, key: string) => {
  const categoryMessages = ERROR_MESSAGES[category] as any;
  return categoryMessages[key] || ERROR_MESSAGES.GENERAL.UNEXPECTED_ERROR;
};

// Helper function to get success message  
export const getSuccessMessage = (category: keyof typeof SUCCESS_MESSAGES, key: string) => {
  const categoryMessages = SUCCESS_MESSAGES[category] as any;
  return categoryMessages[key] || { title: "Success", description: "Operation completed successfully." };
};