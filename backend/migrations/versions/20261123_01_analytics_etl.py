"""Add persisted analytics preparation runs and source-linked records.

Revision ID: 20261123_01
Revises:
Create Date: 2026-11-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20261123_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "analytics_runs" not in tables:
        op.create_table(
            "analytics_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("initiated_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("cleanroom_id", sa.Integer(), sa.ForeignKey("cleanrooms.id", ondelete="SET NULL"), nullable=True),
            sa.Column("status", sa.String(length=24), nullable=False, server_default="RUNNING"),
            sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
            sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
            sa.Column("source_readings", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("prepared_readings", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("source_accesses", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("prepared_accesses", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("summary_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "prepared_analytics_records" not in tables:
        op.create_table(
            "prepared_analytics_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("run_id", sa.Integer(), sa.ForeignKey("analytics_runs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_type", sa.String(length=24), nullable=False),
            sa.Column("source_id", sa.Integer(), nullable=False),
            sa.Column("cleanroom_id", sa.Integer(), sa.ForeignKey("cleanrooms.id", ondelete="SET NULL"), nullable=True),
            sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("metric", sa.String(length=50), nullable=True),
            sa.Column("value", sa.Float(), nullable=True),
            sa.Column("unit", sa.String(length=20), nullable=True),
            sa.Column("category", sa.String(length=48), nullable=True),
            sa.Column("normalized_value", sa.Float(), nullable=True),
            sa.Column("features_json", sa.Text(), nullable=False, server_default="{}"),
            sa.UniqueConstraint("run_id", "source_type", "source_id", name="uq_prepared_run_source"),
        )

    indexes = {
        table: {index["name"] for index in inspect(bind).get_indexes(table)}
        for table in ("analytics_runs", "prepared_analytics_records")
    }
    index_definitions = (
        ("ix_analytics_runs_status", "analytics_runs", ["status"]),
        ("ix_analytics_runs_started_at", "analytics_runs", ["started_at"]),
        ("ix_prepared_analytics_records_run_id", "prepared_analytics_records", ["run_id"]),
        ("ix_prepared_analytics_records_source_type", "prepared_analytics_records", ["source_type"]),
        ("ix_prepared_analytics_records_cleanroom_id", "prepared_analytics_records", ["cleanroom_id"]),
        ("ix_prepared_analytics_records_observed_at", "prepared_analytics_records", ["observed_at"]),
        ("ix_prepared_run_room_time", "prepared_analytics_records", ["run_id", "cleanroom_id", "observed_at"]),
    )
    for name, table, columns in index_definitions:
        if name not in indexes[table]:
            op.create_index(name, table, columns)


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "prepared_analytics_records" in tables:
        indexes = {item["name"] for item in inspect(bind).get_indexes("prepared_analytics_records")}
        for name in (
            "ix_prepared_run_room_time",
            "ix_prepared_analytics_records_observed_at",
            "ix_prepared_analytics_records_cleanroom_id",
            "ix_prepared_analytics_records_source_type",
            "ix_prepared_analytics_records_run_id",
        ):
            if name in indexes:
                op.drop_index(name, table_name="prepared_analytics_records")
        op.drop_table("prepared_analytics_records")
    if "analytics_runs" in tables:
        indexes = {item["name"] for item in inspect(bind).get_indexes("analytics_runs")}
        for name in ("ix_analytics_runs_started_at", "ix_analytics_runs_status"):
            if name in indexes:
                op.drop_index(name, table_name="analytics_runs")
        op.drop_table("analytics_runs")
