from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=3)


class RegistrationMemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(default="Player", max_length=40)
    jersey: str | None = Field(default=None, max_length=20)
    contact: str | None = Field(default=None, max_length=40)


class RegistrationCreate(BaseModel):
    tournament_slug: str
    team_name: str = Field(min_length=2, max_length=120)
    captain_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    city: str = Field(min_length=2, max_length=80)
    members: list[RegistrationMemberCreate] = []


class BracketNodePayload(BaseModel):
    id: str
    label: str
    team: str | None = ""
    round: str
    x: int
    y: int
    status: str = "empty"


class BracketConnectionPayload(BaseModel):
    id: str | None = None
    source_id: str
    target_id: str


class BracketSavePayload(BaseModel):
    nodes: list[BracketNodePayload]
    connections: list[BracketConnectionPayload]
    publish: bool = True
    audit_reason: str = Field(default="Manager saved bracket workspace", max_length=300)


class WinnerAdvancePayload(BaseModel):
    winner_team: str = Field(min_length=2, max_length=120)
    target_node_id: str
    audit_reason: str = Field(default="Winner advanced from live score result", max_length=300)


class NotificationSendPayload(BaseModel):
    channels: list[str] = Field(min_length=1)
    message: str = Field(min_length=3, max_length=500)
    audience: str = "accepted_teams"


class TournamentTeamSizePayload(BaseModel):
    team_size: int = Field(ge=2, le=60)


class TournamentRegistrationWindowPayload(BaseModel):
    status: str = Field(pattern="^(Upcoming|Registration Open|Live|Completed)$")
    registration_start: str = Field(min_length=3, max_length=40)
    registration_end: str = Field(min_length=3, max_length=40)


class TournamentCitiesPayload(BaseModel):
    cities: list[str] = Field(min_length=1, max_length=12)


class LocalPaymentCreate(BaseModel):
    registration_id: str
    method: str = "local"


class PaymentIntentCreate(BaseModel):
    tournament_slug: str = Field(min_length=2, max_length=120)
    team_name: str = Field(min_length=2, max_length=120)
    amount: int = Field(gt=0, le=10000000)
    method: str = Field(pattern="^(card|upi)$")
    contact: str = Field(min_length=3, max_length=80)


class PaymentIntentConfirm(BaseModel):
    status: str = Field(default="paid", pattern="^(paid|failed|cancelled)$")
    method: str = Field(pattern="^(card|upi)$")


class LiveScoreUpdate(BaseModel):
    score: str
    away_score: str | None = None
    stage: str
    status: str = "Live Now"
    event_type: str = "COMMENTARY"
    commentary: str = Field(min_length=3, max_length=500)
    time: str = "now"


class CmsUpdate(BaseModel):
    title: str
    body: str
    published: bool = True


class AnnouncementCreate(BaseModel):
    tournament_slug: str
    title: str
    message: str
