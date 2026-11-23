import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cleanspace.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL, connect_args=connect_args)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_schema_updates(target_engine=engine):
    """Safely add new cleanrooms and access_events columns on existing PostgreSQL or SQLite databases and sync sequences."""
    inspector = inspect(target_engine)
    if not inspector.has_table("cleanrooms"):
        return
    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as conn:
            conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 8"))
            conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN IF NOT EXISTS iso_class VARCHAR(20) DEFAULT 'ISO 7'"))
            conn.execute(text("UPDATE cleanrooms SET capacity = 8 WHERE capacity IS NULL"))
            conn.execute(text("UPDATE cleanrooms SET iso_class = 'ISO 7' WHERE iso_class IS NULL"))

            # Update access_events table columns
            if inspector.has_table("access_events"):
                conn.execute(text("ALTER TABLE access_events ADD COLUMN IF NOT EXISTS door_id VARCHAR(100) DEFAULT 'entrada-principal'"))
                conn.execute(text("ALTER TABLE access_events ADD COLUMN IF NOT EXISTS rfid_uid VARCHAR(64)"))
                conn.execute(text("ALTER TABLE access_events ADD COLUMN IF NOT EXISTS person_name VARCHAR(150)"))
                conn.execute(text("ALTER TABLE access_events ADD COLUMN IF NOT EXISTS employee_id INTEGER"))
                conn.execute(text("UPDATE access_events SET door_id = 'entrada-principal' WHERE door_id IS NULL"))

            # Sync PostgreSQL sequences with max(id) to prevent duplicate key errors on insert
            for table in [
                "employees",
                "door_access_permissions",
                "access_events",
                "access_logs",
                "users",
                "cleanrooms",
                "devices",
                "alerts",
                "commands",
                "sensor_readings",
                "rfid_cards",
                "refresh_sessions",
                "employee_biometrics",
            ]:
                if inspector.has_table(table):
                    seq_name = f"{table}_id_seq" if table != "door_access_permissions" else "door_access_permissions_id_seq"
                    try:
                        conn.execute(text(f"SELECT setval('{seq_name}', COALESCE((SELECT max(id) FROM {table}), 1))"))
                    except Exception:
                        pass
    else:
        existing_columns = {col["name"] for col in inspector.get_columns("cleanrooms")}
        with target_engine.begin() as conn:
            if "capacity" not in existing_columns:
                conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN capacity INTEGER DEFAULT 8"))
            if "iso_class" not in existing_columns:
                conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN iso_class VARCHAR(20) DEFAULT 'ISO 7'"))
            if inspector.has_table("access_events"):
                ae_cols = {col["name"] for col in inspector.get_columns("access_events")}
                if "door_id" not in ae_cols:
                    conn.execute(text("ALTER TABLE access_events ADD COLUMN door_id VARCHAR(100) DEFAULT 'entrada-principal'"))
                if "rfid_uid" not in ae_cols:
                    conn.execute(text("ALTER TABLE access_events ADD COLUMN rfid_uid VARCHAR(64)"))
                if "person_name" not in ae_cols:
                    conn.execute(text("ALTER TABLE access_events ADD COLUMN person_name VARCHAR(150)"))
                if "employee_id" not in ae_cols:
                    conn.execute(text("ALTER TABLE access_events ADD COLUMN employee_id INTEGER"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()