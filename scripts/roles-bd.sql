-- ROL DE APLICACIÓN CON PRIVILEGIOS MÍNIMOS
--
-- La API y el worker solo necesitan leer y escribir DATOS. No deben poder
-- crear, alterar ni borrar tablas: eso lo hace únicamente el servicio
-- `migrate` con el rol dueño del esquema (DB_MIGRATOR_USER).
-- Si alguien explota una inyección SQL en la app, no puede hacer DROP TABLE
-- ni leer otras bases del servidor.
--
-- Ejecutar UNA vez por base, conectado como el rol dueño de las tablas:
--   docker exec -i postgres_db psql -U <dueño> -d <base> \
--     -v app_user=imprenta_app -v app_password='<aleatoria>' -v owner=<dueño> \
--     -f - < scripts/roles-bd.sql
--
-- Luego en el .env del backend:
--   DB_USER=imprenta_app        DB_PASSWORD=<aleatoria>
--   DB_MIGRATOR_USER=<dueño>    DB_MIGRATOR_PASSWORD=<la del dueño>

\set ON_ERROR_STOP on

-- Crear el rol si no existe (idempotente) y fijar su contraseña.
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
ALTER ROLE :"app_user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

-- Solo puede conectarse a ESTA base.
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user') \gexec

-- Sin CREATE en el schema: no puede crear tablas ni funciones.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";

-- Datos: lectura y escritura, sin TRUNCATE ni DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

-- Tablas y secuencias que creen las migraciones futuras (como el dueño)
-- reciben los mismos permisos automáticamente.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_user";

-- La bitácora es de solo-anexar: la app inserta y lee, nunca modifica ni borra.
-- (La migración 0005 hace lo mismo al crearla; esto cubre bases ya migradas.)
SELECT format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM %I', 'AuditLog', :'app_user')
WHERE to_regclass('public."AuditLog"') IS NOT NULL \gexec
