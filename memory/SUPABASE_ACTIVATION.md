# 🟢 Activer Supabase pour LGDP APP

L'infrastructure Supabase est **entièrement préparée** dans le code mais **PAS ENCORE ACTIVE**. L'application tourne actuellement sur MongoDB pour ne pas casser le MVP livré.

## Pourquoi ce mode "prêt-à-activer"?

Je n'ai pas encore reçu vos credentials Supabase (URL + service_role key). Sans ces clés, je ne peux ni tester ni activer la connexion sans risquer de casser l'app qui fonctionne actuellement.

## Étapes pour activer Supabase (5 minutes)

### 1. Créer un projet Supabase
- Allez sur https://supabase.com → **New Project**
- Notez le mot de passe DB (vous n'en aurez pas besoin pour cette app)
- Attendez ~1 min que le projet soit provisionné

### 2. Récupérer vos 2 clés
- **Settings → API** (dans le dashboard Supabase)
- Copiez:
  - **Project URL** → ex: `https://abcdefgh.supabase.co`
  - **service_role secret** (dans "Project API keys", SECRET, ne JAMAIS exposer côté client)

### 3. Exécuter le schéma SQL
- Dashboard Supabase → **SQL Editor** → **New query**
- Copiez le contenu de `/app/backend/supabase_schema.sql`
- Cliquez **Run** (idempotent, safe à re-exécuter)

### 4. Ajouter les env vars
Éditez `/app/backend/.env` et ajoutez:
```
SUPABASE_URL=https://VOTRE_PROJET.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...votre_service_role_key
USE_SUPABASE=true
```

### 5. Basculer le code
Dites-moi **"Active Supabase"** et je remplacerai le backend MongoDB par le backend Supabase. Ce swap prendra ~5 min car j'ai déjà:
- ✅ Le schéma SQL complet (`supabase_schema.sql`)
- ✅ Le client Supabase wrapper (`supabase_client.py`)
- ✅ Les helpers CRUD async (`sb_select`, `sb_insert`, etc.)
- ✅ Le pattern pour re-seeder les données québécoises dans Postgres

Je n'ai qu'à réécrire les 30 routes CRUD dans `server.py` pour utiliser `sb_*` au lieu de `db.collection.*`. Testable immédiatement après.

## État actuel (avant activation)

| Composant | Datastore | État |
|---|---|---|
| Auth (JWT + Emergent) | MongoDB | ✅ Fonctionne |
| Wrestlers/Matches/Championships | MongoDB | ✅ Fonctionne |
| Podcast Episodes/Favorites | MongoDB | ✅ Fonctionne |
| Events/Tickets (Square MOCKÉ) | MongoDB | ✅ Fonctionne |
| Products/Orders (Square MOCKÉ) | MongoDB | ✅ Fonctionne |
| Auto-seed contenu québécois | MongoDB | ✅ Fonctionne |
| **Supabase schema** | — | ✅ Prêt (`supabase_schema.sql`) |
| **Supabase client** | — | ✅ Prêt (`supabase_client.py`) |
| **Bascule backend** | — | ⏳ En attente credentials |

## Alternative — activation automatique
Si vous préférez, dès que vous mettez les 3 env vars ci-dessus dans `.env` et exécutez le SQL dans Supabase, dites-le moi et je bascule immédiatement.
