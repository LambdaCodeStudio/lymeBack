// src/_tests_/auth.test.js
const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../index');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.test' });

// Aumentar el timeout para todos los tests
jest.setTimeout(30000);

const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  BASIC: 'basic',
  TEMPORAL: 'temporal'
};

describe('Sistema de Autenticación y Roles', () => {
  let adminToken, supervisorToken, basicToken, temporalToken;
  let admin, supervisor, basicUser, temporalUser;

  beforeAll(async () => {
    try {
      const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test-auth';
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      await User.deleteMany({}); // Limpiar la base de datos
    } catch (error) {
      console.error('Error conectando a MongoDB:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await User.deleteMany({}); // Limpiar después de las pruebas
      await mongoose.connection.close();
    } catch (error) {
      console.error('Error cerrando conexión:', error);
    }
  });

  describe('Creación de usuarios por ADMIN', () => {
    beforeAll(async () => {
      try {
        // Crear admin inicial
        admin = await User.create({
          email: process.env.ADMIN_EMAIL || 'admin@test.com',
          password: process.env.ADMIN_PASSWORD || 'adminpass123',
          role: ROLES.ADMIN
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: process.env.ADMIN_EMAIL || 'admin@test.com',
            password: process.env.ADMIN_PASSWORD || 'adminpass123'
          });

        adminToken = loginResponse.body.token;
      } catch (error) {
        console.error('Error en setup de admin:', error);
        throw error;
      }
    });

    it('admin puede crear supervisor', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'supervisor@test.com',
          password: 'super123',
          role: ROLES.SUPERVISOR
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      supervisorToken = response.body.token;
      supervisor = await User.findOne({ email: 'supervisor@test.com' });
    });

    it('admin puede crear usuario básico', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'basic@test.com',
          password: 'basic123',
          role: ROLES.BASIC
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      basicToken = response.body.token;
      basicUser = await User.findOne({ email: 'basic@test.com' });
    });

    it('admin puede crear usuario temporal', async () => {
      const response = await request(app)
        .post('/api/auth/temporary')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'temporal@test.com',
          password: 'temp123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      temporalToken = response.body.token;
      temporalUser = await User.findOne({ email: 'temporal@test.com' });
    });
  });

  describe('Creación de usuarios por SUPERVISOR', () => {
    it('supervisor puede crear usuario básico', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          email: 'basic2@test.com',
          password: 'basic123',
          role: ROLES.BASIC
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('supervisor puede crear usuario temporal', async () => {
      const response = await request(app)
        .post('/api/auth/temporary')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          email: 'temporal2@test.com',
          password: 'temp123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('supervisor NO puede crear otro supervisor', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          email: 'supervisor2@test.com',
          password: 'super123',
          role: ROLES.SUPERVISOR
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Creación de usuarios por BÁSICO', () => {
    it('usuario básico puede crear usuario temporal', async () => {
      const response = await request(app)
        .post('/api/auth/temporary')
        .set('Authorization', `Bearer ${basicToken}`)
        .send({
          email: 'temporal3@test.com',
          password: 'temp123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('usuario básico NO puede crear otro usuario básico', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${basicToken}`)
        .send({
          email: 'basic3@test.com',
          password: 'basic123',
          role: ROLES.BASIC
        });

      expect(response.status).toBe(403);
    });

    it('usuario básico NO puede crear supervisor', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${basicToken}`)
        .send({
          email: 'supervisor3@test.com',
          password: 'super123',
          role: ROLES.SUPERVISOR
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Manejo de usuarios TEMPORALES', () => {
    it('usuario temporal NO puede crear otros usuarios', async () => {
      const response = await request(app)
        .post('/api/auth/temporary')
        .set('Authorization', `Bearer ${temporalToken}`)
        .send({
          email: 'temporal4@test.com',
          password: 'temp123'
        });

      expect(response.status).toBe(403);
    });

    it('usuario temporal expira después de 30 minutos', async () => {
      // Crear un usuario temporal con fecha de expiración en el pasado
      const expiredUser = await User.create({
        email: 'expired@test.com',
        password: 'temp123',
        role: ROLES.TEMPORAL,
        expiresAt: new Date(Date.now() - 1000) // Ya expirado
      });

      const expiredToken = jwt.sign(
        { id: expiredUser._id },
        process.env.JWT_SECRET
      );

      // Intentar acceder con el usuario expirado
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.msg).toBe('Usuario temporal expirado');

      // Verificar que el usuario fue eliminado
      const deletedUser = await User.findOne({ email: 'expired@test.com' });
      expect(deletedUser).toBeNull();
    });

    it('verificar expiración en tiempo real', async () => {
      // Crear usuario temporal con expiración en 2 segundos
      const tempUser = await User.create({
        email: 'shortlived@test.com',
        password: 'temp123',
        role: ROLES.TEMPORAL,
        expiresAt: new Date(Date.now() + 2000) // 2 segundos en el futuro
      });

      const tempToken = jwt.sign(
        { id: tempUser._id },
        process.env.JWT_SECRET || 'testSecret'
      );

      // Primera petición - debería funcionar
      const response1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(response1.status).toBe(200);

      // Esperar 3 segundos
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Segunda petición - debería fallar
      const response2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(response2.status).toBe(401);
      expect(response2.body.msg).toBe('Usuario temporal expirado');

      // Verificar que el usuario fue eliminado
      const deletedUser = await User.findOne({ email: 'shortlived@test.com' });
      expect(deletedUser).toBeNull();
    });
  });
});