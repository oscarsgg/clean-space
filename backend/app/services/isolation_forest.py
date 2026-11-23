import json
import math
from collections import defaultdict
from itertools import combinations
from typing import Any

import numpy as np
from fastapi import HTTPException
from sklearn.ensemble import IsolationForest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import ensure_room_access
from app.models import AnalyticsRun, ModelResult, PreparedAnalyticsRecord, User
from app.services.ecbd import accessible_rooms, as_utc


CONTAMINATION = 0.1
MIN_GROUP_ROWS = 5
STABILITY_SEEDS = (17, 42, 73)
MAX_STORED_ANOMALIES = 500


def _jaccard(left: set[int], right: set[int]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 1.0


def _load_features(record: PreparedAnalyticsRecord) -> list[float] | None:
    if record.normalized_value is None or not math.isfinite(float(record.normalized_value)):
        return None
    try:
        features = json.loads(record.features_json or "{}")
        hour = float(features["hour_utc"]) / 23.0
        weekday = float(features["weekday_utc"]) / 6.0
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    row = [float(record.normalized_value), hour, weekday]
    return row if all(math.isfinite(value) for value in row) else None


def _authorize_run(db: Session, run: AnalyticsRun, user: User) -> None:
    if "ADMINISTRADOR" in {role.code for role in user.roles}:
        return

    allowed_room_ids = {room.id for room in accessible_rooms(db, user)}
    if run.cleanroom_id is not None:
        ensure_room_access(user, run.cleanroom_id)

    prepared_room_ids = set(db.scalars(
        select(PreparedAnalyticsRecord.cleanroom_id)
        .where(PreparedAnalyticsRecord.run_id == run.id)
        .distinct()
    ).all())
    if not prepared_room_ids.issubset(allowed_room_ids):
        raise HTTPException(403, "No tienes acceso a todos los cuartos incluidos en esta ejecución")


def train_isolation_forest(db: Session, user: User, run_id: int) -> ModelResult:
    """Train per-room/metric forests from one immutable ETL dataset."""
    run = db.get(AnalyticsRun, run_id)
    if not run:
        raise HTTPException(404, "No encontramos el conjunto preparado solicitado")
    if run.status != "COMPLETED":
        raise HTTPException(409, "La preparación seleccionada no terminó correctamente")
    _authorize_run(db, run, user)

    records = db.scalars(
        select(PreparedAnalyticsRecord)
        .where(
            PreparedAnalyticsRecord.run_id == run.id,
            PreparedAnalyticsRecord.source_type == "sensor_reading",
        )
        .order_by(
            PreparedAnalyticsRecord.cleanroom_id.asc(),
            PreparedAnalyticsRecord.metric.asc(),
            PreparedAnalyticsRecord.unit.asc(),
            PreparedAnalyticsRecord.observed_at.asc(),
            PreparedAnalyticsRecord.source_id.asc(),
        )
    ).all()

    grouped_records: dict[tuple[int, str, str], list[tuple[PreparedAnalyticsRecord, list[float]]]] = defaultdict(list)
    unusable_rows = 0
    for record in records:
        features = _load_features(record)
        if features is None or record.cleanroom_id is None or not record.metric or not record.unit:
            unusable_rows += 1
            continue
        key = (record.cleanroom_id, record.metric, record.unit)
        grouped_records[key].append((record, features))

    anomalies: list[dict[str, Any]] = []
    group_results: list[dict[str, Any]] = []
    metrics_included: set[str] = set()
    predicted_rows = 0
    anomalies_detected = 0
    pairwise_stabilities: list[float] = []
    skipped_groups: list[dict[str, Any]] = []

    for (room_id, metric, unit), items in sorted(grouped_records.items()):
        if len(items) < MIN_GROUP_ROWS:
            skipped_groups.append({
                "cleanroom_id": room_id,
                "metric": metric,
                "unit": unit,
                "rows": len(items),
                "reason": "Se requieren al menos 5 lecturas preparadas.",
            })
            continue

        matrix = np.asarray([features for _record, features in items], dtype=float)
        predictions_by_seed: dict[int, np.ndarray] = {}
        decisions_by_seed: dict[int, np.ndarray] = {}
        for seed in STABILITY_SEEDS:
            model = IsolationForest(
                contamination=CONTAMINATION,
                random_state=seed,
                n_estimators=100,
            )
            predictions_by_seed[seed] = model.fit_predict(matrix)
            decisions_by_seed[seed] = model.decision_function(matrix)

        final_predictions = predictions_by_seed[42]
        final_decisions = decisions_by_seed[42]
        flagged_by_seed = {
            seed: {idx for idx, prediction in enumerate(predictions) if int(prediction) == -1}
            for seed, predictions in predictions_by_seed.items()
        }
        group_stabilities = [
            _jaccard(flagged_by_seed[left], flagged_by_seed[right])
            for left, right in combinations(STABILITY_SEEDS, 2)
        ]
        group_stability = float(np.mean(group_stabilities)) if group_stabilities else 1.0
        pairwise_stabilities.extend(group_stabilities)

        group_anomalies = int(np.count_nonzero(final_predictions == -1))
        predicted_rows += len(items)
        anomalies_detected += group_anomalies
        metrics_included.add(metric)
        group_results.append({
            "cleanroom_id": room_id,
            "metric": metric,
            "unit": unit,
            "rows": len(items),
            "anomalies_detected": group_anomalies,
            "anomaly_rate": round(group_anomalies / len(items), 4),
            "stability_jaccard": round(group_stability, 4),
        })

        for index, prediction in enumerate(final_predictions):
            if int(prediction) != -1:
                continue
            record = items[index][0]
            decision_score = float(final_decisions[index])
            anomalies.append({
                "reading_id": record.source_id,
                "prepared_record_id": record.id,
                "cleanroom_id": room_id,
                "metric": metric,
                "value": round(float(record.value), 3) if record.value is not None else None,
                "unit": unit,
                "recorded_at": as_utc(record.observed_at).isoformat(),
                # Lower decision scores are more unusual in Isolation Forest.
                "anomaly_score": round(decision_score, 6),
            })

    anomalies.sort(key=lambda item: item["anomaly_score"])
    overall_stability = float(np.mean(pairwise_stabilities)) if pairwise_stabilities else None
    anomaly_rate = round(anomalies_detected / predicted_rows, 4) if predicted_rows else 0.0
    status = "trained" if predicted_rows else "insufficient_data"
    result_payload = {
        "status": status,
        "run_id": run.id,
        "run_started_at": run.started_at.isoformat(),
        "period": {"start_at": run.period_start.isoformat(), "end_at": run.period_end.isoformat()},
        "cleanroom_id": run.cleanroom_id,
        "prepared_rows": len(records),
        "training_rows": predicted_rows,
        "unusable_rows": unusable_rows,
        "groups_total": len(grouped_records),
        "groups_trained": len(group_results),
        "groups_skipped": skipped_groups,
        "anomalies_detected": anomalies_detected,
        # This is the fraction marked by the configured model, not a verified real-world anomaly prevalence.
        "anomaly_rate": anomaly_rate,
        "metrics_included": sorted(metrics_included),
        "parameters": {
            "contamination": CONTAMINATION,
            "random_state": 42,
            "stability_seeds": list(STABILITY_SEEDS),
            "n_estimators": 100,
            "minimum_group_rows": MIN_GROUP_ROWS,
            "features": ["normalized_value", "hour_utc", "weekday_utc"],
        },
        "evaluation": {
            "method": "stability_jaccard_across_random_seeds",
            "mean_jaccard": round(overall_stability, 4) if overall_stability is not None else None,
            "groups_evaluated": len(group_results),
            "seed_count": len(STABILITY_SEEDS),
            "uses_ground_truth_labels": False,
            "interpretation": "Mide qué tanto se repiten las lecturas señaladas al cambiar la semilla; no equivale a precisión ni confirma que una lectura sea una falla real.",
        },
        "groups": group_results,
        "anomalies_available": min(len(anomalies), MAX_STORED_ANOMALIES),
        "anomalies_truncated": len(anomalies) > MAX_STORED_ANOMALIES,
        "anomalies": anomalies[:MAX_STORED_ANOMALIES],
    }

    result = ModelResult(
        cleanroom_id=run.cleanroom_id,
        analytics_run_id=run.id,
        model_type="isolation_forest",
        metric="per_room_metric",
        score=overall_stability,
        result_json=json.dumps(result_payload, ensure_ascii=False, allow_nan=False),
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result
