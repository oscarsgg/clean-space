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
    """Safely add columns introduced after initial database creation."""
    inspector = inspect(target_engine)
    if not inspector.has_table("cleanrooms"):
        return
    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as conn:
            conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 8"))
            conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN IF NOT EXISTS iso_class VARCHAR(20) DEFAULT 'ISO 7'"))
            conn.execute(text("UPDATE cleanrooms SET capacity = 8 WHERE capacity IS NULL"))
            conn.execute(text("UPDATE cleanrooms SET iso_class = 'ISO 7' WHERE iso_class IS NULL"))
    else:
        existing_columns = {col["name"] for col in inspector.get_columns("cleanrooms")}
        with target_engine.begin() as conn:
            if "capacity" not in existing_columns:
                conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN capacity INTEGER DEFAULT 8"))
            if "iso_class" not in existing_columns:
                conn.execute(text("ALTER TABLE cleanrooms ADD COLUMN iso_class VARCHAR(20) DEFAULT 'ISO 7'"))

    inspector = inspect(target_engine)
    if inspector.has_table("access_events"):
        existing_columns = {col["name"] for col in inspector.get_columns("access_events")}
        additions = {
            "employee_id": "INTEGER",
            "rfid_uid": "VARCHAR(64)",
            "door_id": "VARCHAR(100) DEFAULT 'entrada-principal'",
            "person_name": "VARCHAR(150)",
        }
        with target_engine.begin() as conn:
            for column, sql_type in additions.items():
                if column not in existing_columns:
                    conn.execute(text(f"ALTER TABLE access_events ADD COLUMN {column} {sql_type}"))
            if "door_id" not in existing_columns:
                conn.execute(text("UPDATE access_events SET door_id = 'entrada-principal' WHERE door_id IS NULL"))

    inspector = inspect(target_engine)
    if inspector.has_table("model_results") and inspector.has_table("analytics_runs"):
        model_columns = {col["name"] for col in inspector.get_columns("model_results")}
        model_indexes = {index["name"] for index in inspector.get_indexes("model_results")}
        with target_engine.begin() as conn:
            if "analytics_run_id" not in model_columns:
                if target_engine.dialect.name == "postgresql":
                    conn.execute(text(
                        "ALTER TABLE model_results ADD COLUMN IF NOT EXISTS analytics_run_id INTEGER "
                        "REFERENCES analytics_runs(id) ON DELETE SET NULL"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE model_results ADD COLUMN analytics_run_id INTEGER "
                        "REFERENCES analytics_runs(id) ON DELETE SET NULL"
                    ))
            if "ix_model_results_analytics_run_id" not in model_indexes:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_model_results_analytics_run_id ON model_results (analytics_run_id)"
                ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
