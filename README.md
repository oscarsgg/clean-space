# CleanSpace

Aplicación web para la gestión y supervisión de espacios limpios. El proyecto reúne una interfaz web, una API y una base de datos para centralizar operaciones de acceso, personas, salas, dispositivos y monitoreo.

> **Estado del proyecto:** prototipo de desarrollo. Las credenciales y claves incluidas por defecto son únicamente para uso local; no las uses en producción.

## Contenido

- [Qué incluye](#qué-incluye)
- [Requisitos](#requisitos)
- [Primer inicio con Docker](#primer-inicio-con-docker-recomendado)
- [Inicios posteriores](#inicios-posteriores)
- [Ejecutar el frontend con `npm run dev`](#ejecutar-el-frontend-con-npm-run-dev)
- [Accesos locales](#accesos-locales)
- [Datos de demostración y login](#datos-de-demostración-y-login)
- [Comandos útiles](#comandos-útiles)
- [Solución de problemas](#solución-de-problemas)
- [Despliegue](#despliegue)

## Qué incluye

- **Frontend:** Next.js, React y TypeScript. Incluye pantallas para acceso, personas, salas, dispositivos, avisos, análisis y monitoreo.
- **API:** FastAPI con endpoints REST para autenticación, administración, acceso, dispositivos y monitoreo.
- **Base de datos:** PostgreSQL, ejecutado como servicio Docker.
- **Datos iniciales:** un script para crear usuarios, roles, salas y dispositivos de demostración.

## Requisitos

- Windows, macOS o Linux.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) con Docker Compose.
- Para ejecutar el frontend fuera de Docker: Node.js y Corepack (incluidos en las versiones actuales de Node.js).

## Primer inicio con Docker (recomendado)

Abre PowerShell en la carpeta raíz del proyecto, donde se encuentra `docker-compose.yml`.

Construye las imágenes e inicia PostgreSQL, la API y el frontend:

```powershell
docker compose up --build -d
```

Espera a que la base esté lista y carga los datos de demostración:

```powershell
docker compose ps
docker compose exec api python -m scripts.seed_data
```

El comando de carga debe mostrar `Seed completado`. Se ejecuta una vez por cada base de datos nueva; no hace falta volver a cargar los datos en cada inicio.

Abre [http://localhost:3000](http://localhost:3000) para usar la aplicación.

## Inicios posteriores

Si ya construiste el proyecto y cargaste los datos, inicia los servicios con:

```powershell
docker compose up -d
```

Comprueba que estén activos:

```powershell
docker compose ps
```

Luego vuelve a [http://localhost:3000](http://localhost:3000). No es necesario volver a ejecutar el script de datos cada vez.

Para reconstruir las imágenes cuando cambie el código o la configuración:

```powershell
docker compose up --build -d
```

Para detener los servicios sin borrar la base de datos:

```powershell
docker compose down
```

Al volver a iniciar, PostgreSQL conserva los datos en un volumen de Docker.

## Ejecutar el frontend con `npm run dev`

También puedes ejecutar Next.js localmente y dejar PostgreSQL y la API dentro de Docker. Desde la raíz del proyecto:

```powershell
docker compose up -d db api
docker compose stop frontend
npx --yes pnpm@12.3.4 install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Deja abierta esa terminal mientras trabajas; para detener el servidor de desarrollo, pulsa `Ctrl+C`.

El proyecto usa `pnpm` y mantiene sus versiones en `pnpm-lock.yaml`; por eso se recomienda `npx --yes pnpm@12.3.4 install` para instalar dependencias, aunque el servidor se inicie con el script `npm run dev`.

Para volver a usar el frontend de Docker después de detener el servidor local:

```powershell
docker compose up -d frontend
```

## Accesos locales

| Servicio | Dirección |
| --- | --- |
| Aplicación web | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:8000](http://localhost:8000) |
| Documentación interactiva de la API | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Salud de la API | [http://localhost:8000/health](http://localhost:8000/health) |
| PostgreSQL | `localhost:5437` (no es una página web) |

## Datos de demostración y login

Con la configuración predeterminada, el usuario administrador es:

```text
Correo:       admin@cleanspace.local
Contraseña:   change_this_admin_password_123
```

El script también crea cuentas de demostración para supervisor y personal:

```text
Supervisor: supervisor@cleanspace.local / Supervisor_123!
Personal:   personal@cleanspace.local   / Personal_123!
```

Estas contraseñas son públicas y solo sirven para desarrollo local. Cámbialas antes de usar datos reales o publicar la aplicación.

La contraseña inicial del administrador se toma de `INITIAL_ADMIN_PASSWORD`. Si el administrador ya existe en la base, volver a ejecutar `seed_data` **no cambia** su contraseña. Para ajustar credenciales futuras, puedes crear un archivo `.env` en la raíz y definir allí las variables; no compartas ni subas ese archivo a GitHub.

## Configuración

Docker Compose incluye valores predeterminados para desarrollo local. Como punto de partida para revisar las variables disponibles, consulta [`backend/.env.example`](./backend/.env.example). Compose configura la dirección interna de PostgreSQL para que la API pueda conectarse desde su contenedor.

Antes de exponer la API en una red o desplegar el proyecto, configura valores privados y seguros para `JWT_SECRET_KEY`, `RFID_HMAC_KEY`, `CLEANSPACE_ADMIN_KEY`, `CLEANSPACE_DEVICE_KEY` e `INITIAL_ADMIN_PASSWORD`; configura también los orígenes permitidos en `CORS_ORIGINS`.

## Comandos útiles

Ejecutar la carga de demostración:

```powershell
docker compose exec api python -m scripts.seed_data
```

Ver los registros de todos los servicios:

```powershell
docker compose logs -f
```

Ver los registros de un servicio:

```powershell
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f db
```

Reiniciar un servicio:

```powershell
docker compose restart api
```

## Solución de problemas

### El login responde `401 Unauthorized`

Confirma que ejecutaste la carga de datos:

```powershell
docker compose exec api python -m scripts.seed_data
```

Usa el correo y la contraseña de desarrollo de la sección [Datos de demostración y login](#datos-de-demostración-y-login). Si el usuario ya existía, el script no sobrescribe su contraseña.

### Python no encuentra `scripts.seed_data`

Reconstruye la imagen de la API para incluir los scripts y vuelve a intentar:

```powershell
docker compose up -d --build api
docker compose exec api python -m scripts.seed_data
```

### El puerto 3000 ya está ocupado

Puede que el frontend de Docker y el servidor local de Next.js estén intentando usar el mismo puerto. Detén uno de ellos. Para usar el servidor local:

```powershell
docker compose stop frontend
npm run dev
```

### Aparecen respuestas `404` para `/` o `/favicon.ico` en los registros de la API

La API no sirve la interfaz web en esas rutas. Abre la aplicación en `http://localhost:3000`; la documentación de la API está en `http://localhost:8000/docs`.

### Quiero empezar de cero

**Atención:** el siguiente comando elimina permanentemente los datos locales de PostgreSQL del proyecto:

```powershell
docker compose down -v
docker compose up --build -d
docker compose exec api python -m scripts.seed_data
```

No uses `-v` si quieres conservar usuarios y demás información de la base de datos.

## Despliegue

Publicar el frontend en Vercel no publica automáticamente la API ni PostgreSQL. Para que la aplicación funcione fuera de tu computadora, también necesitas desplegar la API y la base de datos en servicios accesibles por Internet, configurar una URL HTTPS pública para la API y permitir el dominio del frontend en `CORS_ORIGINS`. No expongas las claves privadas en variables `NEXT_PUBLIC_*`.

## Estructura principal

```text
.
├── app/                 # Rutas y páginas Next.js
├── components/          # Componentes de interfaz
├── lib/                 # Cliente y utilidades del frontend
├── backend/
│   ├── app/             # Aplicación FastAPI, modelos y endpoints
│   ├── scripts/         # Carga de datos de demostración
│   └── tests/           # Pruebas del backend
├── Dockerfile           # Imagen del frontend
├── docker-compose.yml   # Frontend, API y PostgreSQL
└── README.md
```
