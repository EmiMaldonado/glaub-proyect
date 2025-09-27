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
        <title>Restablecer Contraseña - Gläub</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="margin: 0 auto; padding: 40px 20px; max-width: 580px;">
          
          <!-- Logo Section -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="font-family: Inter, sans-serif; font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #6889B4, #A5C7B9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
              Gläub
            </div>
          </div>

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1e293b; font-size: 32px; font-weight: 700; line-height: 1.2; margin: 0 0 16px 0;">
              Restablecer Contraseña
            </h1>
            <p style="color: #64748b; font-size: 16px; line-height: 1.5; margin: 0;">
              Has solicitado restablecer tu contraseña. Usa el enlace seguro de abajo para crear una nueva contraseña.
            </p>
          </div>

          <!-- Button Section -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #6889B4; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 16px 32px; border: none;">
              Restablecer Mi Contraseña
            </a>
          </div>

          <!-- Info Section -->
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
              <strong>Importante:</strong> Este enlace expirará en ${expirationTime} por motivos de seguridad.
            </p>
            
            <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
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
              🔒 Información de Seguridad
            </p>
            <p style="color: #92400e; font-size: 13px; line-height: 1.4; margin: 0;">
              • Solo tú puedes usar este enlace<br/>
              • El enlace se desactivará después de usar<br/>
              • Si no solicitaste esto, ignora este email<br/>
              • Tu contraseña actual sigue siendo válida hasta que la cambies
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0 0 8px 0;">
              Si tienes problemas o no solicitaste este cambio, contacta nuestro soporte.
            </p>
            <p style="color: #374151; font-size: 13px; margin: 0;">
              <strong>Gläub</strong> - Plataforma de Conversaciones Inteligentes
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
};

export default PasswordResetEmail;