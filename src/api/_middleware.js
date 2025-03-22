// api/_middleware.js
// Este archivo es específico para Vercel Edge Functions
// Proporciona middleware a nivel de Edge para mejorar el rendimiento y seguridad
// Optimizado para soportar 10,000 peticiones por minuto

export const config = {
  matcher: '/api/:path*',
  // Optimizar runtime para mejor rendimiento
  runtime: {
    maxDuration: 60, // 60 segundos máximo por función
  }
};

// Lista de rutas que no requieren procesamiento adicional para mejor rendimiento
const BYPASS_ROUTES = [
  '/api/health',
  '/api/downloads'
];

export default function middleware(req) {
  const response = new Response();
  
  // Verificar si es una ruta que debe omitir el procesamiento
  const url = new URL(req.url);
  const shouldBypass = BYPASS_ROUTES.some(route => url.pathname.startsWith(route));
  
  if (shouldBypass) {
    // Para rutas de bypass, solo agregar cabeceras mínimas
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }
  
  // Agregar encabezados de seguridad
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'same-origin');
  
  // Agregar encabezados de caché para mejorar rendimiento (varían por tipo de ruta)
  if (url.pathname.startsWith('/api/producto')) {
    // Productos pueden cachearse por más tiempo al ser menos dinámicos
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  } else if (!url.pathname.includes('/auth/')) {
    // Rutas generales pueden tener un caché corto
    response.headers.set('Cache-Control', 'public, max-age=10, s-maxage=30');
  } else {
    // Rutas de autenticación no se cachean
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  
  // Leer origen de la solicitud
  const origin = req.headers.get('origin');
  
  // Configurar CORS en el borde para respuestas más rápidas
  if (origin) {
    // Permitir solo orígenes específicos en producción
    // Esta es una capa adicional de seguridad sobre la configuración CORS de Express
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    
    if (process.env.NODE_ENV !== 'production' || 
        allowedOrigins.includes(origin) || 
        allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, X-Access-Token');
      // Añadir caché de preflight para reducir OPTIONS requests
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 horas
    }
  }
  
  // Para solicitudes OPTIONS (preflight), responder inmediatamente
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: response.headers,
    });
  }
  
  return response;
}