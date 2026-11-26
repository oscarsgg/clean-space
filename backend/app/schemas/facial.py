from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class FacialEnrollRequest(BaseModel):
    employee_id: int
    image_base64: str = Field(min_length=100, max_length=8_000_000)
    sample_type: Literal["full_face", "masked_cleanroom", "eyes_only"] = "full_face"
    notes: Optional[str] = Field(default=None, max_length=200)


class FacialEnrollResponse(BaseModel):
    success: bool
    biometric_id: int
    employee_id: int
    sample_type: str
    is_masked: bool
    detection_confidence: float
    message: str


class FacialVerifyRequest(BaseModel):
    image_base64: str = Field(min_length=100, max_length=8_000_000)
    door_id: str = Field(default="entrada-principal", min_length=1, max_length=100)


class FacialVerifyResponse(BaseModel):
    authorized: bool
    reason: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    department: Optional[str] = None
    confidence_score: float = 0.0
    match_mode: str = "NONE"  # "FULL_FACE", "PERIOCULAR_EYES", "NONE"
    is_masked: bool = False
    low_light_enhanced: bool = False
    door_id: str
    door_unlocked: bool = False
    event_id: Optional[int] = None
    command_queued: bool = False
    command_id: Optional[int] = None


class FacialBiometricRead(BaseModel):
    id: int
    employee_id: int
    sample_type: str
    is_active: bool
    is_masked: bool = False
    created_at: datetime
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
