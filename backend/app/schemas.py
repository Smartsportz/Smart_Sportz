from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=3)


class LoginOtpVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=120)
    code: str = Field(min_length=4, max_length=8)


class SignupStartRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=6, max_length=80)
    channel: str = Field(pattern="^(email|sms)$")


class SignupVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=120)
    code: str = Field(min_length=4, max_length=8)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class RegistrationMemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(default="Player", max_length=40)
    jersey: str | None = Field(default=None, max_length=20)
    contact: str | None = Field(default=None, max_length=40)


class RegistrationDocumentCreate(BaseModel):
    document_type: str = Field(min_length=2, max_length=80)
    file_name: str = Field(min_length=2, max_length=180)
    file_path: str = Field(min_length=1, max_length=500)
    status: str = Field(default="uploaded", pattern="^(required|pending|uploaded)$")


class RegistrationCreate(BaseModel):
    tournament_slug: str
    team_name: str = Field(min_length=2, max_length=120)
    team_code: str = Field(default="", max_length=40)
    captain_name: str = Field(min_length=2, max_length=120)
    sub_captain_name: str = Field(min_length=2, max_length=120)
    coach_name: str = Field(default="", max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    city: str = Field(min_length=2, max_length=80)
    district_state: str = Field(default="", max_length=120)
    team_logo: str = Field(default="", max_length=500)
    primary_jersey_color: str = Field(default="#0b8852", max_length=20)
    secondary_jersey_color: str = Field(default="#ffffff", max_length=20)
    team_motto: str = Field(default="", max_length=180)
    category: str = Field(default="", max_length=80)
    members: list[RegistrationMemberCreate] = []
    documents: list[RegistrationDocumentCreate] = []


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
    status: str = Field(pattern="^(Upcoming|Registration Open|Registration Closed|Live|Completed)$")
    registration_start: str = Field(min_length=3, max_length=40)
    registration_end: str = Field(min_length=3, max_length=40)


class TournamentCitiesPayload(BaseModel):
    cities: list[str] = Field(min_length=1, max_length=12)


class NewsBlockPayload(BaseModel):
    block_type: str = Field(pattern="^(heading|paragraph|bold|italic|list|quote|image)$")
    content: str = Field(min_length=1, max_length=1200)


class NewsPostPayload(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    short_description: str = Field(min_length=10, max_length=320)
    image: str = Field(min_length=3, max_length=500)
    category: str = Field(pattern="^(Winner Teams|Match Updates|Tournament Updates|Announcements)$")
    sport: str = Field(min_length=2, max_length=80)
    tournament_slug: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    status: str = Field(default="draft", pattern="^(draft|published)$")
    is_highlight: bool = False
    blocks: list[NewsBlockPayload] = Field(default_factory=list)


class SportHomeVisibilityPayload(BaseModel):
    show_on_home: bool
    sort_order: int = Field(default=1, ge=1, le=99)


class ManagerCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=3, max_length=80)
    cities: list[str] = Field(min_length=1, max_length=12)


class ManagerCitiesPayload(BaseModel):
    cities: list[str] = Field(min_length=1, max_length=12)


class LocalPaymentCreate(BaseModel):
    registration_id: str
    method: str = "local"
    amount: int | None = Field(default=None, gt=0, le=10000000)


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
