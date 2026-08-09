from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=3)


class LoginOtpVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=120)
    code: str = Field(min_length=4, max_length=8)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class SignupStartRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=6, max_length=80)
    channel: str = Field(default="whatsapp", pattern="^(whatsapp)$")


class SignupVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=120)
    code: str = Field(min_length=4, max_length=8)


class ForgotPasswordStartRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResetRequest(BaseModel):
    challenge_id: str = Field(min_length=8, max_length=120)
    code: str = Field(min_length=4, max_length=8)
    password: str = Field(min_length=6, max_length=80)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class RegistrationMemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(default="Player", max_length=40)
    jersey: str | None = Field(default=None, max_length=20000000)
    contact: str | None = Field(default=None, max_length=40)
    age: int | None = Field(default=None, ge=0, le=120)
    jersey_size: str | None = Field(default=None, max_length=20)


class RegistrationDocumentCreate(BaseModel):
    document_type: str = Field(min_length=2, max_length=80)
    file_name: str = Field(min_length=2, max_length=180)
    file_path: str = Field(min_length=1, max_length=20000000)
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
    team_logo: str = Field(default="", max_length=20000000)
    selected_jersey_image: str = Field(default="", max_length=20000000)
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
    bucket: str = Field(default="main", max_length=40)
    scheduled_at: str = Field(default="", max_length=80)


class BracketConnectionPayload(BaseModel):
    id: str | None = None
    source_id: str
    target_id: str


class BracketRoundSchedulePayload(BaseModel):
    round: str
    scheduled_at: str = Field(default="", max_length=80)
    bucket: str = Field(default="all", max_length=40)


class BracketSavePayload(BaseModel):
    nodes: list[BracketNodePayload]
    connections: list[BracketConnectionPayload]
    round_schedules: list[BracketRoundSchedulePayload] = []
    bucket_mode: str = Field(default="single", pattern="^(single|double)$")
    publish: bool = True
    audit_reason: str = Field(default="Manager saved bracket workspace", max_length=300)


class GroupBracketMatchPayload(BaseModel):
    id: str | None = Field(default=None, max_length=120)
    round: str = Field(min_length=1, max_length=80)
    team_1: str = Field(default="", max_length=160)
    team_2: str = Field(default="", max_length=160)
    starts_at: str = Field(default="", max_length=80)
    ends_at: str = Field(default="", max_length=80)
    status: str = Field(default="upcoming", pattern="^(upcoming|live|completed)$")
    sort_order: int = Field(default=1, ge=1, le=500)


class GroupBracketSavePayload(BaseModel):
    matches: list[GroupBracketMatchPayload] = Field(default_factory=list, max_length=500)
    publish: bool = True
    audit_reason: str = Field(default="Saved group bracket table", max_length=300)


class WinnerAdvancePayload(BaseModel):
    winner_team: str = Field(min_length=2, max_length=120)
    target_node_id: str
    audit_reason: str = Field(default="Winner advanced from live score result", max_length=300)


class NotificationSendPayload(BaseModel):
    channels: list[str] = Field(default_factory=lambda: ["whatsapp"], min_length=1)
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


class TournamentJerseyPayload(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    image: str = Field(default="", max_length=20000000)


class TournamentJerseysPayload(BaseModel):
    jerseys: list[TournamentJerseyPayload] = Field(min_length=1, max_length=100)


class TournamentFeeLinePayload(BaseModel):
    label: str = Field(min_length=2, max_length=80)
    value: int = Field(ge=0, le=100000000)


class TournamentPrizePayload(BaseModel):
    position: int = Field(ge=1, le=20)
    label: str = Field(min_length=2, max_length=80)
    amount: int = Field(ge=0, le=100000000)


class TournamentUpsertPayload(BaseModel):
    slug: str | None = Field(default=None, max_length=120)
    name: str = Field(min_length=3, max_length=160)
    sport: str = Field(min_length=2, max_length=80)
    new_sport_name: str | None = Field(default=None, max_length=80)
    status: str = Field(default="Upcoming", pattern="^(Upcoming|Registration Open|Registration Closed|Live|Completed)$")
    location: str = Field(min_length=2, max_length=80)
    date: str = Field(min_length=3, max_length=80)
    registration_start: str = Field(min_length=3, max_length=40)
    registration_end: str = Field(min_length=3, max_length=40)
    teams: int = Field(default=0, ge=0, le=10000)
    capacity: int = Field(default=32, ge=2, le=10000)
    team_size: int = Field(default=16, ge=2, le=60)
    min_team_size: int = Field(default=2, ge=2, le=60)
    max_team_size: int = Field(default=16, ge=2, le=60)
    min_age: int = Field(default=18, ge=0, le=120)
    max_age: int = Field(default=45, ge=0, le=120)
    prize: str = Field(default="INR 0", max_length=80)
    image: str = Field(default="/assets/cricket-stadium.png", max_length=20000000)
    poster: str = Field(default="/assets/poster.jpeg", max_length=20000000)
    accent: str = Field(default="emerald", max_length=40)
    address: str = Field(default="", max_length=500)
    sport_description: str = Field(default="", max_length=1000)
    tournament_description: str = Field(default="", max_length=1400)
    rules_pdf: str = Field(default="", max_length=1200)
    rules_text: str = Field(default="", max_length=4000)
    fee_breakdown: list[TournamentFeeLinePayload] = Field(default_factory=list, max_length=20)
    prizes: list[TournamentPrizePayload] = Field(default_factory=list, max_length=20)
    cities: list[str] = Field(default_factory=list, max_length=12)
    assigned_manager_ids: list[str] = Field(default_factory=list, max_length=20)
    show_on_home: bool = True
    block_repeat_registration: bool = False


class NewsBlockPayload(BaseModel):
    block_type: str = Field(pattern="^(heading|paragraph|bold|italic|list|quote|image)$")
    content: str = Field(min_length=1, max_length=1200)


class NewsPostPayload(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    short_description: str = Field(min_length=10, max_length=320)
    image: str = Field(default="", max_length=20000000)
    category: str = Field(pattern="^(Winner Teams|Match Updates|Tournament Updates|Announcements)$")
    sport: str = Field(min_length=2, max_length=80)
    tournament_slug: str | None = Field(default=None, max_length=120)
    city: str = Field(default="", max_length=80)
    status: str = Field(default="draft", pattern="^(draft|published)$")
    is_highlight: bool = False
    blocks: list[NewsBlockPayload] = Field(default_factory=list)


class GalleryAlbumPayload(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=1000)
    image: str = Field(default="", max_length=20000000)
    sport: str = Field(default="Gallery", max_length=80)
    city: str = Field(default="", max_length=80)
    from_date: str = Field(default="", max_length=40)
    to_date: str = Field(default="", max_length=40)
    published: bool = True
    sort_order: int = Field(default=0, ge=0, le=10000)


class SportHomeVisibilityPayload(BaseModel):
    show_on_home: bool
    sort_order: int = Field(default=1, ge=1, le=99)


class ManagerCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=3, max_length=80)
    cities: list[str] = Field(min_length=1, max_length=12)


class AdminUserCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=3, max_length=80)
    phone: str = Field(default="", max_length=20)


class AdminUserUpdatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=20)
    password: str | None = Field(default=None, min_length=3, max_length=80)


class ManagerUpdatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str | None = Field(default=None, min_length=3, max_length=80)
    cities: list[str] = Field(min_length=1, max_length=12)


class ManagerCitiesPayload(BaseModel):
    cities: list[str] = Field(min_length=1, max_length=12)


class AdminTeamUpdatePayload(BaseModel):
    team_name: str = Field(min_length=2, max_length=120)
    captain_name: str = Field(min_length=2, max_length=120)
    sub_captain_name: str = Field(default="", max_length=120)
    coach_name: str = Field(default="", max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=20)
    city: str = Field(min_length=2, max_length=80)
    team_logo: str = Field(default="", max_length=20000000)
    team_motto: str = Field(default="", max_length=180)


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


class HomeDiscoveryCardUpdate(BaseModel):
    label: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=2, max_length=180)
    sport: str = Field(min_length=2, max_length=80)
    tournament_slug: str = Field(default="", max_length=120)
    sponsor_name: str = Field(min_length=2, max_length=140)
    sponsor_image: str = Field(default="", max_length=20000000)
    image: str = Field(default="", max_length=20000000)
    event_date: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=1600)
    sponsor_details: str = Field(min_length=5, max_length=1200)
    register_path: str = Field(default="", max_length=220)
    sort_order: int = Field(default=1, ge=1, le=999)
    published: bool = True


class LiveHighlightUpdate(BaseModel):
    match_id: str = Field(default="", max_length=120)
    title: str = Field(min_length=2, max_length=180)
    stage_label: str = Field(min_length=2, max_length=80)
    home_team: str = Field(min_length=2, max_length=120)
    away_team: str = Field(min_length=2, max_length=120)
    home_score: str = Field(min_length=1, max_length=40)
    away_score: str = Field(min_length=1, max_length=40)
    image: str = Field(min_length=2, max_length=500)
    description: str = Field(min_length=10, max_length=1600)
    impact_notes: str = Field(min_length=5, max_length=1200)
    link_path: str = Field(default="/live", max_length=220)
    sort_order: int = Field(default=1, ge=1, le=999)
    published: bool = True


class SponsorLogoUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    image: str = Field(default="", max_length=20000000)
    link_url: str = Field(min_length=2, max_length=500)
    sort_order: int = Field(default=1, ge=1, le=999)
    published: bool = True


class OrganizerCardUpdate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(min_length=5, max_length=500)
    sort_order: int = Field(default=1, ge=1, le=999)
    published: bool = True


class AnnouncementCreate(BaseModel):
    tournament_slug: str
    title: str
    message: str

from pydantic import BaseModel
from typing import Optional


class AnnouncementCreatePayload(BaseModel):
    title: str
    description: str = ""
    image: str = "/assets/poster.jpeg"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    published: bool = True
    city: Optional[str] = None


class AnnouncementUpdatePayload(BaseModel):
    title: str
    description: str = ""
    image: str = "/assets/poster.jpeg"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    published: bool = True
    city: Optional[str] = None
