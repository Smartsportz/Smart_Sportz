<div align="center">

# Smart Sportz

### Enterprise Sports Tournament Management Platform

<p>
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=0b1c30" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="Framer Motion" src="https://img.shields.io/badge/Framer_Motion-Animations-ff4f8b?style=for-the-badge&logo=framer&logoColor=white" />
  <img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub_Pages-Auto_Deploy-222222?style=for-the-badge&logo=githubpages&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Frontend-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  <img alt="Render" src="https://img.shields.io/badge/Render-Backend-46E3B7?style=for-the-badge&logo=render&logoColor=0b1c30" />
</p>

<p>
  Premium white-theme SaaS frontend inspired by Linear, Vercel, Notion, Framer, Stripe, OpenAI, and Apple design language.
</p>

<code>&lt;React /&gt;</code>
<code>&lt;TypeScript /&gt;</code>
<code>&lt;FramerMotion /&gt;</code>
<code>&lt;SmartSportz /&gt;</code>

</div>

---

## Project Overview

Smart Sportz is a frontend foundation for an enterprise sports tournament management platform. It covers public discovery, registrations, payments, live scoring, super admin operations, management portal workflows, participant dashboards, CMS, logs, and reporting.

The project is built as a separated React application, with each major page placed in its own file under `frontend/src/pages`.

## Live Deployment

GitHub Actions is configured to deploy the Vite frontend to GitHub Pages on every push to `main`.
The repository also includes Vercel and Render deployment configuration for free-tier hosting.

Expected Pages URL after deployment:

```text
https://mr-asmath.github.io/Smart_Sportz/
```

Expected Vercel frontend URL after importing this repository:

```text
https://smart-sportz.vercel.app/
```

Expected Render backend URL after creating the Blueprint service:

```text
https://smart-sportz-backend.onrender.com/api/v1/health
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router |
| Motion | Framer Motion |
| Icons | Lucide React |
| Styling | Custom CSS design system |
| Deployment | GitHub Actions, GitHub Pages, Vercel, Render |

## Frontend Pages

| Area | Pages |
| --- | --- |
| Public Website | Home, Tournaments, Tournament Detail, Sports, Sport Detail, Live Hub, Live Match, Teams, Team Detail |
| Content | Gallery, Blog, Article Detail, About, Contact, Sponsors, FAQ, Leaderboards |
| Authentication | Login, Forgot Password, OTP, Reset Password |
| Registration | Tournament Registration, Payment Receipt |
| Super Admin | Dashboard, Tournaments, Teams, Players, Payments, CMS, Reports, Logs |
| Management Portal | Dashboard, Tournament, Registrations, Matches, Players, Reports, Match Control |
| User Portal | Dashboard, Profile, Registrations, Payments, Certificates, Settings |
| Utility Pages | CMS Section Detail, Payment Operations, Report Detail, Audit Log Detail |

## Main Features

- Premium white theme by default with dark mode available from settings.
- Full card and container navigation across the app.
- Animated page transitions and hover interactions with Framer Motion.
- Responsive public website and portal layouts.
- Tournament discovery, registration, payment, and receipt flows.
- Live score hub and match intelligence interface.
- Super admin dashboard with metrics, tables, CMS, reports, payments, and logs.
- Management portal for assigned tournament operations.
- User portal for registrations, profile, payments, and certificates.
- Route-backed pages for every meaningful container click.

## Folder Structure

```text
Smart_Sportz/
├─ .github/
│  └─ workflows/
│     └─ pages.yml
├─ docs/
│  ├─ Smart_Sportz_Phase_1_Foundation.docx
│  ├─ Smart_Sportz_Phase_2_Design_System_Landing_Page.docx
│  ├─ Smart_Sportz_Phase_3_Public_Website_Specification.docx
│  ├─ Smart_Sportz_Phase_4_Registration_Payment_System.docx
│  ├─ Smart_Sportz_Phase_5_Super_Admin_Portal_Part_1.docx
│  ├─ Smart_Sportz_Phase_6_Management_User_Portal.docx
│  ├─ Smart_Sportz_Phase_7_Live_Score_Engine_Match_Intelligence.docx
│  ├─ Smart_Sportz_Phase_8_Backend_Architecture_API_Design.docx
│  ├─ Smart_Sportz_Phase_9_Database_Architecture_Prisma_Schema_Design.docx
│  ├─ Smart_Sportz_Phase_10_Frontend_Architecture_React_Application_Design.docx
│  └─ Smart_Sportz_Phase_11_DevOps_Deployment_CICD_Production_Infrastructure.docx
├─ frontend/
│  ├─ public/
│  │  └─ assets/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ data/
│  │  ├─ pages/
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  └─ styles.css
│  ├─ package.json
│  └─ vite.config.ts
├─ template.docx
├─ .gitignore
└─ README.md
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Local URL:

```text
http://127.0.0.1:5173/
```

## Production Build

```bash
cd frontend
npm run build
```

The production files are generated into:

```text
frontend/dist
```

## GitHub Pages Deployment

Deployment is handled by:

```text
.github/workflows/pages.yml
```

The workflow:

1. Checks out the repository.
2. Installs frontend dependencies with `npm ci`.
3. Builds the Vite app from `frontend`.
4. Uploads `frontend/dist` as the GitHub Pages artifact.
5. Deploys to GitHub Pages.

## Vercel Frontend Deployment

Vercel deployment is configured by:

```text
vercel.json
```

The config builds the React app from `frontend`, outputs `frontend/dist`, sets the hosted base path to `/`, and rewrites all routes to `index.html` for React Router.

Default hosted API target:

```text
https://smart-sportz-backend.onrender.com/api/v1
```

If your Render backend URL is different, update `VITE_API_BASE_URL` in Vercel project environment variables.

## Render Backend Deployment

Render deployment is configured by:

```text
render.yaml
```

The free web service runs:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

The committed Blueprint uses SQLite for a zero-secret free deployment. For Supabase/PostgreSQL production mode, set these Render environment variables in the dashboard instead of committing credentials:

```text
DATABASE_BACKEND=postgres
DATABASE_URL=<supabase pooled connection string with sslmode=require>
MIRROR_DATABASE_URL=<same or protected mirror connection string>
AUDIT_DATABASE_URL=<same or audit connection string>
POSTGRES_PRIMARY_SCHEMA=primary_app
POSTGRES_MIRROR_SCHEMA=mirror_backup
POSTGRES_AUDIT_SCHEMA=audit_event
```

## Design Direction

The UI is designed as a premium SaaS product with:

- Clean white surfaces.
- Dark mode available as a user setting.
- Polished cards, tables, dashboards, and portal shells.
- Smooth route transitions.
- Consistent spacing, radius, shadows, and typography.
- Responsive layouts for desktop, tablet, and mobile screens.

## Documentation Included

The repository includes Word documentation for:

- Foundation architecture.
- Design system and landing page.
- Public website.
- Registration and payment flow.
- Super admin portal.
- Management portal.
- Live score engine.
- Backend architecture and APIs.
- Database architecture.
- Frontend architecture.
- DevOps and CI/CD.
- Master frontend, backend, database, and API specifications.

---

<div align="center">

### Smart Sportz is ready for frontend expansion, backend integration, and production deployment.

</div>
