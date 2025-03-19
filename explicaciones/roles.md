# Documentación API de Autenticación y Usuarios

## Base URL
```
http://localhost:4000/api
```

## Endpoints

### 1. Login
```javascript
POST api/auth/login
Content-Type: application/json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}

// Respuesta exitosa (200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "admin" // o "supervisor", "basic", "temporal"
}
```

### 2. Registro de Usuarios
Requiere token de autenticación y permisos según el rol.

```javascript
POST api/auth/register
Authorization: Bearer {token}
Content-Type: application/json
{
  "email": "nuevo@ejemplo.com",
  "password": "contraseña123",
  "role": "supervisor" // o "basic"
}

// Respuesta exitosa (200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Crear Usuario Temporal
```javascript
POST api/auth/temporary
Authorization: Bearer {token}
Content-Type: application/json
{
  "email": "temporal@ejemplo.com",
  "password": "contraseña123"
}

// Respuesta exitosa (200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-02-21T15:30:00.000Z"
}
```

### 4. Obtener Información del Usuario Actual
```javascript
GET api/auth/me
Authorization: Bearer {token}

// Respuesta exitosa (200)
{
  "id": "5f9d88b9b7b6c40017a8d5d1",
  "email": "usuario@ejemplo.com",
  "role": "admin",
  "expiresAt": "2024-02-21T15:30:00.000Z" // solo para usuarios temporales
}
```

## Permisos por Rol

### ADMIN puede:
- Crear usuarios SUPERVISOR
- Crear usuarios BASICO
- Crear usuarios TEMPORAL

### SUPERVISOR puede:
- Crear usuarios BASICO
- Crear usuarios TEMPORAL

### BASICO puede:
- Crear usuarios TEMPORAL

### TEMPORAL:
- No puede crear usuarios
- Expira después de 30 minutos
- Tiene las mismas capacidades que BASICO mientras está activo

## Manejo de Errores

```javascript
// Error de autenticación (401)
{
  "msg": "No hay token" | "Token inválido" | "Usuario temporal expirado"
}

// Error de permisos (403)
{
  "msg": "No tienes permisos para crear este tipo de usuario"
}

// Error de validación (400)
{
  "error": "Mensaje de error específico"
}
```

## Ejemplos de Uso

### 1. Login como Admin
```javascript
const loginAdmin = async () => {
  try {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@ejemplo.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.error);
    
    // Guardar token
    localStorage.setItem('token', data.token);
    localStorage.setItem('userRole', data.role);
    
    return data;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
};
```

### 2. Crear Supervisor (como Admin)
```javascript
const createSupervisor = async (supervisorData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:4000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...supervisorData,
        role: 'supervisor'
      })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.error);
    
    return data;
  } catch (error) {
    console.error('Error creando supervisor:', error);
    throw error;
  }
};
```

### 3. Crear Usuario Temporal (como Basic)
```javascript
const createTemporary = async (userData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:4000/api/auth/temporary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.error);
    
    return data;
  } catch (error) {
    console.error('Error creando usuario temporal:', error);
    throw error;
  }
};
```

### 4. Verificar Usuario Actual
```javascript
const checkCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:4000/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (!response.ok) {
      // Si es un error de token expirado, limpiar localStorage
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
      }
      throw new Error(data.msg || data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Error verificando usuario:', error);
    throw error;
  }
};
```

## Notas Importantes

1. **Almacenamiento de Token**:
   - Guardar el token en localStorage después del login
   - Eliminar el token al cerrar sesión o cuando expire

2. **Manejo de Usuarios Temporales**:
   - Verificar la fecha de expiración
   - Implementar lógica para cerrar sesión automáticamente, osea que pasados los 30 min de creacion del temporal (la hora de    creacion viene en el login, automaticamente le tires la session)
   - Mostrar tiempo restante al usuario

3. **Seguridad**:
   - Siempre enviar el token en el header Authorization
   - Manejar errores 401 limpiando el localStorage
   - Validar permisos en el frontend según el rol

4. **Cierre de Sesión**:
```javascript
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  // Redirigir a login o actualizar estado de la aplicación
};
```
