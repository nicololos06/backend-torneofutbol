import { mkdir, writeFile } from 'node:fs/promises';

const check = (status) => `pm.test('HTTP ${status}', () => pm.response.to.have.status(${status}));`;
const save = (key, value = 'pm.response.json().data._id') =>
  `if (pm.response.code < 300) pm.collectionVariables.set('${key}', ${value});`;
function item(
  name,
  method,
  path,
  { body, status = 200, token = false, tests = [], before = [] } = {},
) {
  return {
    name,
    request: {
      method,
      header: [
        ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []),
        ...(token ? [{ key: 'Authorization', value: 'Bearer {{token}}' }] : []),
      ],
      url: '{{baseUrl}}' + path,
      ...(body && {
        body: {
          mode: 'raw',
          raw: JSON.stringify(body, null, 2),
          options: { raw: { language: 'json' } },
        },
      }),
    },
    event: [
      ...(before.length
        ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: before } }]
        : []),
      { listen: 'test', script: { type: 'text/javascript', exec: [check(status), ...tests] } },
    ],
  };
}
const team = (nombre) => ({
  nombre,
  nombreCorto: 'Prueba',
  grupo: 'A',
  categoria: 'Juvenil',
  colores: ['azul', 'blanco'],
});
const collection = {
  info: {
    name: 'Torneo Don Bosco — Entrega Final',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Ejecutar en orden contra npm run demo. Usa datos de prueba nuevos, guarda token/IDs y elimina solo sus equipos y partido al terminar. El usuario de prueba queda desactivado. Credenciales públicas solo para desarrollo.',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000/api' },
    { key: 'adminEmail', value: 'admin@donbosco.example' },
    { key: 'adminPassword', value: 'DonBoscoDemo2026!' },
    ...['token', 'runId', 'usuarioId', 'equipoLocalId', 'equipoVisitanteId', 'partidoId'].map(
      (key) => ({ key, value: '' }),
    ),
  ],
  item: [
    {
      name: '1. Estado y autenticación',
      item: [
        item('Estado de API y MongoDB', 'GET', '/health'),
        item('Login admin y guardar token', 'POST', '/auth/login', {
          body: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
          tests: [save('token', 'pm.response.json().token')],
        }),
        item('Mi perfil', 'GET', '/auth/me', { token: true }),
        item('Registrar consulta de prueba', 'POST', '/auth/register', {
          status: 201,
          body: {
            nombre: 'Consulta de prueba',
            email: 'consulta.{{runId}}@example.com',
            password: 'PruebaSegura2026!',
          },
          before: [
            "pm.collectionVariables.set('runId', Date.now().toString() + Math.floor(Math.random() * 10000));",
          ],
          tests: [save('usuarioId')],
        }),
        item('Listar usuarios', 'GET', '/usuarios?page=1&limit=20', { token: true }),
        item('Asignar rol organizador', 'PATCH', '/usuarios/{{usuarioId}}', {
          token: true,
          body: { rol: 'organizador', activo: true },
        }),
      ],
    },
    {
      name: '2. CRUD de equipos',
      item: [
        item('Listar equipos de grupo A', 'GET', '/equipos?grupo=A&page=1&limit=20'),
        item('Crear equipo local', 'POST', '/equipos', {
          token: true,
          status: 201,
          body: team('Local {{runId}}'),
          tests: [save('equipoLocalId')],
        }),
        item('Crear equipo visitante', 'POST', '/equipos', {
          token: true,
          status: 201,
          body: team('Visitante {{runId}}'),
          tests: [save('equipoVisitanteId')],
        }),
        item('Obtener equipo local', 'GET', '/equipos/{{equipoLocalId}}'),
        item('Editar equipo', 'PATCH', '/equipos/{{equipoLocalId}}', {
          token: true,
          body: { nombreCorto: 'Local editado', colores: ['rojo', 'blanco'] },
        }),
      ],
    },
    {
      name: '3. CRUD de partidos y relaciones',
      item: [
        item('Listar partidos', 'GET', '/partidos?fase=grupos&page=1&limit=20'),
        item('Crear partido', 'POST', '/partidos', {
          token: true,
          status: 201,
          body: {
            equipoLocalId: '{{equipoLocalId}}',
            equipoVisitanteId: '{{equipoVisitanteId}}',
            fase: 'grupos',
            jornada: 4,
            fechaHora: '2026-10-20T18:00:00-03:00',
            sede: 'Cancha de prueba',
            estado: 'programado',
          },
          tests: [save('partidoId')],
        }),
        item('Leer partido con populate', 'GET', '/partidos/{{partidoId}}', {
          tests: [
            "pm.test('Equipos completos con populate', () => { const p = pm.response.json().data; pm.expect(p.equipoLocalId).to.have.property('nombre'); pm.expect(p.equipoVisitanteId).to.have.property('nombre'); });",
          ],
        }),
        item('Editar y finalizar partido', 'PATCH', '/partidos/{{partidoId}}', {
          token: true,
          body: {
            estado: 'finalizado',
            resultado: { golesLocal: 2, golesVisitante: 1, definidoPor: 'tiempo_reglamentario' },
          },
        }),
        item('Posiciones calculadas', 'GET', '/posiciones?categoria=Juvenil'),
        item('Equipo referenciado no se puede borrar', 'DELETE', '/equipos/{{equipoLocalId}}', {
          token: true,
          status: 409,
        }),
      ],
    },
    {
      name: '4. Limpieza de los registros de esta ejecución',
      item: [
        item('Eliminar partido de prueba', 'DELETE', '/partidos/{{partidoId}}', { token: true }),
        item('Eliminar equipo local de prueba', 'DELETE', '/equipos/{{equipoLocalId}}', {
          token: true,
        }),
        item('Eliminar equipo visitante de prueba', 'DELETE', '/equipos/{{equipoVisitanteId}}', {
          token: true,
        }),
        item(
          'Desactivar usuario de prueba conservando historial',
          'PATCH',
          '/usuarios/{{usuarioId}}',
          { token: true, body: { activo: false } },
        ),
        item('Partido eliminado devuelve 404', 'GET', '/partidos/{{partidoId}}', { status: 404 }),
      ],
    },
  ],
};
const directory = new URL('../postman/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL('Torneo-Don-Bosco.postman_collection.json', directory),
  JSON.stringify(collection, null, 2) + '\n',
  'utf8',
);
console.log('Colección Postman generada: 22 solicitudes, con captura de token e IDs.');
