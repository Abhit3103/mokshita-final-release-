# Render Deployment Fix Checklist

This checklist summarizes the remaining steps to make the Mokshita backend production-ready on Render.

## 1. Required environment variables in Render
Set these exact environment variables in Render:

- NODE_ENV=production
- DATABASE_URL=your_supabase_session_pooler_url
- JWT_SECRET=strong_random_secret
- JWT_EXPIRES_IN=7d
- ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
- RATE_LIMIT_WINDOW_MS=900000
- RATE_LIMIT_MAX=10000
- SUPABASE_URL=https://your-project-ref.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
- SUPABASE_BUCKET=product-images
- RAZORPAY_KEY_ID=your_test_key_id
- RAZORPAY_KEY_SECRET=your_test_key_secret
- RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

> Do not expose the service-role key or JWT secret to the frontend.

## 2. Database and Supabase setup
Before deployment:

- Confirm your Supabase project is active.
- Use the Supabase Session Pooler URL on port 5432 for DATABASE_URL.
- Make sure the database schema exists.
- Run the migration script locally or in a safe environment before deploying:

```bash
npm run migrate
```

- If needed, create the admin user or reset the admin password using the environment-based helper:

```bash
RESET_ADMIN_EMAIL=admin@example.com RESET_ADMIN_PASSWORD=your_password node reset-admin.js
```

## 3. Render runtime settings
In Render:

- Set the build command to:

```bash
npm install
```

- Set the start command to:

```bash
npm start
```

- Health check path should be:

```text
/health
```

- Use Node.js version 18+.

## 4. CORS and frontend deployment
Update the frontend environment variable to point at the Render backend:

- Vite frontend:

```text
VITE_API_URL=https://your-render-backend.onrender.com/api
```

- Next.js frontend:

```text
NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com/api
```

Also add the deployed frontend origin to ALLOWED_ORIGINS in Render.

## 5. Razorpay setup
For test mode only:

- Use Razorpay test keys.
- Do not switch to live mode unless explicitly approved.
- Create a webhook endpoint at:

```text
https://YOUR_RENDER_BACKEND_URL/api/payments/webhook
```

- Configure the webhook secret in Render as RAZORPAY_WEBHOOK_SECRET.

## 6. Supabase Storage
Before deployment:

- Confirm the bucket named product-images exists in Supabase Storage.
- Make sure the service role key is set only on the backend.
- Verify that the upload route works through the backend.

## 7. Health check and smoke tests
After deployment, test:

- GET /health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/products
- POST /api/upload (admin only)
- POST /api/payments/create-order
- POST /api/payments/verify
- POST /api/payments/webhook

## 8. Important notes
- Do not hardcode credentials.
- Do not use live Razorpay keys unless you explicitly want to switch to live mode.
- Do not delete or reset production data without confirming first.
