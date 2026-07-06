# Cheers — Original Product Spec (verbatim from owner, 2026-07-05)

Build a production-ready Next.js 14 (App Router) web application using TypeScript, following best practices and clean, modular architecture.

> NOTE (build): repo is actually on modified Next.js 16.2.10 — see AGENTS.md and docs/HANDOFF.md §3.

## ⚙️ Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- Zod (validation)
- Server Actions (primary mutations)
- NextAuth (email magic link + Google login)
- Stripe (payments + platform fee logic)
- Nodemailer (emails)
- Google Maps API

## 🧠 Core Concept

Platform: "Cheers" — a marketplace where:
- Customers browse and book workers for events
- Workers manage their own profiles and availability
- Admin oversees and can override everything

Location: Jamaica

## 👥 User Roles
- Customer
- Worker (has login + dashboard)
- Admin (full control)
- Support (subset of admin tools)
- Driver (view bookings for transport)

## 🔐 Authentication
- Email magic link
- Google login
- Role-based access control
- Workers and customers share auth system
- Admin role seeded manually

## 🧩 Core Features (V1)

### 1. Customer Experience
- Homepage: premium, modern, slightly seductive tone
- Browse workers: grid + list view; swipe (left skip, right interested)
- Filters: age, location, price, rating, availability, languages, services, verified
- Worker Profile Page: photo + video gallery; stage name (public); real name (private, DB only); age, height, body type, languages; services + specialties; availability calendar; pricing; reviews + ratings; bio

### 2. Booking Flow
Select worker → date → time → duration → enter address (Google Maps) → add instructions → booking summary → submit request.

Booking Lifecycle: Worker OR Admin accepts/declines → Customer pays → Booking confirmed → Completed → Review triggered.

Rules: cancel ≥ 5 hours before; reschedule allowed; admin override always allowed.

### 3. Worker Dashboard (CORE)
- Profile management: create/edit profile, upload/delete photos & videos, set services/pricing/availability/bio, toggle visibility (active/inactive)
- Booking management: view incoming requests, accept/decline, view schedule/calendar, mark completed
- Earnings: summary; completed jobs, tips, pending payouts (weekly)

### 4. Admin Dashboard (override EVERYTHING)
- Worker control: edit any profile, suspend/hide, verify identity (badge), adjust pricing/availability
- Booking control: approve/decline, force cancel, reassign
- Platform metrics: revenue, bookings, customers, worker performance
- Reports: revenue, bookings, growth, refunds; export CSV/PDF

### 5. Payments
- Stripe integration. Platform collects all payments. 5% platform fee. Workers paid weekly (off-platform / manual payout tracking). Tips = 100% to worker.
- Card payments + cash tracking (worker uploads proof). Receipts. Admin reports.

### 6. Memberships
- Monthly subscription required for full platform access
- Free 6-month access (feature flag)
- Benefits: full browsing, booking access, future discounts

### 7. Customer Dashboard
Profile (name, email, phone), saved workers, booking history, membership status, payment history, reviews, notifications.

### 8. Notifications (Nodemailer + structured system)
- Customer: booking submitted, accepted/declined, payment required/received, reminder, cancellation, review request
- Worker: new booking request, booking updates, payment notifications
- Admin: new bookings, payments, new users, reviews

### 9. Reviews
Only after completed bookings; 1–5 stars; written; optional anonymous; admin moderation.

### 10. Safety (structure only)
PIN verification before meeting; location tracking hook (mobile-ready); wellness check button; audio recording placeholder.

## 🧱 Database (Drizzle)
Schemas: users, roles, workers (linked to user), worker_media, services, availability, bookings, booking_status, payments, memberships, reviews, favorites, notifications, audit_logs.

## 📄 Pages
- Public: Home, Browse Workers, Worker Profile, About, Contact, FAQ, Privacy Policy, Terms
- Auth: Login / Register
- Customer: Dashboard, Booking Flow, Booking History, Favorites, Membership
- Worker: Dashboard, Profile Editor, Media Manager, Availability Manager, Bookings, Earnings
- Admin: Dashboard, Workers, Bookings, Payments, Reports, Settings

## 🎨 UI Guidelines
Modern, premium, minimal; slight luxury/dark tone; mobile-first (identical experience); fast, responsive; clean reusable components.

## 🧪 Dev Requirements
Server Actions for mutations; Zod validation everywhere; clean folder structure (/app /components /lib /db /actions /schemas); error handling + loading states; environment configs.

## 🚀 Future-Ready (structure only)
Mobile app wrapper, AI recommendations, live chat, referral system, multi-currency, worker payouts via Stripe Connect.

## ⚠️ Important Rules
- Workers use stage names publicly, real names private
- Workers manage their own profiles
- Admin can override anything
- Platform controls all payments
- Code must be simple, readable, and scalable

## Services System (Simplified)

Standardized services with 2 categories:

1. **Wellness & Massage Services**: Relaxation Massage, Deep Tissue Massage, Aromatherapy Massage
2. **Entertainment & Event Services**: Club Appearance, Private Party Hosting, VIP Table Experience, Performance / Dance Appearance (non-explicit)

Worker customization: enable/disable any service; set price, duration, description; add optional add-ons (extra time, travel, themed outfit, etc.)

Constraints:
- All service names must remain non-explicit and professional
- Workers cannot create new service types (only customize existing ones)
- Add-ons are flexible and worker-defined

Data model: service_categories, service_types, worker_services, service_addons.

Keep implementation simple, scalable, and easy to filter/search.
