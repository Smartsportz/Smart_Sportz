Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Get-Location) "docs\assets"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Canvas($path, $title, $subtitle, $drawCallback) {
    $w = 1600
    $h = 820
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::White)
    $black = [System.Drawing.Color]::FromArgb(18,18,18)
    $gray = [System.Drawing.Color]::FromArgb(85,85,85)
    $line = [System.Drawing.Color]::FromArgb(35,35,35)
    $soft = [System.Drawing.Color]::FromArgb(248,248,248)
    $green = [System.Drawing.Color]::FromArgb(232,247,240)
    $blue = [System.Drawing.Color]::FromArgb(235,242,255)
    $orange = [System.Drawing.Color]::FromArgb(255,244,232)
    $fontTitle = New-Object System.Drawing.Font("Times New Roman", 34, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Times New Roman", 18, [System.Drawing.FontStyle]::Regular)
    $g.DrawString($title, $fontTitle, (New-Object System.Drawing.SolidBrush($black)), 70, 42)
    $g.DrawString($subtitle, $fontSub, (New-Object System.Drawing.SolidBrush($gray)), 72, 95)
    $g.DrawLine((New-Object System.Drawing.Pen($line, 3)), 70, 140, 1530, 140)
    & $drawCallback $g $black $gray $line $soft $green $blue $orange
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Draw-Box($g, $x, $y, $w, $h, $title, $body, $fillColor, $borderColor) {
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($fillColor)), $rect)
    $g.DrawRectangle((New-Object System.Drawing.Pen($borderColor, 3)), $rect)
    $fontT = New-Object System.Drawing.Font("Times New Roman", 18, [System.Drawing.FontStyle]::Bold)
    $fontB = New-Object System.Drawing.Font("Times New Roman", 12, [System.Drawing.FontStyle]::Regular)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $titleRect = [System.Drawing.RectangleF]::new([float]($x + 10), [float]($y + 12), [float]($w - 20), [float]30)
    $bodyRect = [System.Drawing.RectangleF]::new([float]($x + 14), [float]($y + 44), [float]($w - 28), [float]($h - 54))
    $g.DrawString($title, $fontT, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18,18,18))), $titleRect, $sf)
    $g.DrawString($body, $fontB, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70,70,70))), $bodyRect, $sf)
}

function Draw-Arrow($g, $x1, $y1, $x2, $y2, $color) {
    $pen = New-Object System.Drawing.Pen($color, 3)
    $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(6, 7)
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
}

function Draw-Circle($g, $x, $y, $size, $label, $fillColor, $borderColor) {
    $rect = New-Object System.Drawing.Rectangle($x, $y, $size, $size)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($fillColor)), $rect)
    $g.DrawEllipse((New-Object System.Drawing.Pen($borderColor, 3)), $rect)
    $font = New-Object System.Drawing.Font("Times New Roman", 13, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($label, $font, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18,18,18))), [System.Drawing.RectangleF]::new($x, $y, $size, $size), $sf)
}

New-Canvas (Join-Path $outDir "frontend_addendum_registration_member_step.png") `
    "Registration Wizard With Team Member Details" `
    "New team member step sits directly after team details and before roster, documents, payment, and review" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        $steps = @(
            @("1", "Team Details", "Team identity, logo, sport, category, city, captain contact"),
            @("2", "Team Member Details", "Captain name, member names, future role, jersey, contact fields"),
            @("3", "Roster / Documents", "Player list, verification files, terms and upload status"),
            @("4", "Payment", "Fee summary, coupon, local/external payment, receipt preview"),
            @("5", "Review", "Final summary, status, submitted details and next steps")
        )
        $x = 95
        foreach ($s in $steps) {
            Draw-Circle $g $x 235 64 $s[0] $green $line
            Draw-Box $g ($x - 35) 330 220 170 $s[1] $s[2] $soft $line
            if ($x -lt 1240) { Draw-Arrow $g ($x + 150) 268 ($x + 205) 268 $line }
            $x += 295
        }
        Draw-Box $g 310 595 980 90 "Validation Model" "Team captain and member names are required for team tournament registrations; review page displays team details and member details separately." $blue $line
    }

New-Canvas (Join-Path $outDir "frontend_addendum_sport_tournament_sections.png") `
    "Selected Sport Tournament Page" `
    "Sport menu routes to one sport only, then groups tournaments by Upcoming, Live, and Existing" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        Draw-Box $g 95 210 310 150 "Sport Menu" "Cricket, Football, Basketball, Volleyball and other sports" $soft $line
        Draw-Arrow $g 405 285 515 285 $line
        Draw-Box $g 515 210 310 150 "Selected Sport" "Example: Cricket tournament page only" $green $line
        Draw-Arrow $g 825 285 940 285 $line
        Draw-Box $g 940 185 455 110 "Upcoming Tournaments" "Registration CTA and upcoming tournament detail page" $blue $line
        Draw-Box $g 940 335 455 110 "Live Tournaments" "Live detail page: video, scores, highlights, records, rounds" $orange $line
        Draw-Box $g 940 485 455 110 "Existing / Completed" "Archived rounds, score details, winners, downloads" $soft $line
        Draw-Box $g 225 610 1150 90 "Filtering Rule" "Do not show all sports on the selected sport page. Empty status groups use compact empty states." $soft $line
    }

New-Canvas (Join-Path $outDir "frontend_addendum_tournament_detail_status_model.png") `
    "Tournament Detail Page Status Model" `
    "Upcoming, live, and completed tournaments expose different detail modules and the same Rounds entry point" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        Draw-Box $g 95 210 400 320 "Upcoming Detail" "Rules, venue, schedule, team capacity, prize, eligibility, sponsors, FAQs, registration button, Rounds button" $blue $line
        Draw-Box $g 600 210 400 320 "Live Detail" "Live video, team score, team-wise individual scores, timing, highlights, score history, commentary, records, Rounds button" $green $line
        Draw-Box $g 1105 210 400 320 "Existing Detail" "Archived rounds, match history, player and team scores, highlights, final winners, downloadable records, Rounds button" $orange $line
        Draw-Box $g 255 610 1090 80 "Shared Rounds Button" "Inside tournament container and near round containers; opens active or archived bracket/tree view." $soft $line
        Draw-Arrow $g 295 530 510 610 $line
        Draw-Arrow $g 800 530 800 610 $line
        Draw-Arrow $g 1305 530 1090 610 $line
    }

New-Canvas (Join-Path $outDir "frontend_addendum_bracket_workspace_canvas.png") `
    "Manager Bracket Allocation Workspace" `
    "Auto-generated bracket from accepted teams with editable circular nodes, pair connections, next-round paths, and save validation" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        Draw-Box $g 70 190 220 520 "Accepted Teams" "" $soft $line
        for ($i = 0; $i -lt 5; $i++) {
            Draw-Circle $g 105 (230 + ($i * 82)) 58 ("Team-" + ($i + 1)) $green $line
        }
        Draw-Box $g 1320 190 210 520 "Inspector" "Selected node`nAdd team`nStatus and notes`nNotify SMS/email" $soft $line
        Draw-Circle $g 430 490 92 "Team-1" $blue $line
        Draw-Circle $g 630 490 92 "Team-2" $orange $line
        Draw-Circle $g 985 490 92 "Team-3" $green $line
        Draw-Circle $g 1185 490 92 "Team-4" $blue $line
        Draw-Circle $g 730 325 92 "+" $soft $line
        Draw-Circle $g 1035 325 92 "+" $soft $line
        Draw-Circle $g 885 190 92 "+" $soft $line
        Draw-Arrow $g 522 536 630 536 $line
        Draw-Arrow $g 722 536 760 375 $line
        Draw-Arrow $g 1077 536 1185 536 $line
        Draw-Arrow $g 1035 375 955 238 $line
        Draw-Box $g 420 650 780 70 "Toolbar" "Pair | Next Round | Move | Repair | Delete | Cancel Round | Rematch | Save" $soft $line
    }

New-Canvas (Join-Path $outDir "frontend_addendum_winner_progression_flow.png") `
    "Winner Progression and Bracket History" `
    "Live score result advances winners automatically while manager override and audit remain available" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        Draw-Box $g 90 250 250 130 "Live Score Result" "Match score confirms winner and final state" $green $line
        Draw-Arrow $g 340 315 445 315 $line
        Draw-Box $g 445 250 250 130 "Winner Detected" "Sport rules identify winning team" $blue $line
        Draw-Arrow $g 695 315 800 315 $line
        Draw-Box $g 800 250 250 130 "Next Round Node" "Winner auto-populates next round path" $orange $line
        Draw-Arrow $g 1050 315 1155 315 $line
        Draw-Box $g 1155 250 250 130 "Published Bracket" "User/public pages show updated bracket after save" $soft $line
        Draw-Box $g 420 515 320 120 "Manager Override" "Permission + audit reason required" $soft $line
        Draw-Box $g 860 515 320 120 "Cancel / Rematch" "Cancel selected round and create rematch or repair path" $soft $line
        Draw-Arrow $g 570 515 570 380 $line
        Draw-Arrow $g 1020 515 940 380 $line
    }

New-Canvas (Join-Path $outDir "frontend_addendum_manual_notification_flow.png") `
    "Manual SMS and Email Notification Flow" `
    "Manager sends selected channels only after saved registration or bracket changes" `
    {
        param($g, $black, $gray, $line, $soft, $green, $blue, $orange)
        Draw-Box $g 90 245 260 130 "Saved Change" "Registration accepted, bracket published, match pair, round change, cancel, rematch, winner advance" $green $line
        Draw-Arrow $g 350 310 455 310 $line
        Draw-Box $g 455 245 260 130 "Notify Button" "Appears after save; not during dirty workspace edits" $blue $line
        Draw-Arrow $g 715 310 820 310 $line
        Draw-Box $g 820 215 310 190 "Channel Modal" "Audience preview, SMS checkbox, Email checkbox, message preview, confirm send" $orange $line
        Draw-Arrow $g 1130 310 1235 310 $line
        Draw-Box $g 1235 245 260 130 "Delivery Log" "Sent, failed, retry, channel, audience, manager, timestamp" $soft $line
        Draw-Box $g 430 560 740 90 "Communication Rule" "Manual send prevents spam while the manager is experimenting inside the bracket canvas." $soft $line
    }
