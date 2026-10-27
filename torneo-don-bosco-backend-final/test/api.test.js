import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { initializeModels } from '../src/services/systemService.js';
import { seedDatabase } from '../src/services/seedService.js';
import { createAccount } from '../src/services/userService.js';
import Usuario from '../src/models/userModel.js';
import Partido from '../src/models/matchModel.js';
import { teamId, matchId } from '../src/data/demoData.js';

process.env.NODE_ENV = 'test';
const app = createApp();
let mongo, adminToken, organizerToken, readerToken, readerId;
const missingId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const team = (name) => ({
  nombre: name,
  nombreCorto: name,
  grupo: 'A',
  categoria: 'Juvenil',
  colores: ['azul'],
});
const match = () => ({
  equipoLocalId: teamId(1),
  equipoVisitanteId: teamId(2),
  fase: 'grupos',
  jornada: 4,
  fechaHora: '2026-10-20T18:00:00-03:00',
  sede: 'Cancha de prueba',
});
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const noSecrets = (body) =>
  assert.doesNotMatch(JSON.stringify(body), /passwordHash|pendiente-de-hash|\$2b\$/);

before(
  async () => {
    mongo = await MongoMemoryServer.create({ instance: { dbName: 'torneo_tests' } });
    await connectDB(mongo.getUri());
    await initializeModels();
    await seedDatabase();
    await createAccount(
      {
        nombre: 'Organizador Test',
        email: 'organizador@test.example',
        password: 'PruebaSegura123!',
      },
      'organizador',
    );
    const user = await createAccount({
      nombre: 'Consulta Test',
      email: 'consulta@test.example',
      password: 'PruebaSegura123!',
    });
    readerId = String(user._id);
    for (const [email, password, role] of [
      [config.adminEmail, config.adminPassword, 'admin'],
      ['organizador@test.example', 'PruebaSegura123!', 'organizador'],
      ['consulta@test.example', 'PruebaSegura123!', 'consulta'],
    ]) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      noSecrets(response.body);
      if (role === 'admin') adminToken = response.body.token;
      if (role === 'organizador') organizerToken = response.body.token;
      if (role === 'consulta') readerToken = response.body.token;
    }
  },
  { timeout: 180000 },
);
after(async () => {
  await disconnectDB();
  if (mongo) await mongo.stop();
});

test('health verifica conexión con MongoDB real y el seed es idempotente', async () => {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.database, 'connected');
  assert.deepEqual(await seedDatabase(), {
    equiposCreados: 0,
    partidosCreados: 0,
    adminEmail: config.adminEmail,
  });
});
test('registro genera hash bcrypt, nunca expone contraseña y normaliza email', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ nombre: 'Nueva Cuenta', email: 'NUEVA@test.example', password: 'PruebaNueva123!' })
    .expect(201);
  assert.equal(response.body.data.rol, 'consulta');
  assert.equal(response.body.data.email, 'nueva@test.example');
  noSecrets(response.body);
  const saved = await Usuario.findById(response.body.data._id).select('+passwordHash');
  assert.ok(await bcrypt.compare('PruebaNueva123!', saved.passwordHash));
  const originalHash = saved.passwordHash;
  saved.nombre = 'Nombre editado';
  await saved.save();
  assert.equal(saved.passwordHash, originalHash);
  saved.password = 'OtraPrueba123!';
  await saved.save();
  assert.ok(await bcrypt.compare('OtraPrueba123!', saved.passwordHash));
  assert.ok(!(await bcrypt.compare('PruebaNueva123!', saved.passwordHash)));
});
test('registro impide elevar rol, passwords inválidos y duplicados', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      nombre: 'Intruso',
      email: 'intruso@test.example',
      password: 'PruebaSegura123!',
      rol: 'admin',
    })
    .expect(400);
  await request(app)
    .post('/api/auth/register')
    .send({ nombre: 'Corto', email: 'corto@test.example', password: '123' })
    .expect(400);
  await request(app)
    .post('/api/auth/register')
    .send({ nombre: 'Duplicado', email: 'NUEVA@test.example', password: 'PruebaSegura123!' })
    .expect(409);
  await request(app)
    .post('/api/auth/register')
    .send({ nombre: 'Bytes', email: 'bytes@test.example', password: 'á'.repeat(40) })
    .expect(400);
});
test('login y middleware rechazan credenciales, JWT vencidos y firma inválida', async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ email: config.adminEmail, password: 'incorrecta' })
    .expect(401);
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set(auth('invalido')).expect(401);
  const expired = jwt.sign({}, config.jwtSecret, {
    subject: readerId,
    issuer: 'don-bosco-api',
    audience: 'don-bosco-web',
    expiresIn: -1,
  });
  await request(app).get('/api/auth/me').set(auth(expired)).expect(401);
  const forged = jwt.sign({}, 'otra-clave', {
    subject: readerId,
    issuer: 'don-bosco-api',
    audience: 'don-bosco-web',
  });
  await request(app).get('/api/auth/me').set(auth(forged)).expect(401);
  const me = await request(app).get('/api/auth/me').set(auth(adminToken)).expect(200);
  assert.equal(me.body.data.rol, 'admin');
  noSecrets(me.body);
});
test('lecturas públicas: filtros, paginación y populate completo sin datos privados', async () => {
  const teams = await request(app).get('/api/equipos?grupo=A&limit=2&page=2').expect(200);
  assert.equal(teams.body.meta.total, 4);
  assert.equal(teams.body.data.length, 2);
  const response = await request(app)
    .get(`/api/partidos/${matchId(1)}`)
    .expect(200);
  assert.equal(response.body.data.equipoLocalId.nombre, 'Don Bosco FC');
  assert.equal(response.body.data.equipoVisitanteId.nombre, 'La Gloria');
  assert.equal(response.body.data.creadoPorId.rol, 'admin');
  assert.equal(response.body.data.creadoPorId.email, undefined);
  noSecrets(response.body);
  const matches = await request(app).get('/api/partidos?fase=grupos&jornada=1&limit=2').expect(200);
  assert.equal(matches.body.meta.total, 4);
  assert.equal(matches.body.data.length, 2);
  assert.equal(matches.body.data[0].equipoLocalId.nombre, 'Don Bosco FC');
  const range = await request(app)
    .get('/api/partidos')
    .query({ equipoId: teamId(1), desde: '2026-04-19T00:00:00Z', hasta: '2026-04-20T00:00:00Z' })
    .expect(200);
  assert.equal(range.body.meta.total, 1);
});
test('ID malformado 400, recurso inexistente 404, query inválida 400', async () => {
  for (const resource of ['equipos', 'partidos']) {
    await request(app).get(`/api/${resource}/no-es-id`).expect(400);
    await request(app).get(`/api/${resource}/${missingId}`).expect(404);
  }
  for (const path of [
    '/api/equipos?limit=0',
    '/api/equipos?grupo[$ne]=A',
    '/api/partidos?equipoId=hola',
    '/api/partidos?estado=otro',
    '/api/equipos?grupo=A&grupo=B',
    '/api/partidos?desde=2026-10-20T00:00:00Z&hasta=2026-10-19T00:00:00Z',
  ])
    await request(app).get(path).expect(400);
});
test('equipos: CRUD, roles, duplicados y campos desconocidos', async () => {
  await request(app).post('/api/equipos').send(team('Sin sesión')).expect(401);
  await request(app)
    .post('/api/equipos')
    .set(auth(readerToken))
    .send(team('Sin permiso'))
    .expect(403);
  const response = await request(app)
    .post('/api/equipos')
    .set(auth(organizerToken))
    .send(team('Equipo Test'))
    .expect(201);
  const id = response.body.data._id;
  await request(app)
    .post('/api/equipos')
    .set(auth(adminToken))
    .send(team('Equipo Test'))
    .expect(409);
  await request(app).patch(`/api/equipos/${id}`).set(auth(adminToken)).send({}).expect(400);
  await request(app)
    .patch(`/api/equipos/${id}`)
    .set(auth(adminToken))
    .send({ $set: { nombre: 'Intruso' } })
    .expect(400);
  const updated = await request(app)
    .patch(`/api/equipos/${id}`)
    .set(auth(organizerToken))
    .send({ nombre: 'Equipo Editado', activo: false })
    .expect(200);
  assert.equal(updated.body.data.nombre, 'Equipo Editado');
  await request(app).delete(`/api/equipos/${id}`).set(auth(organizerToken)).expect(403);
  await request(app).delete(`/api/equipos/${id}`).set(auth(adminToken)).expect(200);
  await request(app).get(`/api/equipos/${id}`).expect(404);
});
test('integridad: no elimina equipo referenciado ni altera su grupo/categoría', async () => {
  await request(app)
    .delete(`/api/equipos/${teamId(1)}`)
    .set(auth(adminToken))
    .expect(409);
  await request(app)
    .patch(`/api/equipos/${teamId(1)}`)
    .set(auth(adminToken))
    .send({ grupo: 'B' })
    .expect(409);
  await request(app)
    .patch(`/api/equipos/${teamId(1)}`)
    .set(auth(adminToken))
    .send({ categoria: 'Senior' })
    .expect(409);
});
test('partidos: CRUD, autor desde JWT, actualizar resultado y eliminar', async () => {
  await request(app).post('/api/partidos').set(auth(readerToken)).send(match()).expect(403);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), creadoPorId: readerId })
    .expect(400);
  const response = await request(app)
    .post('/api/partidos')
    .set(auth(organizerToken))
    .send(match())
    .expect(201);
  const id = response.body.data._id;
  assert.equal(response.body.data.creadoPorId.rol, 'organizador');
  assert.equal(response.body.data.fechaHora, '2026-10-20T21:00:00.000Z');
  await request(app).post('/api/partidos').set(auth(adminToken)).send(match()).expect(409);
  await request(app)
    .patch(`/api/partidos/${id}`)
    .set(auth(adminToken))
    .send({ estado: 'finalizado' })
    .expect(400);
  const updated = await request(app)
    .patch(`/api/partidos/${id}`)
    .set(auth(organizerToken))
    .send({
      estado: 'finalizado',
      resultado: { golesLocal: 2, golesVisitante: 2, definidoPor: 'tiempo_reglamentario' },
    })
    .expect(200);
  assert.equal(updated.body.data.resultado.golesLocal, 2);
  await request(app)
    .patch(`/api/partidos/${id}`)
    .set(auth(adminToken))
    .send({ estado: 'programado', resultado: null, fase: 'final', jornada: null })
    .expect(200);
  const saved = await Partido.findById(id);
  assert.equal(saved.resultado, undefined);
  assert.equal(saved.jornada, undefined);
  await request(app).delete(`/api/partidos/${id}`).set(auth(organizerToken)).expect(403);
  await request(app).delete(`/api/partidos/${id}`).set(auth(adminToken)).expect(200);
  await request(app).get(`/api/partidos/${id}`).expect(404);
});
test('partidos: rechaza referencias inexistentes, mismo equipo y grupos distintos', async () => {
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), equipoLocalId: missingId })
    .expect(404);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), equipoVisitanteId: teamId(1) })
    .expect(400);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), equipoVisitanteId: teamId(5) })
    .expect(400);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), fechaHora: 'ayer' })
    .expect(400);
  const { jornada, ...withoutRound } = match();
  await request(app).post('/api/partidos').set(auth(adminToken)).send(withoutRound).expect(400);
});
test('partidos: equipos inactivos y de distinta categoría no pueden ser asignados', async () => {
  const response = await request(app)
    .post('/api/equipos')
    .set(auth(adminToken))
    .send({ ...team('Equipo Senior'), categoria: 'Senior' })
    .expect(201);
  const id = response.body.data._id;
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), equipoLocalId: id })
    .expect(400);
  await request(app)
    .patch(`/api/equipos/${id}`)
    .set(auth(adminToken))
    .send({ categoria: 'Juvenil', activo: false })
    .expect(200);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), equipoLocalId: id })
    .expect(400);
  await request(app).delete(`/api/equipos/${id}`).set(auth(adminToken)).expect(200);
});
test('resultados: valida goles y definición por penales en eliminatorias', async () => {
  const { jornada, ...values } = match();
  values.fase = 'final';
  values.estado = 'finalizado';
  const tie = { golesLocal: 1, golesVisitante: 1, definidoPor: 'tiempo_reglamentario' };
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...values, resultado: tie })
    .expect(400);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...values, resultado: { ...tie, golesLocal: -1 } })
    .expect(400);
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({
      ...values,
      resultado: { ...tie, definidoPor: 'penales', penalesLocal: 4, penalesVisitante: 4 },
    })
    .expect(400);
  const penalty = { ...tie, definidoPor: 'penales', penalesLocal: 5, penalesVisitante: 4 };
  await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...match(), estado: 'finalizado', resultado: penalty })
    .expect(400);
  const response = await request(app)
    .post('/api/partidos')
    .set(auth(adminToken))
    .send({ ...values, resultado: penalty })
    .expect(201);
  await request(app)
    .delete(`/api/partidos/${response.body.data._id}`)
    .set(auth(adminToken))
    .expect(200);
});
test('posiciones se calculan solo con grupos finalizados, sin duplicar datos', async () => {
  const response = await request(app).get('/api/posiciones').expect(200);
  const first = response.body.data.grupos.A[0];
  assert.equal(first.equipo.nombre, 'Don Bosco FC');
  assert.deepEqual(
    [first.PJ, first.PG, first.PTS, first.GF, first.GC, first.DG],
    [3, 3, 9, 9, 2, 7],
  );
  const all = [...response.body.data.grupos.A, ...response.body.data.grupos.B];
  assert.equal(
    all.reduce((s, t) => s + t.GF, 0),
    all.reduce((s, t) => s + t.GC, 0),
  );
});
test('administración de usuarios: cambios de rol y desactivación afectan JWT existente', async () => {
  await request(app).get('/api/usuarios').set(auth(readerToken)).expect(403);
  const users = await request(app).get('/api/usuarios').set(auth(adminToken)).expect(200);
  noSecrets(users.body);
  await request(app)
    .patch(`/api/usuarios/${readerId}`)
    .set(auth(adminToken))
    .send({ rol: 'organizador' })
    .expect(200);
  const me = await request(app).get('/api/auth/me').set(auth(readerToken)).expect(200);
  assert.equal(me.body.data.rol, 'organizador');
  await request(app)
    .patch(`/api/usuarios/${readerId}`)
    .set(auth(adminToken))
    .send({ activo: false })
    .expect(200);
  await request(app).get('/api/auth/me').set(auth(readerToken)).expect(401);
  const admin = users.body.data.find((u) => u.rol === 'admin');
  await request(app)
    .patch(`/api/usuarios/${admin._id}`)
    .set(auth(adminToken))
    .send({ rol: 'consulta' })
    .expect(400);
});
test('CORS permite la web, rechaza otro origen y responde al preflight', async () => {
  const response = await request(app)
    .get('/api/equipos')
    .set('Origin', 'http://localhost:5173')
    .expect(200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  await request(app).get('/api/equipos').set('Origin', 'https://otro.example').expect(403);
  await request(app)
    .options('/api/partidos')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .expect(204);
});
test('errores HTTP: JSON roto, cuerpo excesivo y ruta desconocida', async () => {
  await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{mal')
    .expect(400);
  await request(app)
    .post('/api/auth/login')
    .send({ payload: 'x'.repeat(40000) })
    .expect(413);
  await request(app).get('/api/no-existe').expect(404);
});
test('limitador protege registro y login contra intentos repetidos', async () => {
  const isolated = createApp();
  for (let i = 0; i < 30; i++) await request(isolated).post('/api/auth/login').send({}).expect(400);
  await request(isolated).post('/api/auth/login').send({}).expect(429);
});
test('caída de base: health devuelve 503 y el error 500 no expone detalles', async () => {
  await disconnectDB();
  await request(app).get('/api/health').expect(503);
  const response = await request(app).get('/api/equipos').expect(500);
  assert.deepEqual(response.body, { error: { message: 'Error interno del servidor' } });
});
