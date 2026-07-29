// Código de presença embutido no QR da parede. SERVIDOR APENAS — nunca importar em
// componente cliente (senão vazaria no bundle público). Vem de env CHECKIN_TOKEN.
export function checkinToken() {
  return process.env.CHECKIN_TOKEN || 'LIRA2026-Q7F3K9';
}
