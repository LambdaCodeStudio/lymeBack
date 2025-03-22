// src/middleware/upload.js
const multer = require('multer');

// Configuración de almacenamiento en memoria para procesamiento
const storage = multer.memoryStorage();

// Filtro más robusto para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  // Lista de tipos MIME de imágenes permitidos
  const allowedMimes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/svg+xml'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Se permiten: ${allowedMimes.join(', ')}`), false);
  }
};

// Configuración de Multer con mejor manejo de errores
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // límite de 5MB
  }
});

module.exports = upload;