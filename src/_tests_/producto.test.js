// src/_tests_/producto.test.js
const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../index');
const Producto = require('../models/productoSchema');

describe('Sistema de Productos', () => {
  let productoId;
  const productoTest = {
    nombre: 'Producto Test',
    descripcion: 'Descripción de prueba',
    categoria: 'limpieza',
    subCategoria: 'aerosoles',
    precio: 100,
    stock: 10,
    proovedorInfo: 'Proveedor Test'
  };

  beforeAll(async () => {
    try {
      const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test-productos';
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      await Producto.deleteMany({});
    } catch (error) {
      console.error('Error conectando a MongoDB:', error);
    }
  });

  afterAll(async () => {
    await Producto.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Operaciones CRUD', () => {
    it('debería crear un nuevo producto', async () => {
      const response = await request(app)
        .post('/api/producto')
        .send(productoTest);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.nombre).toBe(productoTest.nombre);
      productoId = response.body._id;
    });

    it('debería obtener todos los productos', async () => {
      const response = await request(app)
        .get('/api/producto');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('debería obtener un producto por ID', async () => {
      const response = await request(app)
        .get(`/api/producto/${productoId}`);

      expect(response.status).toBe(200);
      expect(response.body._id.toString()).toBe(productoId);
    });

    it('debería actualizar un producto', async () => {
      const updateData = {
        nombre: 'Producto Actualizado',
        precio: 150,
        stock: 15
      };

      const response = await request(app)
        .put(`/api/producto/${productoId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.nombre).toBe(updateData.nombre);
      expect(response.body.precio).toBe(updateData.precio);
      expect(response.body.stock).toBe(updateData.stock);
    });
  });

  describe('Eliminación', () => {
    it('debería eliminar un producto', async () => {
      const response = await request(app)
        .delete(`/api/producto/${productoId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mensaje', 'Producto eliminado correctamente');

      // Verificar que el producto ya no existe
      const productoEliminado = await request(app)
        .get(`/api/producto/${productoId}`);
      expect(productoEliminado.status).toBe(404);
    });
  });
});
