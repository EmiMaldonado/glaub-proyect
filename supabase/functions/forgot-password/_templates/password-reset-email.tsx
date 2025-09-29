interface PasswordResetEmailProps {
  resetUrl: string;
  expirationTime: string;
}

export const PasswordResetEmail = ({
  resetUrl,
  expirationTime = "1 hora",
}: PasswordResetEmailProps) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reset Password - Gläub</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="margin: 0 auto; padding: 40px 20px; max-width: 580px;">
          
          <!-- Logo Section -->
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="https://www.glaubinsights.org/glaub-logo.png" alt="Gläub" style="height: 40px; max-width: 200px;" />
            <div style="font-family: Inter, sans-serif; font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #6889B4, #A5C7B9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-top: 8px;">
              Gläub
            </div>
          </div>

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1e293b; font-size: 32px; font-weight: 700; line-height: 1.2; margin: 0 0 16px 0;">
              Reset Password
            </h1>
            <p style="color: #64748b; font-size: 16px; line-height: 1.5; margin: 0;">
              You requested to reset your password. Use the secure link below to create a new password.
            </p>
          </div>

          <!-- Button Section -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #6889B4; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 16px 32px; border: none;">
              Reset My Password
            </a>
          </div>

          <!-- Info Section -->
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
              <strong>Important:</strong> This link will expire in ${expirationTime} for security reasons.
            </p>
            
            <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
              If the button doesn't work, copy and paste this link in your browser:
            </p>
            
            <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; margin: 12px 0; word-break: break-all;">
              <a href="${resetUrl}" style="color: #6889B4; font-size: 12px; text-decoration: none;">
                ${resetUrl}
              </a>
            </div>
          </div>

          <!-- Security Section -->
          <div style="background-color: #fef3cd; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
              🔒 Security Information
            </p>
            <p style="color: #92400e; font-size: 13px; line-height: 1.4; margin: 0;">
              • Only you can use this link<br/>
              • The link will be deactivated after use<br/>
              • If you didn't request this, ignore this email<br/>
              • Your current password remains valid until you change it
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0 0 8px 0;">
              If you have problems or didn't request this change, contact our support.
            </p>
            <p style="color: #374151; font-size: 13px; margin: 0;">
              <strong>Gläub</strong> - Intelligent Conversations Platform
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
};

export default PasswordResetEmail;