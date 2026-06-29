# KokiStyle — Implementation Plan

## Current Status

Completed:
- Next.js setup
- GitHub integration
- Vercel deployment
- Navbar
- Hero section
- Initial architecture

---

# Next Tasks

## Phase 2 — Premium UI

Implement:
- Services section
- Before/After section
- Virtual Tour section
- Footer
- Animations
- Mobile optimization

---

## Phase 3 — Estimate System

Implement:
- PDF generation
- QR generation
- printable estimates
- customer forms
- logo upload
- Day Planner converts scheduled Estimate items into individual Workflow tasks
- Generated Workflow tasks persist `scheduled_date`, `source_key`, Estimate references and amount
- Workflow filters generated tasks by assignee and date; tasks can be reprogrammed from the task editor

Libraries:
- jspdf
- qrcode
- react-hook-form

---

## Phase 4 — Backend

Future:
- Supabase
- Authentication
- Storage
- Customer dashboard
- Projects database

---

# Coding Rules

- Keep components modular
- Prefer reusable UI
- Use TailwindCSS
- Use TypeScript
- Optimize for mobile first
