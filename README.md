# Q-AI Companion

Q-AI is a full-stack AI-powered mental wellness, life guidance, and personal reflection platform. Built with React, TypeScript, Express, Supabase, and Google Gemini AI, Q provides personalized insights, journal reflection, mood tracking, and structured life guides within a privacy-conscious architecture.

### Key Features
- 🧠 **AI Wellness Companion (Q)**: Conversational assistant with context-aware memory and personalized guidance.
- 📖 **Life Guides & Lived Experiences**: Vetted frameworks and community insights for life challenges.
- 📊 **Mood Tracking & Journaling**: Private, local/cloud persisted journaling with encryption and security controls.
- 🛡️ **Crisis & Security Shield**: Instant crisis support modal, security lock overlay, and admin access management.
- 💳 **Subscription Engine**: Integrated PayPal billing engine for monthly and annual tiers.
- 👥 **B2C CRM Sync**: Optional Supabase Auth to Zoho Bigin Contact sync for consenting users. See [docs/zoho-ciam-setup.md](docs/zoho-ciam-setup.md).
- 🔐 **Staff User Management**: Password resets and user support can be handled from the Q admin panel without giving staff Supabase access. See [docs/staff-user-management.md](docs/staff-user-management.md).
- 📘 **Operations Guide**: Full site user, staff, and admin operating procedures are in [docs/q-user-staff-admin-guide.md](docs/q-user-staff-admin-guide.md).

### Technical Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion
- **Backend**: Node.js, Express, Supabase Auth & RLS, PostgreSQL
- **AI Engine**: Server-side Gemini API integration
- **Deployment**: Compatible with Cloud Run & Vercel

