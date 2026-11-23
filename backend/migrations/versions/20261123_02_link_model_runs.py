"""Link model results to their prepared analytics run.

Revision ID: 20261123_02
Revises: 20261123_01
Create Date: 2026-11-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20261123_02"
down_revision = "20261123_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "analytics_run_id" not in {column["name"] for column in inspector.get_columns("model_results")}:
        op.add_column(
            "model_results",
            sa.Column("analytics_run_id", sa.Integer(), sa.ForeignKey("analytics_runs.id", ondelete="SET NULL"), nullable=True),
        )
    indexes = {item["name"] for item in inspect(bind).get_indexes("model_results")}
    if "ix_model_results_analytics_run_id" not in indexes:
        op.create_index("ix_model_results_analytics_run_id", "model_results", ["analytics_run_id"])


def downgrade() -> None:
    bind = op.get_bind()
    indexes = {item["name"] for item in inspect(bind).get_indexes("model_results")}
    if "ix_model_results_analytics_run_id" in indexes:
        op.drop_index("ix_model_results_analytics_run_id", table_name="model_results")
    columns = {item["name"] for item in inspect(bind).get_columns("model_results")}
    if "analytics_run_id" in columns:
        with op.batch_alter_table("model_results") as batch_op:
            batch_op.drop_column("analytics_run_id")
