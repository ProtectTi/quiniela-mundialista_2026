# Backend Quiniela

Backend propio de la quiniela para autenticar colaboradores contra SQL Server sin tocar intranet.

## Que hace

- Replica el login de intranet por `username` y `password`
- Valida `bcrypt` y fallback `md5`
- Exige `user_status = 1`
- Exige `employee_status = 1`
- Devuelve un snapshot organizacional del colaborador
- Calcula el corte administrativo de `Ganadores` desde Firestore

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/manual-registration-profile`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/admin/winners`
- `GET /api/health`

## Variables de entorno

Usa `.env.example` como base.


Valores que debes reemplazar en tu `.env`:

- `JWT_SECRET`
- `SQLSERVER_HOST`
- `SQLSERVER_DATABASE`
- `SQLSERVER_USER`
- `SQLSERVER_PASSWORD`

## Notas

- La conexion a SQL Server debe ser `read-only`.
- Este backend no modifica intranet.
- `GET /api/admin/winners` valida la sesión Firebase del admin con un `Bearer` token.
- El endpoint de ganadores usa Firestore como fuente operativa y cachea el corte por unos segundos para no recalcular en cada filtro.
