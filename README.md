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

### Cliente (`clienteSchema.js`)

```javascript
{
  servicio: String,       // Nombre del servicio (entidad padre)
  seccionDelServicio: String,  // Sección específica dentro del servicio
  userId: ObjectId        // Usuario asignado a este cliente
}
```

### Producto (`producto.js`)

```javascript
{
  nombre: String,
  categoria: String,
  stock: Number,
  unidad: String,
  precioUnitario: Number,
  descripcion: String,
  imgUrl: String,
  lastUpdated: Date
}
```

### Orden (`orden.js`)

```javascript
{
  cliente: ObjectId,      // Referencia al cliente
  productos: [{
    producto: ObjectId,   // Referencia al producto
    cantidad: Number
  }],
  estado: String,         // pendiente, en progreso, completada, cancelada
  fechaCreacion: Date,
  fechaEntrega: Date,
  usuarioAsignado: ObjectId,
  notas: String
}
```

## API Endpoints

### Autenticación

- **POST /api/auth/login**: Iniciar sesión
- **POST /api/auth/register**: Registrar usuario (requiere autenticación)
- **POST /api/auth/temporary**: Crear usuario temporal (requiere autenticación)
- **GET /api/auth/me**: Obtener información del usuario actual

### Usuarios

- **GET /api/auth/users**: Obtener todos los usuarios
- **GET /api/auth/users/:id**: Obtener usuario por ID
- **PUT /api/auth/users/:id**: Actualizar usuario
- **DELETE /api/auth/users/:id**: Eliminar usuario
- **PUT /api/auth/users/:id/activate**: Activar usuario
- **PUT /api/auth/users/:id/deactivate**: Desactivar usuario

### Clientes

- **GET /api/cliente**: Obtener todos los clientes
- **GET /api/cliente/sin-asignar**: Obtener clientes sin asignar
- **GET /api/cliente/:id**: Obtener cliente por ID
- **GET /api/cliente/user/:userId**: Obtener clientes por ID de usuario
- **POST /api/cliente**: Crear cliente
- **PUT /api/cliente/:id**: Actualizar cliente
- **DELETE /api/cliente/:id**: Eliminar cliente

### Inventario

- **GET /api/inventario**: Obtener todos los productos
- **GET /api/inventario/:id**: Obtener producto por ID
- **POST /api/inventario**: Crear producto
- **PUT /api/inventario/:id**: Actualizar producto
- **DELETE /api/inventario/:id**: Eliminar producto

### Órdenes

- **GET /api/orden**: Obtener todas las órdenes
- **GET /api/orden/:id**: Obtener orden por ID
- **POST /api/orden**: Crear orden
- **PUT /api/orden/:id**: Actualizar orden
- **DELETE /api/orden/:id**: Eliminar orden

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
   - Puede crear usuarios temporales
   - Gestión limitada de inventario y órdenes

4. **Temporal**:
   - Acceso muy limitado
   - Solo puede ver sus clientes asignados
   - Caducidad automática (por defecto: 30 minutos)

## Características especiales

### Usuarios temporales

Los usuarios temporales están diseñados para accesos puntuales al sistema:

- Se crean con una fecha de expiración (por defecto: 30 minutos)
- Al expirar, se desactivan automáticamente
- Cuando se reactivan, se renueva su tiempo de expiración

### Gestión de clientes sin usuario

Cuando un usuario es eliminado o desactivado:

1. Sus clientes quedan en estado "pendiente de reasignación"
2. El endpoint `/api/cliente/sin-asignar` permite encontrarlos
3. Estos clientes son marcados con una propiedad `requiereAsignacion`
4. Un administrador puede asignarlos a otros usuarios

## Middlewares importantes

- **auth.js**: Verifica la autenticación JWT y los permisos de usuario
- **errorHandler.js**: Manejo centralizado de errores
- **validator.js**: Validación de datos de entrada

## Seguridad

### Contraseñas

- Encriptadas con bcrypt (10 rondas de salt)
- Validación de fuerza de contraseña

### JWT

- Tokens firmados con un secreto único
- Expiración configurable (por defecto: 24 horas)

### Protección de rutas

- Verificación de token en cada petición protegida
- Verificación de roles para accesos específicos

## Contribución

1. Fork del repositorio
2. Crear rama para nueva funcionalidad: `git checkout -b feature/nueva-funcionalidad`
3. Commit de cambios: `git commit -m 'Añadir nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## Licencia

Este proyecto es propiedad intelectual de su creador. Todos los derechos reservados.