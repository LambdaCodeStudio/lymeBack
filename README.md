# LymeBack

## Descripción

LymeBack es el backend de la aplicación Lyme, un sistema de gestión para servicios de limpieza y mantenimiento. Esta API RESTful proporciona todas las funcionalidades necesarias para la gestión de usuarios, clientes, inventario y órdenes, con un sistema de autenticación robusto y diferentes niveles de acceso según roles.

## Tecnologías principales

- **Node.js**: Entorno de ejecución para JavaScript
- **Express.js**: Framework web para Node.js
- **MongoDB**: Base de datos NoSQL
- **Mongoose**: ODM para MongoDB
- **JWT**: Autenticación basada en tokens
- **bcrypt.js**: Encriptación de contraseñas
- **ExcelJS**: Generación de reportes en Excel

## Características de seguridad

- ✅ Autenticación JWT
- ✅ Encriptación de contraseñas (bcrypt)
- ✅ Protección contra ataques comunes (XSS, CSRF)
- ✅ Rate limiting para prevenir ataques de fuerza bruta
- ✅ Sanitización y validación de datos
- ✅ Headers de seguridad (Helmet)
- ✅ Configuración CORS
- ✅ Sistema de roles y permisos

## Requisitos previos

- Node.js (v14 o superior)
- MongoDB instalado y en ejecución
- npm o yarn

## Instalación

1. Clonar el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd lymeBack
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (crear archivo `.env` en la raíz):
   ```
   # Server
   PORT=4000
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/lyme
   
   # JWT
   JWT_SECRET=tu_secreto_jwt_aqui
   JWT_EXPIRES_IN=24h
   
   # Admin inicial
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=password_seguro
   ```

## Ejecución

### Modo desarrollo

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

## Estructura del proyecto

```
lymeBack/
├── src/
│   ├── config/           # Configuración (base de datos, etc.)
│   ├── constants/        # Constantes (roles, estados, etc.)
│   ├── controllers/      # Controladores de rutas
│   ├── middleware/       # Middleware personalizado
│   ├── models/           # Modelos de Mongoose
│   ├── routes/           # Definición de rutas
│   ├── services/         # Servicios de negocio
│   ├── utils/            # Utilidades
│   └── index.js          # Punto de entrada
├── .env                  # Variables de entorno
└── package.json          # Dependencias y scripts
```

## Modelos principales

### Usuario (`user.js`)

```javascript
{
  email: String,
  password: String,
  role: String,         // admin, supervisor, basic, temporal
  isActive: Boolean,
  createdBy: ObjectId,  // Referencia al usuario que lo creó
  expiresAt: Date,      // Solo para usuarios temporales
  nombre: String,
  apellido: String,
  celular: String,
  secciones: String     // limpieza, mantenimiento, ambos
}
```

### Cliente (`cliente.js`)

```javascript
{
  servicio: String,       // Nombre del servicio (entidad padre)
  seccionDelServicio: String,  // Sección específica dentro del servicio
  userId: ObjectId,       // Usuario asignado a este cliente
  activo: Boolean         // Estado del cliente
}
```

### Producto (`producto.js`)

```javascript
{
  nombre: String,
  descripcion: String,
  categoria: String,      // limpieza, mantenimiento
  subCategoria: String,   // aerosoles, liquidos, etc.
  precio: Number,
  stock: Number,
  proovedorInfo: String,
  imagen: String,         // Base64 de la imagen
  vendidos: Number,       // Cantidad vendida
  createdAt: Date,
  updatedAt: Date
}
```

### Pedido (`pedido.js`)

```javascript
{
  userId: ObjectId,        // Usuario que realizó el pedido
  servicio: String,        // Servicio asociado
  seccionDelServicio: String,  // Sección específica
  detalle: String,         // Detalles adicionales
  fecha: Date,             // Fecha de creación
  productos: [{
    productoId: ObjectId,  // Referencia al producto
    cantidad: Number,
    nombre: String,
    precio: Number
  }],
  estado: String,          // pendiente, aprobado, rechazado, entregado
  totalPedido: Number      // Monto total
}
```

## Mejoras recientes

### API y rendimiento
- **Optimización de endpoints**: Respuestas más rápidas y eficientes
- **Manejo de errores**: Sistema mejorado para capturar y responder errores

### Productos e inventario
- **Imágenes en productos**: Soporte para almacenar imágenes en base64
- **Subcategorías**: Sistema jerarquizado de categorías y subcategorías
- **Validación de stock**: Comprobación automática en operaciones de pedido

### Pedidos y reportes
- **Descargas en Excel**: Generación de reportes detallados
- **Filtrado avanzado**: Opciones de filtrado por múltiples criterios

## API Endpoints

### Autenticación

- **POST /api/auth/login**: Iniciar sesión
- **POST /api/auth/register**: Registrar usuario (requiere autenticación)
- **GET /api/auth/me**: Obtener información del usuario actual
- **GET /api/auth/users**: Obtener todos los usuarios (admin, supervisor)

### Clientes

- **GET /api/cliente**: Obtener clientes según permisos
- **GET /api/cliente/:id**: Obtener cliente por ID
- **POST /api/cliente**: Crear cliente
- **PUT /api/cliente/:id**: Actualizar cliente
- **DELETE /api/cliente/:id**: Eliminar cliente

### Productos

- **GET /api/producto**: Obtener todos los productos
- **GET /api/producto/:id**: Obtener producto por ID
- **POST /api/producto**: Crear producto
- **PUT /api/producto/:id**: Actualizar producto
- **DELETE /api/producto/:id**: Eliminar producto

### Pedidos

- **GET /api/pedido**: Obtener pedidos según permisos
- **GET /api/pedido/:id**: Obtener pedido por ID
- **POST /api/pedido**: Crear pedido
- **PUT /api/pedido/:id**: Actualizar pedido
- **DELETE /api/pedido/:id**: Eliminar pedido
- **GET /api/pedido/excel**: Generar reporte Excel de pedidos

## Sistema de roles

El sistema utiliza cuatro roles de usuario, cada uno con diferentes niveles de acceso:

1. **Admin**:
   - Acceso completo a todas las funcionalidades
   - Puede crear supervisores, usuarios básicos y temporales
   - Gestión completa de usuarios, clientes, inventario y órdenes

2. **Supervisor**:
   - Puede crear usuarios básicos y temporales
   - Gestión limitada de usuarios
   - Acceso completo a clientes, inventario y órdenes

3. **Básico**:
   - Acceso solo a sus clientes asignados
   - Puede ver y ordenar productos
   - Gestión limitada de inventario y órdenes

4. **Temporal**:
   - Acceso muy limitado
   - Solo puede ver sus clientes asignados
   - Caducidad automática (por defecto: 30 minutos)

## Características especiales

### Gestión de inventario

El sistema incluye características avanzadas para la gestión de inventario:

- **Alertas de stock bajo**: El sistema identifica automáticamente productos con stock bajo
- **Historial de movimientos**: Cada modificación de stock queda registrada
- **Imágenes de producto**: Permite asociar imágenes a los productos
- **Categorización avanzada**: Organización por categorías y subcategorías

### Pedidos y reportes

El módulo de pedidos incluye:

- **Validación automática**: Comprueba disponibilidad de stock
- **Reportes Excel**: Generación de reportes detallados y configurables
- **Filtrado avanzado**: Por cliente, fechas, usuario, estado, etc.
- **Notificaciones**: Aviso automático de pedidos nuevos a administradores

## Seguridad

### Autenticación y autorización

- **JWT**: Tokens firmados con expiración configurable
- **Middleware de autenticación**: Verifica tokens en cada petición
- **Middleware de autorización**: Comprueba permisos según rol
- **Protección de rutas**: Acceso restringido según rol

### Protección de datos

- **Sanitización**: Limpieza de datos de entrada para prevenir inyecciones
- **Validación**: Comprobación de formato y tipo de datos
- **Encriptación**: Contraseñas encriptadas con bcrypt
- **Logs de seguridad**: Registro de intentos fallidos de autenticación

## Pruebas y desarrollo

### Entorno de desarrollo

- **Nodemon**: Reinicio automático en desarrollo
- **dotenv**: Carga de variables de entorno
- **ESLint**: Linting para código consistente

### Endpoints de prueba

Para facilitar el desarrollo, se incluyen algunos endpoints útiles:

- **GET /api/test/health**: Comprobar estado del servidor
- **GET /api/test/db**: Comprobar conexión a base de datos
- **POST /api/test/createAdmin**: Crear usuario administrador inicial

## Contribución

1. Fork del repositorio
2. Crear rama para nueva funcionalidad: `git checkout -b feature/nueva-funcionalidad`
3. Commit de cambios: `git commit -m 'Añadir nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## Licencia

Este proyecto es propiedad intelectual de su creador. Todos los derechos reservados.