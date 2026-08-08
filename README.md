# Rewardly - Plateforme de Tâches Rémunérées

![Rewardly](public/images/og-image.png)

**Rewardly** est une plateforme SaaS premium de micro-tâches rémunérées, construite avec Next.js 16, Supabase, et TypeScript. Design inspiré des applications bancaires modernes (Revolut, Monzo, Nubank).

## 🚀 Fonctionnalités

### 👤 Utilisateurs
- Dashboard avec carte bancaire virtuelle
- Système de packs (Bronze, Silver, Gold)
- Tâches rémunérées avec validation auto/manuelle
- Dépôts et retraits
- Parrainage avec code et lien de parrainage
- Notifications en temps réel (compteur non-lues)
- Analytics et statistiques avec graphiques
- Mode sombre/clair
- Sécurité du compte (changement de mot de passe)
- Réinitialisation de mot de passe (email Supabase)

### 👑 Administration
- Tableau de bord administrateur complet
- Gestion des utilisateurs (CRUD, bannissement)
- Gestion des packs
- Gestion des tâches (avec champs personnalisés, médias, partage)
- Validation des dépôts et retraits
- Paramètres système persistés en base
- Notifications push (Edge Functions)
- Logs d'activité

## 🛠️ Stack Technique

- **Framework:** Next.js 16.2.12 (App Router + Turbopack)
- **Langage:** TypeScript 5 (strict mode)
- **Base de données:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth (JWT)
- **UI:** Tailwind CSS 4, Shadcn UI
- **Animations:** Framer Motion
- **Icônes:** Lucide React
- **Validation:** Zod
- **État serveur:** TanStack Query
- **Graphiques:** Chart.js, Recharts
- **Tests:** Vitest
- **Edge Functions:** Deno (Supabase)
- **CI/CD:** GitHub Actions + Vercel

## 📋 Prérequis

- Node.js 18+
- npm
- Compte Supabase (gratuit)
- GitHub + Vercel (pour le déploiement)

## 🔧 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/rewardly.git
cd rewardly
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans Settings > API
3. Copiez l'URL et l'Anon Key

### 4. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Éditez `.env.local` avec vos credentials Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Exécuter le schéma SQL consolidé

**IMPORTANT :** Utilisez le fichier `supabase/consolidated_schema.sql` - il regroupe TOUT le SQL nécessaire (tables, RLS, fonctions RPC, seed data, bucket storage, admin).

Le fichier est **IDEMPOTENT** : il peut être exécuté plusieurs fois sans erreur ("table already exists", etc.).

1. Allez dans **SQL Editor** sur Supabase
2. Copiez le contenu de `supabase/consolidated_schema.sql`
3. Exécutez le script
4. Le script définit automatiquement le rôle `admin` pour `wlagbema@gmail.com`

### 6. Déployer les Edge Functions (optionnel)

```bash
npx supabase functions deploy send-notification
npx supabase functions deploy process-task
npx supabase functions deploy process-withdrawal
npx supabase functions deploy process-deposit
```

### 7. Activer les emails de réinitialisation de mot de passe

1. Allez dans **Authentication > Providers > Email**
2. Activez "Confirm email" et "Reset password"
3. Dans **URL Configuration**, ajoutez `http://localhost:3000` comme URL du site
4. Le redirect vers `/reset-password` est déjà configuré

### 8. Générer les types TypeScript (optionnel)

```bash
npx supabase gen types typescript --project-id votre_project_id > src/types/supabase.ts
```

### 9. Lancer le projet

```bash
npm run dev
```

## 🧪 Tests

```bash
# Exécuter les tests une fois
npm test

# Mode watch
npm run test:watch

# Avec couverture
npm run test:coverage
```

## 🚀 Déploiement sur Vercel

### 1. Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/votre-username/rewardly.git
git push -u origin main
```

### 2. Connecter Vercel

1. Allez sur [vercel.com](https://vercel.com)
2. Importez votre repository GitHub
3. Ajoutez les variables d'environnement
4. Déployez !

### 3. Variables d'environnement Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## 🤖 CI/CD

Le projet inclut un pipeline GitHub Actions (`.github/workflows/ci.yml`) qui :

1. **Lint & Typecheck** - ESLint + TypeScript
2. **Tests** - Vitest avec couverture
3. **Build** - Next.js build
4. **Deploy** - Déploiement automatique sur Vercel (branche main)

### Secrets GitHub nécessaires

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## 🗄️ Base de données

### Tables (20)

| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs avec rôles |
| `wallets` | Portefeuilles |
| `wallet_transactions` | Transactions |
| `plans` | Packs (Bronze, Silver, Gold) |
| `investments` | Investissements |
| `tasks` | Tâches |
| `task_categories` | Catégories de tâches |
| `submission_fields` | Champs de validation |
| `task_submissions` | Soumissions |
| `submission_answers` | Réponses |
| `deposits` | Dépôts |
| `withdrawals` | Retraits |
| `notifications` | Notifications |
| `payment_methods` | Méthodes de paiement |
| `referrals` | Parrainage |
| `system_settings` | Paramètres système |
| `admin_logs` | Logs d'audit |
| `daily_statistics` | Statistiques quotidiennes |
| `banners` | Bannières |
| `announcements` | Annonces |

### Fonctions RPC (17+)

`add_reward`, `submit_task`, `approve_submission`, `reject_submission`, `validate_deposit`, `validate_withdrawal`, `ban_user`, `delete_user`, `activate_plan`, `create_task`, `update_task`, `delete_task`, `create_plan`, `toggle_plan_status`, `update_plan`, `get_platform_stats`, `get_users_with_details`, `submit_withdrawal`, `submit_deposit`

### Edge Functions (4)

- `send-notification` - Envoyer une notification
- `process-task` - Approuver/refuser une soumission
- `process-withdrawal` - Traiter un retrait
- `process-deposit` - Traiter un dépôt

## 📁 Structure du Projet

```
rewardly/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD pipeline
├── src/
│   ├── actions/                # Server Actions
│   │   ├── admin-actions.ts    # Actions admin
│   │   ├── admin-auth.ts       # Auth admin (cookie séparé)
│   │   ├── auth-actions.ts     # Reset de mot de passe
│   │   ├── settings-actions.ts # Paramètres système
│   │   └── user-actions.ts     # Actions utilisateur
│   ├── app/                    # Pages (App Router)
│   │   ├── (dashboard)/        # Pages utilisateur
│   │   ├── admin/              # Pages admin
│   │   └── ...                 # Auth, reset-password, etc.
│   ├── components/
│   │   ├── ui/                 # Button, Card, Input
│   │   └── layout/             # TopNav, BottomNav
│   ├── context/                # AuthContext, ThemeContext
│   ├── hooks/                  # useWallet, useTasks
│   ├── lib/                    # Utilitaires
│   │   ├── __tests__/          # Tests Vitest
│   │   ├── rate-limit.ts       # Rate limiting
│   │   ├── pagination.ts       # Pagination
│   │   ├── storage.ts          # Supabase Storage
│   │   ├── validations.ts      # Schémas Zod
│   │   └── supabase/           # Clients Supabase
│   ├── providers/              # Providers
│   ├── types/                  # Types TypeScript
│   ├── proxy.ts                # Middleware (protection des routes)
│   └── globals.css             # Styles
├── supabase/
│   ├── consolidated_schema.sql # ⭐ SQL complet (idempotent)
│   ├── functions/              # Edge Functions Deno
│   └── migrations/             # Anciennes migrations (référence)
└── public/                     # Static assets
```

## 🔒 Sécurité

- **Row Level Security (RLS)** sur toutes les tables
- **Fonctions helper** `is_admin()` et `is_staff()` pour les politiques RLS
- **Cookie admin séparé** (`admin_session`)
- **Server Actions** avec vérification du rôle admin
- **Client Supabase admin** uniquement côté serveur
- **Logs d'audit** pour toutes les actions admin
- **Validation Zod** côté client et serveur
- **Rate limiting** sur les Server Actions
- **Uploads** sécurisés vers Supabase Storage (bucket `proofs`)
- **Reset de mot de passe** via Supabase Auth (email)

## 📄 License

MIT

## 👨‍💻 Auteur

Développé avec ❤️ par l'équipe Rewardly#   r e w a r d l y  
 