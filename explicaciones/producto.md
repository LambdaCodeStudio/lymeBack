# Documentación API de Productos

## Base URL
```
http://localhost:4000/api/producto
```

## Modelos de Datos

### Producto
```typescript
{
  nombre: string,          // requerido
  descripcion: string,     // requerido
  categoria: string,       // requerido, enum: ['limpieza', 'mantenimiento']
  subCategoria: string,    // requerido, enum: ['accesorios', 'aerosoles', 'bolsas', 'estandar', 'indumentaria', 
                          // 'liquidos', 'papeles', 'sinClasificarLimpieza', 'iluminaria', 'electricidad', 
                          // 'cerraduraCortina', 'pintura', 'superficiesConstruccion', 'plomeria']
  precio: number,          // requerido, > 0
  stock: number,          // requerido, >= 0
  imagen: Buffer,         // requerido, en base64
  vendidos: number,       // default: 0
  proovedorInfo: string   // default: 'Sin informacion'
}
```

## Endpoints

### 1. Obtener Todos los Productos
```javascript
GET /

// Ejemplo de uso
const obtenerProductos = async () => {
  try {
    const response = await fetch('http://localhost:4000/api/producto');
    if (!response.ok) throw new Error('Error al obtener productos');
    const productos = await response.json();
    return productos;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 2. Obtener Producto por ID
```javascript
GET /:id

// Ejemplo de uso
const obtenerProductoPorId = async (id) => {
  try {
    const response = await fetch(`http://localhost:4000/api/producto/${id}`);
    if (!response.ok) {
      if (response.status === 404) throw new Error('Producto no encontrado');
      throw new Error('Error al obtener el producto');
    }
    const producto = await response.json();
    return producto;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 3. Crear Nuevo Producto
```javascript
POST /
Content-Type: application/json

// Ejemplo de uso
const crearProducto = async (productoData) => {
  try {
    const response = await fetch('http://localhost:4000/api/producto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productoData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al crear producto');
    }
    
    const productoCreado = await response.json();
    return productoCreado;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// Ejemplo de datos
const nuevoProducto = {
  nombre: "Limpiador Multiuso",
  descripcion: "Limpiador para todo tipo de superficies",
  categoria: "limpieza",
  subCategoria: "liquidos",
  precio: 150,
  stock: 100,
  imagen: "base64_encoded_image_string",
  proovedorInfo: "Proveedor XYZ"
};
```

### 4. Actualizar Producto
```javascript
PUT /:id
Content-Type: application/json

// Ejemplo de uso
const actualizarProducto = async (id, datosActualizados) => {
  try {
    const response = await fetch(`http://localhost:4000/api/producto/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datosActualizados)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al actualizar producto');
    }
    
    const productoActualizado = await response.json();
    return productoActualizado;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 5. Eliminar Producto
```javascript
DELETE /:id

// Ejemplo de uso
const eliminarProducto = async (id) => {
  try {
    const response = await fetch(`http://localhost:4000/api/producto/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al eliminar producto');
    }
    
    const resultado = await response.json();
    return resultado;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 6. Registrar Venta
```javascript
POST /:id/vender

// Ejemplo de uso
const venderProducto = async (id) => {
  try {
    const response = await fetch(`http://localhost:4000/api/producto/${id}/vender`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al realizar la venta');
    }
    
    const resultado = await response.json();
    return resultado;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### 7. Cancelar Venta
```javascript
POST /:id/cancelar-venta

// Ejemplo de uso
const cancelarVenta = async (id) => {
  try {
    const response = await fetch(`http://localhost:4000/api/producto/${id}/cancelar-venta`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al cancelar la venta');
    }
    
    const resultado = await response.json();
    return resultado;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

## Manejo de Errores

### Códigos de Estado HTTP
- 200: Operación exitosa
- 201: Producto creado exitosamente
- 400: Error de validación o datos inválidos
- 404: Producto no encontrado
- 500: Error interno del servidor

### Ejemplos de Errores
```javascript
// Error de validación
{
  "error": "El precio no puede ser negativo"
}

// Producto no encontrado
{
  "error": "Producto no encontrado"
}

// Error de stock
{
  "error": "Stock insuficiente o producto no encontrado"
}
```

## Notas Importantes

1. **Imágenes:**
   - Las imágenes deben enviarse en formato base64
   - Se recomienda comprimir las imágenes antes de enviarlas

2. **Validaciones:**
   - El precio debe ser mayor a 0
   - El stock no puede ser negativo
   - Las categorías y subcategorías deben coincidir con las enumeradas
   - Todos los campos marcados como requeridos deben enviarse

3. **Ventas:**
   - Una venta reduce el stock en 1 y aumenta vendidos en 1
   - No se pueden realizar ventas si el stock es 0
   - La cancelación de venta revierte estos cambios

4. **Actualización de Productos:**
   - Se pueden actualizar campos individuales
   - Los campos no incluidos en la actualización mantienen sus valores actuales

## Ejemplos de Uso en React

### Hook personalizado para gestionar productos
```javascript
import { useState, useEffect } from 'react';

const useProductos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/api/producto');
      if (!response.ok) throw new Error('Error al obtener productos');
      const data = await response.json();
      setProductos(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const agregarProducto = async (productoData) => {
    try {
      const response = await fetch('http://localhost:4000/api/producto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productoData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      
      const nuevoProducto = await response.json();
      setProductos([...productos, nuevoProducto]);
      return nuevoProducto;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  return {
    productos,
    loading,
    error,
    fetchProductos,
    agregarProducto
  };
};

export default useProductos;
```