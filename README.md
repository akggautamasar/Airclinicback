# Clinic Management Software — Backend API

Node.js + Express + Supabase  
**Cost to run: ₹0/month on free tiers**

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/doctor/profile | Get doctor profile |
| POST | /api/doctor/profile | Create profile after signup |
| PUT | /api/doctor/profile | Update profile |
| GET | /api/doctor/dashboard | Stats + today's appointments |
| GET | /api/patients | List all patients (supports ?search=) |
| GET | /api/patients/:id | Patient + full history |
| POST | /api/patients | Create patient |
| PUT | /api/patients/:id | Update patient |
| DELETE | /api/patients/:id | Delete patient |
| GET | /api/appointments | List appointments (?date=YYYY-MM-DD) |
| GET | /api/appointments/slots?date= | Available slots for a date |
| POST | /api/appointments | Book appointment |
| PUT | /api/appointments/:id | Update/reschedule |
| DELETE | /api/appointments/:id | Cancel |
| GET | /api/prescriptions | List (?patient_id=) |
| GET | /api/prescriptions/:id | Single prescription |
| POST | /api/prescriptions | Create prescription |
| GET | /api/bills | List bills |
| GET | /api/bills/summary | Revenue stats for month |
| POST | /api/bills | Create bill/invoice |
| PUT | /api/bills/:id | Update payment status |

---

## STEP 1 — Supabase Setup (Database)

1. Go to https://supabase.com → Sign up free
2. Click **New Project** → name it `clinic-app`
3. Choose a region close to India (Singapore)
4. Wait 2 minutes for project to spin up
5. Go to **SQL Editor** → paste contents of `supabase_schema.sql` → click **Run**
6. Go to **Project Settings → API**
7. Copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` key (under API keys) → this is your `SUPABASE_SERVICE_KEY`

---

## STEP 2 — Run Locally

```bash
# Clone / create project folder
cd clinic-backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY

# Start server
npm run dev
# Server runs at http://localhost:4000

# Test it
curl http://localhost:4000/health
```

---

## STEP 3 — Deploy Backend to Railway (Free)

1. Push this folder to GitHub:
```bash
git init
git add .
git commit -m "initial backend"
git remote add origin https://github.com/YOUR_USERNAME/clinic-backend.git
git push -u origin main
```

2. Go to https://railway.app → Sign in with GitHub
3. Click **New Project → Deploy from GitHub repo**
4. Select `clinic-backend`
5. Click **Variables** tab → Add:
   ```
   SUPABASE_URL         = https://xxx.supabase.co
   SUPABASE_SERVICE_KEY = your-service-role-key
   NODE_ENV             = production
   FRONTEND_URL         = https://your-frontend.vercel.app
   ```
6. Railway auto-deploys. You'll get a URL like:
   `https://clinic-backend-production.up.railway.app`

7. Test: `curl https://your-railway-url.railway.app/health`

---

## STEP 4 — Supabase Auth Setup

1. In Supabase → **Authentication → Providers**
2. Enable **Email** provider (already on by default)
3. In **Authentication → URL Configuration**:
   - Site URL: `https://your-frontend.vercel.app`
   - Redirect URLs: `https://your-frontend.vercel.app/auth/callback`

Doctors sign up with email/password via Supabase Auth.  
The JWT token they get is sent as `Authorization: Bearer <token>` on every API call.

---

## Request Format

Every protected route needs:
```
Headers:
  Authorization: Bearer <supabase_jwt_token>
  Content-Type: application/json
```

### Example — Book Appointment
```bash
curl -X POST https://your-api.railway.app/api/appointments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "uuid-here",
    "appointment_date": "2024-02-15",
    "appointment_time": "10:00",
    "problem": "Fever and headache"
  }'
```

### Example — Create Prescription
```bash
curl -X POST https://your-api.railway.app/api/prescriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "uuid-here",
    "appointment_id": "uuid-here",
    "diagnosis": "Viral fever",
    "medicines": [
      {
        "name": "Paracetamol 500mg",
        "dosage": "1 tablet",
        "frequency": "3 times a day",
        "duration": "5 days",
        "instructions": "After meals"
      }
    ],
    "advice": "Rest and drink plenty of fluids",
    "follow_up_days": 3
  }'
```

---

## Cost Breakdown

| Service | Free Tier | You Pay When |
|---------|-----------|--------------|
| Supabase | 500MB DB, 50k rows, 1GB files | 200+ active doctors |
| Railway | $5 free credit/month | Heavy traffic |
| GitHub | Free forever | Never |
| Domain | — | ₹800/year (optional for now) |

**Total monthly cost at MVP: ₹0**

---

## What's Next (Step 2 — Frontend)

Next we build the React/Next.js dashboard that connects to this API:
- Doctor login/signup
- Today's appointment calendar
- Patient search and profiles
- Prescription writer
- Invoice generator
- Dashboard with revenue stats
