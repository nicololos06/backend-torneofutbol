# Torneo Don Bosco — API RESTful

Trabajo Práctico Final de Backend: API para administrar los equipos, el calendario y los resultados del Torneo Don Bosco. Está basada en la web React existente y en la consigna `tp-backend-final.pdf` proporcionada para el curso.

La consigna permite otras colecciones mientras haya referencias. Se adaptó la entidad principal a **partidos** y la entidad referenciada a **equipos**. Se agregó **usuarios** para autenticación y autoría. El frontend no es obligatorio y no se modificó ni se conectó en esta entrega.

## 1. Requisitos y ejecución rápida

Requiere Node.js **22.13 o superior**, npm e Internet para instalar dependencias. Verificado con Node.js 24.15.0 en Windows.

Desde esta carpeta, o desde la raíz del ZIP descomprimido:

```powershell
npm ci
npm run demo
```

En PowerShell, si la política bloquea `npm.ps1`, utilizar `npm.cmd` en lugar de `npm`.

La demo inicia un **proceso MongoDB real temporal**, crea sus índices, carga 8 equipos, 19 partidos y una cuenta administradora, y levanta Express. No requiere MongoDB instalado. La primera ejecución puede tardar y necesita acceso al servidor de descargas de MongoDB. Al cerrar con Ctrl+C se pierden los cambios de esta demo. No utilizarla como base persistente.

Comprobar en el navegador: `http://localhost:3000/api/health`.

```json
{ "ok": true, "database": "connected" }
```

Credenciales **públicas y ficticias, solo para desarrollo local**:

```json
{
  "email": "admin@donbosco.example",
  "password": "DonBoscoDemo2026!"
}
```

El servidor escucha en `127.0.0.1:3000`. No se inicia ningún servicio permanente del sistema.

## 2. MongoDB persistente: local o Atlas

1. Tener un servidor MongoDB local funcionando o un clúster Atlas con usuario de base de datos y acceso de red configurado. MongoDB Compass es un cliente, no reemplaza al servidor.
2. Copiar el ejemplo y editar los valores privados **únicamente en `.env.local`**:

```powershell
Copy-Item .env.example .env.local
```

Ejemplo local:

```dotenv
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/torneo_don_bosco_final
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_LARGO
CORS_ORIGIN=http://localhost:5173
SEED_ADMIN_EMAIL=admin@donbosco.example
SEED_ADMIN_PASSWORD=CAMBIAR_POR_UNA_CLAVE_DE_DESARROLLO
```

Para generar un secreto aleatorio:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Ejemplo de URI Atlas, reemplazando los marcadores y codificando caracteres especiales de la contraseña:

```dotenv
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA@CLUSTER.mongodb.net/torneo_don_bosco_final?retryWrites=true&w=majority
```

3. Ejecutar:

```powershell
npm run seed
npm run dev
```

También se puede usar `npm start` sin reinicio automático. `seed` es idempotente: inserta solo registros faltantes, no borra ni sobrescribe. Si el administrador ya existe, no cambia su contraseña. No ejecutar seed mientras otras personas modifican esos mismos registros. Está bloqueado con `NODE_ENV=production`.

Las variables del sistema tienen prioridad; luego `.env.local`; por último `.env`. Se incluye `.env` con valores **de ejemplo**, como pide la consigna. `.env.local` está excluido de Git y del ZIP. El secreto de demostración se rechaza en producción. No publicar contraseñas reales ni usar las credenciales demo en un servidor público.

Se usa `torneo_don_bosco_final`, no la base de la entrega intermedia. Los modelos de Mongoose crean las colecciones e índices automáticamente. No hace falta ejecutar un script de `mongosh` ni importar hashes ficticios.

## 3. Tecnologías y arquitectura

Node.js, Express 5, MongoDB, Mongoose 9, bcrypt, jsonwebtoken, dotenv, CORS, Zod, Helmet y express-rate-limit. Pruebas: `node:test`, Supertest y mongodb-memory-server. Las versiones instalables quedan fijadas en `package-lock.json`.

```text
Solicitud HTTP
  → rutas y middleware de autenticación
  → controlador (HTTP y try/catch)
  → servicio (validaciones, reglas y consultas)
  → modelo Mongoose → MongoDB
```

```text
app.js                    Express, CORS, JSON, rutas, manejo de errores
index.js                  Conexión e inicio del servidor
.env / .env.example        Configuración pública de ejemplo
src/
  config/                 Conexión a MongoDB y variables de entorno
  models/                 Esquemas, referencias, índices y hook bcrypt
  services/               Toda la lógica de negocio y operaciones de datos
  controllers/            Recepción y respuesta HTTP
  routes/                 Rutas por entidad
  middleware/             JWT, roles y errores
  data/                   Datos ficticios de demostración
  utils/                  Error de aplicación
scripts/                  Seed, demo y generación de colección Postman
test/                     Pruebas de integración
postman/                  Colección importable con ejemplos de todas las rutas
```

Los controladores no importan modelos ni consultan la base. Los servicios realizan las consultas, filtros y cálculos; la conexión pertenece a `config/db.js` y el hook de contraseña al modelo, según la estructura de la consigna.

## 4. Esquema, dominios y conexiones

### Relaciones

```mermaid
flowchart LR
  U["usuarios · _id"] -->|"1 a N · creadoPorId"| P["partidos"]
  E["equipos · _id"] -->|"1 a N · equipoLocalId"| P
  E -->|"1 a N · equipoVisitanteId"| P
  P -->|"subdocumento embebido"| R["resultado"]
```

Cada partido tiene exactamente un local, un visitante distinto y un creador. Un usuario y un equipo pueden participar en cero o muchos partidos. Los vínculos son `ObjectId` con `ref`; MongoDB no crea claves foráneas SQL. Las verificaciones de existencia y borrado se realizan en los servicios. `resultado` no es una colección independiente.

Todos los documentos incluyen `_id: ObjectId`, `createdAt: Date` y `updatedAt: Date`. Los ObjectId se representan como strings hexadecimales de 24 caracteres en JSON. Las fechas se reciben como ISO 8601 con `Z` u offset y se almacenan como BSON Date en UTC. `versionKey` está deshabilitado.

### usuarios

| Campo | Tipo y dominio | Obligatorio / valor inicial |
|---|---|---|
| nombre | String, 2–80 caracteres, sin espacios exteriores | Sí |
| email | String email válido, hasta 120 caracteres, minúsculas, único | Sí |
| passwordHash | String generado con bcrypt, costo 12; nunca se devuelve | Sí, interno |
| rol | `admin`, `organizador`, `consulta` | `consulta` |
| activo | Boolean | `true` |

`password` es un campo de entrada virtual, no se persiste. Debe tener al menos 10 caracteres y hasta 72 bytes UTF-8. El hook `pre('save')` genera el hash; guardar cambios de nombre o rol no vuelve a hashear la contraseña. El registro público solo acepta nombre, email y password. No hay borrado de usuarios: se desactivan para conservar la autoría.

### equipos

| Campo | Tipo y dominio | Obligatorio / valor inicial |
|---|---|---|
| nombre | String único, 2–80 caracteres | Sí |
| nombreCorto | String, 2–30 caracteres | Sí |
| grupo | `A` o `B` | Sí |
| categoria | `Infantil`, `Juvenil`, `Senior` | Sí |
| escudoUrl | String hasta 300 caracteres; ruta que empieza con `/` o URL HTTP(S) | No |
| colores | Array de 1–4 strings distintos, 2–30 caracteres cada uno | Sí |
| activo | Boolean | `true` |

El nombre es único por coincidencia exacta, sensible a mayúsculas. No se suben archivos de escudos: solo se guarda su ruta.

### partidos

| Campo | Tipo y dominio | Obligatorio / valor inicial |
|---|---|---|
| equipoLocalId | ObjectId → equipos | Sí |
| equipoVisitanteId | ObjectId → equipos | Sí |
| creadoPorId | ObjectId → usuarios, inmutable, tomado del JWT | Sí, automático |
| fase | `grupos`, `cuartos`, `semifinal`, `final` | Sí |
| jornada | Integer, 1–20 | Solo en grupos |
| fechaHora | Date; entrada ISO 8601 con zona horaria | Sí |
| sede | String, 2–120 caracteres | Sí |
| estado | `programado`, `en_juego`, `finalizado`, `suspendido` | `programado` |
| resultado | Subdocumento descrito abajo | Obligatorio al finalizar |
| observaciones | String, 0–250 caracteres | No |

`resultado`: `golesLocal` y `golesVisitante` son enteros de 0 a 99; `definidoPor` es `tiempo_reglamentario` o `penales`; `penalesLocal` y `penalesVisitante` son enteros de 0 a 99, admitidos únicamente cuando se define por penales.

### Reglas y referencias

- Al crear un partido o asignarle equipos, ambos deben existir, estar activos y tener la misma categoría. En fase de grupos también deben compartir grupo.
- Un partido programado no tiene resultado. Uno finalizado debe tenerlo. En juego o suspendido puede tener un marcador parcial.
- Una eliminatoria finalizada debe tener ganador. Solo hay penales tras un empate, fuera de grupos, con ambos tanteadores y un ganador de la tanda.
- `PATCH` valida el documento resultante completo, no solo los campos recibidos. Para borrar resultado o jornada se envía `null`; para volver a programado se envían estado y resultado juntos.
- No se puede borrar un equipo utilizado en partidos, ni cambiar su grupo/categoría. Sí se puede desactivar. Sus partidos históricos permanecen y se pueden corregir.
- `creadoPorId`, `_id`, timestamps y campos desconocidos no son editables desde los cuerpos de la API.
- Índices: email único; nombre de equipo único; grupo/activo; fecha de partido; fase/jornada/fecha; equipo local/fecha; visitante/fecha; combinación local/visitante/fecha única.
- `GET /partidos` y `GET /partidos/:id` usan `populate` y devuelven **los documentos completos de ambos equipos**, no solo sus IDs. Del creador se muestran únicamente `_id`, nombre y rol; nunca email ni contraseña en lecturas públicas.

## 5. Rutas completas y permisos

Base: `http://localhost:3000/api`. Los cuerpos de POST/PATCH usan `Content-Type: application/json`. Las rutas protegidas requieren `Authorization: Bearer TOKEN`. El token vence en una hora. El middleware vuelve a consultar usuario activo y rol, por lo que la desactivación o cambio de permisos afecta también a tokens ya emitidos.

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| GET | `/health` | Público | Estado HTTP y MongoDB |
| POST | `/auth/register` | Público, limitado | Registro con rol consulta |
| POST | `/auth/login` | Público, limitado | Token y usuario |
| GET | `/auth/me` | Usuario activo | Perfil de sesión |
| GET | `/usuarios` | Admin | Usuarios paginados |
| PATCH | `/usuarios/:id` | Admin | Modificar rol/activo |
| GET | `/equipos` | Público | Lista paginada |
| GET | `/equipos/:id` | Público | Un equipo |
| POST | `/equipos` | Admin / organizador | Crear equipo |
| PATCH | `/equipos/:id` | Admin / organizador | Actualización parcial |
| DELETE | `/equipos/:id` | Admin | Eliminar si no tiene partidos |
| GET | `/partidos` | Público | Lista con populate |
| GET | `/partidos/:id` | Público | Partido con populate |
| POST | `/partidos` | Admin / organizador | Crear partido |
| PATCH | `/partidos/:id` | Admin / organizador | Actualización parcial |
| DELETE | `/partidos/:id` | Admin | Eliminar partido |
| GET | `/posiciones` | Público | Tabla calculada por grupos |

Las operaciones de lectura no requieren sesión; `consulta` no puede escribir. Un administrador no puede desactivarse ni quitarse su propio rol. El CRUD usa PATCH para actualización parcial; no se ofrece PUT.

Filtros opcionales:

- Listas: `page` (1–10000) y `limit` (1–100), valores iniciales 1 y 20.
- Equipos: `grupo=A|B`, `categoria=Infantil|Juvenil|Senior`, `activo=true|false`.
- Partidos: `fase`, `estado`, `jornada`, `equipoId`, `desde`, `hasta` (fechas ISO con zona horaria).
- Posiciones: `categoria`, valor inicial `Juvenil`.

Ejemplos de GET, todos **sin cuerpo JSON**:

```text
GET /api/health
GET /api/auth/me                       + Authorization
GET /api/usuarios?page=1&limit=20       + Authorization admin
GET /api/equipos?grupo=A&activo=true
GET /api/equipos/66c200000000000000000001
GET /api/partidos?fase=grupos&jornada=1
GET /api/partidos?equipoId=66c200000000000000000001
GET /api/partidos?desde=2026-04-19T00:00:00Z&hasta=2026-04-20T00:00:00Z
GET /api/partidos/66c300000000000000000001
GET /api/posiciones?categoria=Juvenil
```

Los filtros desconocidos, operadores de MongoDB y parámetros repetidos inválidos se rechazan con 400. El cliente no controla las proyecciones ni el orden de consulta.

## 6. JSON de ejemplo para cada operación de escritura

### Registro — POST /api/auth/register

```json
{ "nombre": "Usuario de Prueba", "email": "usuario@example.com", "password": "PruebaSegura2026!" }
```

### Login — POST /api/auth/login

```json
{ "email": "admin@donbosco.example", "password": "DonBoscoDemo2026!" }
```

Copiar `token` de la respuesta en el header `Authorization: Bearer TOKEN`. Si cambiaste los datos del seed, usar esas credenciales.

### Permisos — PATCH /api/usuarios/ID_DEL_USUARIO_REGISTRADO

```json
{ "rol": "organizador", "activo": true }
```

Para quitarle acceso manteniendo su historial:

```json
{ "activo": false }
```

### Crear equipo — POST /api/equipos

```json
{
  "nombre": "Deportivo Ejemplo",
  "nombreCorto": "Deportivo",
  "grupo": "A",
  "categoria": "Juvenil",
  "escudoUrl": "/escudos/deportivo.png",
  "colores": ["azul", "blanco"],
  "activo": true
}
```

### Editar equipo — PATCH /api/equipos/ID_CREADO

```json
{ "nombreCorto": "Dep. Ejemplo", "colores": ["azul", "amarillo"] }
```

### Crear partido — POST /api/partidos

Los siguientes IDs existen después del seed:

```json
{
  "equipoLocalId": "66c200000000000000000001",
  "equipoVisitanteId": "66c200000000000000000002",
  "fase": "grupos",
  "jornada": 4,
  "fechaHora": "2026-10-20T18:00:00-03:00",
  "sede": "Oratorio Don Bosco - Cancha principal",
  "estado": "programado",
  "observaciones": "Partido de prueba académica"
}
```

### Finalizar partido — PATCH /api/partidos/ID_CREADO

```json
{
  "estado": "finalizado",
  "resultado": { "golesLocal": 2, "golesVisitante": 1, "definidoPor": "tiempo_reglamentario" }
}
```

Ejemplo alternativo para un partido eliminatorio empatado:

```json
{
  "fase": "final",
  "jornada": null,
  "estado": "finalizado",
  "resultado": {
    "golesLocal": 1,
    "golesVisitante": 1,
    "definidoPor": "penales",
    "penalesLocal": 5,
    "penalesVisitante": 4
  }
}
```

Para quitar un resultado y volver a programar:

```json
{ "estado": "programado", "resultado": null }
```

### Eliminar — sin cuerpo JSON

```text
DELETE /api/partidos/ID_DEL_PARTIDO_CREADO     + Authorization admin
DELETE /api/equipos/ID_DEL_EQUIPO_CREADO       + Authorization admin
```

Si se intenta borrar un equipo usado por un partido se recibe 409. Primero hay que borrar el partido si corresponde o desactivar al equipo. No hay borrado en cascada.

### Forma de las respuestas

Un recurso: `{ "data": { ... } }`. Listas: `{ "data": [ ... ], "meta": { "total": 8, "page": 1, "limit": 20, "pages": 1 } }`. Eliminación: `{ "message": "Equipo eliminado" }` o `{ "message": "Partido eliminado" }`. Login: `{ "token": "...", "tokenType": "Bearer", "expiresIn": 3600, "usuario": { ... } }`.

Error de ejemplo:

```json
{ "error": { "message": "Equipo no encontrado" } }
```

| Estado HTTP | Uso |
|---|---|
| 200 | Lectura, login, actualización o borrado correcto |
| 201 | Registro o recurso creado |
| 204 | Preflight CORS |
| 400 | JSON, campos, ID, filtros o regla de negocio inválidos |
| 401 | Sin token, token inválido/vencido, usuario inactivo o login incorrecto |
| 403 | Rol insuficiente u origen CORS no permitido |
| 404 | Ruta, recurso o referencia inexistente |
| 409 | Duplicado o equipo que no puede eliminarse/modificarse |
| 413 | Cuerpo superior a 32 KB |
| 429 | Más de 30 intentos de login/registro por IP en 15 minutos |
| 500 | Error interno sin stack ni información sensible |
| 503 | MongoDB no disponible en health |

## 7. Postman y recorrido de demostración

Importar `postman/Torneo-Don-Bosco.postman_collection.json`. La colección incluye todas las rutas, JSON de entrada y verificaciones de estado HTTP. `baseUrl` vale `http://localhost:3000/api`.

Con `npm run demo` ejecutándose, correr la colección **en orden**. El login guarda automáticamente el token y los POST guardan IDs de prueba. Crea dos equipos temporales, un partido y un usuario consulta; demuestra edición, populate y permisos; al final elimina el partido y los equipos temporales. El usuario de prueba queda desactivado como historial. No borra los datos del seed. Cada ejecución usa nombres/emails de prueba nuevos. Varias ejecuciones rápidas pueden activar el límite de autenticación.

Si usás credenciales propias, cambiar `adminEmail` y `adminPassword` en las variables locales de la colección y no exportarlas con secretos. Los ejemplos son ejecutables contra la API local; no requieren publicar la aplicación.

Para regenerar la colección después de modificar su definición:

```powershell
node scripts/build-postman.js
```

## 8. Pruebas automatizadas

```powershell
npm test
npm audit --omit=dev
```

Las pruebas levantan su propio MongoDB temporal, aislado de `MONGODB_URI`. Comprueban 18 escenarios de integración: seed idempotente; hash real y cambio de contraseña; validación y duplicados; JWT; populate; filtros e IDs; CRUD y permisos de equipos/partidos; restricciones de referencias; equipos activos/categorías; penales; tabla de posiciones; administración de usuarios; CORS; errores JSON; límite de intentos; caída de base.

Resultado verificado: **18 pruebas aprobadas, 0 fallidas**. Las pruebas no modifican la base persistente del usuario y detienen su proceso temporal al finalizar. La primera ejecución puede descargar el binario de MongoDB. Sin acceso a esa descarga, usar una conexión disponible para obtenerlo antes; la API normal con MongoDB instalado no necesita mongodb-memory-server.

Verificación final del 15 de octubre de 2026: la colección Postman también se ejecutó con Newman contra `npm run demo`: **22 solicitudes y 23 aserciones, sin fallos**. `npm audit --omit=dev` reportó **0 vulnerabilidades** en esa fecha. Las dos comprobaciones son complementarias: pruebas de reglas internas y recorrido HTTP completo.

## 9. Correspondencia con la consigna

| Requisito | Implementación |
|---|---|
| Node, Express, MongoDB/Mongoose | Dependencias, app.js, config/db.js |
| CRUD completo | Equipos y partidos: POST, GET lista/detalle, PATCH, DELETE |
| Referencia entre colecciones | Dos referencias a equipos y una a usuarios en partido |
| populate en lecturas | matchService.js, ambos equipos completos |
| Capa de servicios | services/ concentra reglas, consultas y cálculos |
| Controladores ligeros, try/catch | controllers/ delega y genera respuestas HTTP |
| Estados HTTP y errores | AppError y errorHandler centralizado |
| bcrypt en pre-save | userModel.js, costo 12 |
| JWT y protección de escrituras | userService.js y verifyToken.js |
| dotenv y CORS | config/env.js y app.js |
| README, esquema, mocks y rutas | Este documento y colección Postman |
| .env de ejemplo incluido | .env y .env.example, sin secretos reales |
| Repositorio GitHub | Proyecto autónomo, con configuración de ejemplo y archivos de instalación |

## 10. Alcance implementado y evolución

Implementado: gestión de equipos y partidos, usuarios y roles, autenticación, datos demo, calendario filtrable, relaciones pobladas, validación de resultados y tabla de posiciones calculada. Esta última usa solo partidos finalizados de grupos: 3 puntos por victoria, 1 por empate, 0 por derrota; orden por puntos, diferencia de gol, goles a favor y nombre como criterio técnico estable. Los equipos inactivos conservan su historial en la tabla.

Los equipos y resultados del cuadro eliminatorio se tomaron del contenido de la web. El fixture de grupos es ficticio y consistente para demostrar la API; no se afirman resultados oficiales. La tabla estática de la web y el reglamento/calendario presentan diferencias entre sí. Para esta entrega se eligió el cuadro de **eliminación a partido único**, no una serie de ida/vuelta, y la tabla se recalcula desde resultados. No se determina clasificación automática ni se valida la progresión de ganadores entre rondas.

Pendiente para una evolución: conectar React mediante fetch, panel administrativo, temporadas, jugadores, series ida/vuelta, clasificación automática, recuperación de contraseña y auditoría de cambios. La API no modifica el diseño existente ni sus datos estáticos.

Límites de producción: las verificaciones de referencias y el guardado son operaciones separadas; no hay transacciones entre colecciones ni control de edición simultánea. Para alta concurrencia habría que usar transacciones sobre replica set, un protocolo de bloqueo/versionado y pruebas de carrera. CORS no sustituye autenticación. El rate limit es local al proceso, no distribuido; un despliegue requiere HTTPS, configuración de host/proxy, secretos propios, monitoreo y copias de seguridad. Esta entrega se orienta al entorno académico local, no se presenta como despliegue de producción.

## 11. Preparar la entrega

Entregar esta carpeta completa, con README, `.env` de ejemplo, lockfile, código, pruebas y Postman. No incluir `node_modules`, `.env.local`, logs, binarios de MongoDB ni credenciales reales. El ZIP generado contiene solamente esos archivos necesarios.

Descomprimir el ZIP y subir su contenido a la raíz del repositorio, incluyendo `.env`, `.env.example` y `.gitignore`. No subir únicamente el archivo ZIP: el código y el README deben quedar disponibles para su revisión. La consigna permite un repositorio público o uno privado con acceso para los docentes. Este backend se puede publicar como proyecto independiente; el frontend no es requisito.

Referencias técnicas: [Mongoose middleware](https://mongoosejs.com/docs/middleware.html), [Express: manejo de errores](https://expressjs.com/en/5x/guide/error-handling/).
