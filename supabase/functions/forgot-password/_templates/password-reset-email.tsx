import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface PasswordResetEmailProps {
  resetUrl: string;
  expirationTime: string;
}

export const PasswordResetEmail = ({
  resetUrl,
  expirationTime = "1 hora",
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Restablecer contraseña - Gläub</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoContainer}>
          <svg viewBox="0 0 120 40" style={logo}>
            <defs>
              <linearGradient id="colorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#6889B4', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#A5C7B9', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <text x="10" y="28" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="700" fill="url(#colorGradient)">Gläub</text>
          </svg>
        </Section>

        <Section style={header}>
          <Heading style={h1}>Restablecer Contraseña</Heading>
          <Text style={subtitle}>
            Has solicitado restablecer tu contraseña. Usa el enlace seguro de abajo para crear una nueva contraseña.
          </Text>
        </Section>

        <Section style={buttonContainer}>
          <Button href={resetUrl} style={button}>
            Restablecer Mi Contraseña
          </Button>
        </Section>

        <Section style={infoSection}>
          <Text style={infoText}>
            <strong>Importante:</strong> Este enlace expirará en {expirationTime} por motivos de seguridad.
          </Text>
          
          <Text style={infoText}>
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </Text>
          
          <Text style={linkText}>
            <Link href={resetUrl} style={link}>
              {resetUrl}
            </Link>
          </Text>
        </Section>

        <Section style={securitySection}>
          <Text style={securityTitle}>🔒 Información de Seguridad</Text>
          <Text style={securityText}>
            • Solo tú puedes usar este enlace<br/>
            • El enlace se desactivará después de usar<br/>
            • Si no solicitaste esto, ignora este email<br/>
            • Tu contraseña actual sigue siendo válida hasta que la cambies
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            Si tienes problemas o no solicitaste este cambio, contacta nuestro soporte.
          </Text>
          <Text style={footerBrand}>
            <strong>Gläub</strong> - Plataforma de Conversaciones Inteligentes
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail

// Styles
const main = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
}

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const logo = {
  width: '120px',
  height: '40px',
  margin: '0 auto',
}

const header = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const h1 = {
  color: '#1e293b',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '1.2',
  margin: '0 0 16px 0',
}

const subtitle = {
  color: '#64748b',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#6889B4',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  border: 'none',
  cursor: 'pointer',
}

const infoSection = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const infoText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px 0',
}

const linkText = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  padding: '12px',
  margin: '12px 0',
  wordBreak: 'break-all' as const,
}

const link = {
  color: '#6889B4',
  fontSize: '12px',
  textDecoration: 'none',
}

const securitySection = {
  backgroundColor: '#fef3cd',
  border: '1px solid #fbbf24',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const securityTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
}

const securityText = {
  color: '#92400e',
  fontSize: '13px',
  lineHeight: '1.4',
  margin: '0',
}

const footer = {
  textAlign: 'center' as const,
  marginTop: '40px',
  paddingTop: '24px',
  borderTop: '1px solid #e2e8f0',
}

const footerText = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '1.4',
  margin: '0 0 8px 0',
}

const footerBrand = {
  color: '#374151',
  fontSize: '13px',
  margin: '0',
}