# Despliegue

## Arquitectura

- Frontend estatico en Firebase Hosting
- Backend Node/Express en Cloud Run
- `/api/**` reescrito desde Hosting hacia Cloud Run
- Firestore como base operativa
- SQL Server readonly como fuente de login y perfil

## Produccion

### 1. Frontend

- El archivo real de Hosting es `firebase.json`
- El frontend ya resuelve el API asi:
  - local: `http://localhost:3100/api`
  - produccion: `${window.location.origin}/api`
- No debes usar `localStorage.quiniela_api_url` en produccion
- No debes usar `localStorage.quiniela_tenant_host` en produccion

### 2. Backend

Desplegar `backend/` como servicio `quiniela-backend` en Cloud Run.

Variables de entorno minimas:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `WINNERS_CACHE_MS`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_API_KEY`
- `SQLSERVER_HOST`
- `SQLSERVER_PORT`
- `SQLSERVER_DATABASE`
- `SQLSERVER_USER`
- `SQLSERVER_PASSWORD`
- `SQLSERVER_ENCRYPT`
- `SQLSERVER_TRUST_CERT`

El backend debe usar una conexion SQL Server `read-only`.

Comandos base sugeridos:

```powershell
gcloud config set project quiniela-mundialista-202-bff2f
gcloud run deploy quiniela-backend `
  --source backend `
  --region us-central1 `
  --allow-unauthenticated
```

Despues configura las variables de entorno del servicio en Cloud Run.

### 3. Dominios

Configurar en Firebase Hosting los dominios reales del frontend:

- `mundial.caprepa.com`
- `mundial.presico.co`
- `mundial.presico.pe`
- `mundial.prestamoslacasita.pe`
- `mundial.pistiyo.sv`
- `mundial.prestamoslamoderna.sv`
- `mundial.presico.gt`
- `mundial.pistiyo.gt`
- `mundial.prestamoslacasita.gt`
- `mundial.pistiyo.hn`
- `mundial.pistiyo.ni`

El tenant se resuelve por `hostname` en:

- `backend/src/data/tenants.seed.js`

Para el frontend:

```powershell
firebase use quiniela-mundialista-202-bff2f
firebase deploy --only hosting
```

### 4. Admin

- `admin.html` sigue usando Firebase Auth
- la cuenta esperada es `admin@quiniela.com`
- antes de subir, confirma que esa cuenta exista y funcione en Firebase Authentication

### 5. Firestore

Antes de subir, confirma:

- reglas publicadas
- colecciones existentes
- que `jugadores` siga permitiendo el flujo actual
- que el panel admin pueda leer lo necesario via backend

## Local

### Frontend local

Puedes abrir el sitio con tu servidor local habitual.

### Backend local

```powershell
cd backend
npm run start
```

### Simular una liga en local

En consola del navegador:

```js
localStorage.setItem("quiniela_tenant_host", "mundial.presico.pe");
location.reload();
```

Para volver al host real:

```js
localStorage.removeItem("quiniela_tenant_host");
location.reload();
```

## Checklist antes de subir

- `backend/.env` no debe subirse
- `backend/node_modules/` no debe subirse
- logs no deben subirse
- `img/tenants/` si debe subirse
- `firebase.json` si debe subirse
- confirma que `CNAME` no sea necesario para Firebase Hosting
- prueba al menos:
  - login admin
  - login intranet
  - registro manual
  - vista `Ganadores`
  - branding de al menos 2 tenants
