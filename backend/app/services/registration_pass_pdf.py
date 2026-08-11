from __future__ import annotations

import json
from io import BytesIO
from typing import Any

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _text(value: Any, fallback: str = "-") -> str:
    cleaned = "" if value is None else str(value).strip()
    return cleaned or fallback


def _money(cents: Any) -> str:
    try:
        amount = int(cents or 0) / 100
    except (TypeError, ValueError):
        amount = 0
    return f"INR {amount:,.0f}"


def _date_time(value: str | None) -> str:
    if not value:
        return "-"
    return value.replace("T", " ").replace("+00:00", " UTC")


def _role_for_member(member: dict, registration: dict, index: int) -> str:
    role = _text(member.get("role"), "")
    name = _text(member.get("name"), "")
    if role:
        return role
    if name.lower() == _text(registration.get("captain_name"), "").lower() or index == 0:
        return "Captain"
    if name.lower() == _text(registration.get("sub_captain_name"), "").lower() or index == 1:
        return "Sub captain"
    return "Player"


def _qr_drawing(payload: str, size: float) -> Drawing:
    widget = QrCodeWidget(payload)
    bounds = widget.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def build_registration_pass_pdf(payload: dict) -> bytes:
    registration = payload["registration"]
    tournament = payload["tournament"]
    members = payload.get("members") or []
    payments = payload.get("payments") or []
    documents = payload.get("documents") or []
    latest_payment = payments[0] if payments else {}
    qr_payload = _text(
        registration.get("confirmation_qr_payload"),
        json.dumps(
            {
                "type": "SmartSportzTeamVerification",
                "registrationId": registration.get("id"),
                "confirmationCode": registration.get("confirmation_code"),
                "teamCode": registration.get("team_code"),
                "teamName": registration.get("team_name"),
                "tournamentSlug": registration.get("tournament_slug"),
                "tournamentName": tournament.get("name"),
            },
            separators=(",", ":"),
        ),
    )

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"{_text(registration.get('team_name'))} Registration Pass",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "PassTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#0B1C30"),
        spaceAfter=6,
    )
    section = ParagraphStyle(
        "PassSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0B1C30"),
        spaceBefore=8,
        spaceAfter=7,
    )
    small = ParagraphStyle(
        "PassSmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#5C6878"),
    )
    centered = ParagraphStyle("PassCentered", parent=small, alignment=TA_CENTER)

    def cell(label: str, value: Any) -> Paragraph:
        return Paragraph(f"<b>{label}</b><br/>{_text(value)}", small)

    story: list[Any] = []
    story.append(Paragraph("SmartSportz.in Registration Pass", title))
    story.append(
        Table(
            [[
                cell("Tournament", tournament.get("name")),
                cell("Sport", tournament.get("sport")),
                cell("Location", tournament.get("location")),
                cell("Tournament date", tournament.get("date")),
            ], [
                cell("Registration date and time", _date_time(registration.get("created_at"))),
                cell("Registration status", registration.get("status")),
                cell("Payment status", registration.get("payment_status")),
                cell("Category", registration.get("category")),
            ]],
            colWidths=[42 * mm, 42 * mm, 42 * mm, 42 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5FBF6")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#DDEAD8")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDEAD8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]),
        )
    )
    story.append(Spacer(1, 8))

    qr_size = 55 * mm
    qr_block = [
        [_qr_drawing(qr_payload, qr_size)],
        [Paragraph("<b>Team registration code</b>", centered)],
        [Paragraph(_text(registration.get("confirmation_code"), _text(registration.get("team_code"))), ParagraphStyle("Code", parent=centered, fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.HexColor("#006C40")))],
    ]
    qr_table = Table(qr_block, colWidths=[62 * mm])
    qr_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#CFE2D4")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    details = Table(
        [
            [cell("Team name", registration.get("team_name")), cell("Team code", registration.get("team_code"))],
            [cell("Captain name", registration.get("captain_name")), cell("Sub captain name", registration.get("sub_captain_name"))],
            [cell("Coach name", registration.get("coach_name")), cell("City", registration.get("city"))],
            [cell("Email", registration.get("email")), cell("Phone", registration.get("phone"))],
        ],
        colWidths=[50 * mm, 50 * mm],
        style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#D9E4F2")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E4F2")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFCFF")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]),
    )
    story.append(Table([[qr_table, details]], colWidths=[66 * mm, 102 * mm], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")])))

    roster_rows = [[
        Paragraph("<b>S.No</b>", small),
        Paragraph("<b>Team player name</b>", small),
        Paragraph("<b>Age</b>", small),
        Paragraph("<b>Role</b>", small),
    ]]
    for index, member in enumerate(members, start=1):
        roster_rows.append([
            str(index),
            Paragraph(_text(member.get("name")), small),
            _text(member.get("age")),
            Paragraph(_role_for_member(member, registration, index - 1), small),
        ])
    if len(roster_rows) == 1:
        roster_rows.append(["1", Paragraph("Roster not submitted", small), "-", "Player"])

    story.append(Paragraph("Team Players", section))
    roster_table = Table(roster_rows, colWidths=[14 * mm, 92 * mm, 20 * mm, 42 * mm], repeatRows=1)
    roster_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B8852")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#DDEAD8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#DDEAD8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FCF8")]),
    ]))
    story.append(roster_table)

    story.append(Paragraph("Payment Details", section))
    payment_table = Table(
        [[
            cell("Receipt number", latest_payment.get("receipt_number")),
            cell("Payment method", str(latest_payment.get("method", "")).upper()),
            cell("Paid amount", _money(latest_payment.get("amount", registration.get("amount")))),
            cell("Paid at", _date_time(latest_payment.get("created_at"))),
        ]],
        colWidths=[42 * mm, 42 * mm, 42 * mm, 42 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8ED")),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#F0D8B7")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F0D8B7")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]),
    )
    story.append(payment_table)

    document_note = ", ".join(f"{_text(item.get('document_type'))}: {_text(item.get('status'))}" for item in documents) or "No document metadata attached"
    story.append(Spacer(1, 7))
    story.append(KeepTogether([
        Paragraph("More Details", section),
        Paragraph(
            f"Documents: {document_note}<br/>"
            f"Verification code: {_text(registration.get('confirmation_code'))}<br/>"
            "This pass is generated from the Smart Sportz backend database and can be verified using the QR code above.",
            small,
        ),
    ]))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#5C6878"))
        canvas.drawString(16 * mm, 9 * mm, "SmartSportz.in - Registration pass")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
