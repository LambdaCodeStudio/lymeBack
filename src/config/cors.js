// Configuración CORS optimizada para Vercel
const corsOptions = {
  origin: function(origin, callback) {
    // Obtener los orígenes permitidos de variables de entorno
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    
    // Permitir solicitudes sin origen (como aplicaciones móviles o Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, verificar contra lista de orígenes permitidos
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    } else {
      return callback(new Error('No permitido por CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control'],
  credentials: true,
  maxAge: 86400, // 24 horas
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Total-Count'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

module.exports = corsOptions;