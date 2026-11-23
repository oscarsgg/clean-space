Las migraciones Alembic versionan los cambios del almacenamiento. Ejecuta los comandos desde `backend` con el entorno virtual activo y `DATABASE_URL` apuntando a la base deseada:

```powershell
alembic upgrade head
```

Para cambios posteriores al esquema, crea una revisión, revisa el SQL generado y aplícala:

```powershell
alembic revision --autogenerate -m "describe el cambio"
alembic upgrade head
```

Las primeras revisiones crean las tablas de seguimiento y conjunto preparado del módulo analítico y enlazan cada resultado del modelo con su ejecución. Las tablas base del prototipo aún se crean al iniciar la aplicación; deben consolidarse en una revisión base antes de gestionar una instalación vacía exclusivamente con migraciones.
