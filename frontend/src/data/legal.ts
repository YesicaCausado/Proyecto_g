/**
 * Ruta única de la Política de Privacidad. La usan la landing, la interfaz del
 * estudiante y el modal de consentimiento: todos llevan a la misma página
 * (pages/legal/PrivacyPolicyPage.tsx). Se mantiene aparte de la página para no
 * cargarla en cada pantalla que solo necesita el enlace.
 */
export const PRIVACY_POLICY_PATH = '/politica-de-privacidad';
