from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now


class AnalyticsRun(Base):
    """Auditable execution of the analytics data preparation pipeline."""

    __tablename__ = "analytics_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    initiated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cleanroom_id: Mapped[int | None] = mapped_column(ForeignKey("cleanrooms.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="RUNNING", index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_readings: Mapped[int] = mapped_column(Integer, default=0)
    prepared_readings: Mapped[int] = mapped_column(Integer, default=0)
    source_accesses: Mapped[int] = mapped_column(Integer, default=0)
    prepared_accesses: Mapped[int] = mapped_column(Integer, default=0)
    summary_json: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PreparedAnalyticsRecord(Base):
    """Immutable, run-scoped analytical copy of a source reading or access event."""

    __tablename__ = "prepared_analytics_records"
    __table_args__ = (
        UniqueConstraint("run_id", "source_type", "source_id", name="uq_prepared_run_source"),
        Index("ix_prepared_run_room_time", "run_id", "cleanroom_id", "observed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analytics_runs.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(24), index=True)
    source_id: Mapped[int] = mapped_column(Integer)
    cleanroom_id: Mapped[int | None] = mapped_column(ForeignKey("cleanrooms.id", ondelete="SET NULL"), nullable=True, index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    metric: Mapped[str | None] = mapped_column(String(50), nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    category: Mapped[str | None] = mapped_column(String(48), nullable=True)
    normalized_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    features_json: Mapped[str] = mapped_column(Text, default="{}")
