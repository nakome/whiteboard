# Deploy Vercel (Pizarra web)

## Checklist

1. Repo connected to Vercel
2. Project settings:
   - Root Directory: `web`
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output: default Next.js
3. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Supabase Auth → URL Configuration:
   - Site URL: `https://YOUR_VERCEL_DOMAIN`
   - Redirect URLs: `https://YOUR_VERCEL_DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`
5. Aplica las migraciones de `supabase/migrations/` (boards + bucket `user-files`)
6. Deploy

## CLI (opcional)

```bash
cd web
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

Detalles de desarrollo local en [web/README.md](../web/README.md).
