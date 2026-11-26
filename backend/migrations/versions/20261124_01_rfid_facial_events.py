"""Add RFID identity fields and employee biometric templates.

Revision ID: 20261124_01
Revises: 20261123_02
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20261124_01"
down_revision = "20261123_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("access_events"):
        existing = {column["name"] for column in inspector.get_columns("access_events")}
        new_columns = [
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
            sa.Column("rfid_uid", sa.String(length=64), nullable=True),
            sa.Column("door_id", sa.String(length=100), nullable=True, server_default="entrada-principal"),
            sa.Column("person_name", sa.String(length=150), nullable=True),
        ]
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("access_events") as batch:
                for column in new_columns:
                    if column.name not in existing:
                        batch.add_column(column)
        else:
            for column in new_columns:
                if column.name not in existing:
                    op.add_column("access_events", column)
        if "ix_access_events_employee_id" not in {index["name"] for index in inspect(bind).get_indexes("access_events")}:
            op.create_index("ix_access_events_employee_id", "access_events", ["employee_id"])

    if not inspect(bind).has_table("employee_biometrics"):
        op.create_table(
            "employee_biometrics",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
            sa.Column("sample_type", sa.String(length=50), nullable=False, server_default="full_face"),
            sa.Column("full_face_vector", sa.Text(), nullable=True),
            sa.Column("periocular_vector", sa.Text(), nullable=False),
            sa.Column("is_masked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("notes", sa.String(length=200), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_employee_biometrics_employee_id", "employee_biometrics", ["employee_id"])
    elif "is_masked" not in {column["name"] for column in inspect(bind).get_columns("employee_biometrics")}:
        op.add_column(
            "employee_biometrics",
            sa.Column("is_masked", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("employee_biometrics"):
        # The table is owned by this migration. Remove its index and table on downgrade.
        op.drop_index("ix_employee_biometrics_employee_id", table_name="employee_biometrics")
        op.drop_table("employee_biometrics")
    if inspect(bind).has_table("access_events"):
        existing = {column["name"] for column in inspect(bind).get_columns("access_events")}
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("access_events") as batch:
                for name in ("employee_id", "rfid_uid", "door_id", "person_name"):
                    if name in existing:
                        batch.drop_column(name)
        else:
            if "ix_access_events_employee_id" in {index["name"] for index in inspect(bind).get_indexes("access_events")}:
                op.drop_index("ix_access_events_employee_id", table_name="access_events")
            for name in ("employee_id", "rfid_uid", "door_id", "person_name"):
                if name in existing:
                    op.drop_column("access_events", name)
