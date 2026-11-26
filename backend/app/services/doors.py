from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Cleanroom


def cleanroom_for_door(db: Session, door_id: str) -> Cleanroom | None:
    """Resolve a door ID without guessing across multiple cleanrooms."""
    rooms = db.scalars(select(Cleanroom).order_by(Cleanroom.id)).all()
    normalized = door_id.strip().casefold()
    if normalized == "entrada-principal":
        return next((room for room in rooms if room.id == 1), None)
    for room in rooms:
        code = room.code.strip().casefold()
        if normalized in {code, f"puerta-{code}"}:
            return room
    # Keep compatibility for a single-room installation with legacy door names.
    return rooms[0] if len(rooms) == 1 else None


def door_id_for_room(room: Cleanroom) -> str:
    return "entrada-principal" if room.id == 1 else f"puerta-{room.code.strip().lower()}"
