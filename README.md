# ScholarFund

A polished full-stack student sponsorship platform built with React, Vite, Express, and SQLite.

## Features
- Student registration and login
- Sponsor registration and login
- Student campaign creation with image upload
- Sponsor payment method simulation
- Donations with realistic flow
- Campaign listing and progress tracking
- Local SQLite database
- Professional motion-heavy UI

## Local setup

1. Open a terminal in the project folder:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm run dev
   ```

3. Open:
   - Frontend: http://localhost:5173
   - API: http://localhost:4000/api/health

## Default credentials
- Admin:
  - email: admin@scholarfund.org
  - password: Admin@2025

## Notes
- The payment flow is simulated for demo and educational use.
- The database is stored in:
  ```txt
  data/scholarfund.sqlite
  ```

## Build for production
```bash
npm run build
```

## Run production build
```bash
npm run start
```
