// api/_middleware.js
// Este archivo es específico para Vercel Edge Functions
// Proporciona middleware a nivel de Edge para mejorar el rendimiento y seguridad

export const config = {
    matcher: '/api/:path*',
  };
  
  export default function middleware(req) {
    const response = new Response();
    
    // Agregar encabezados de seguridad
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'same-origin');
    
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
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
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