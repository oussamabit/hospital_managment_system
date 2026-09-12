# Hospital RDV Management

Application complète de gestion des rendez-vous hospitaliers.

## Stack Technique

**Backend** : Node.js + Express + TypeScript + MongoDB (Mongoose) + JWT + bcrypt
**Frontend** : React 18 + Vite + TypeScript + Tailwind CSS v3 + React Query + React Router v6

---

## Démarrage rapide

### Prérequis
- Node.js >= 18
- MongoDB (local ou MongoDB Atlas)
- npm ou yarn

---

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Editer .env avec vos valeurs (MONGODB_URI, JWT secrets)
npm run dev
```

Le backend démarre sur **http://localhost:5000**

#### Créer les données de test (seed)
```bash
npm run seed
```

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend démarre sur **http://localhost:5173**

---

## Comptes de test (après seed)

| Rôle       | Email                    | Mot de passe   |
|------------|--------------------------|----------------|
| SENIOR     | senior@hospital.fr       | Password123!   |
| JUNIOR     | junior@hospital.fr       | Password123!   |
| SECRETAIRE | secretaire@hospital.fr   | Password123!   |

---

## Architecture

```
hospital-rdv-app/
├── backend/
│   ├── src/
│   │   ├── config/          # db.ts, jwt.ts, logger.ts
│   │   ├── controllers/     # authController, patientController, rdvController, consultationController
│   │   ├── middlewares/     # authMiddleware, roleGuard, errorHandler
│   │   ├── models/          # User, Patient, RendezVous, Consultation, RefreshToken
│   │   ├── routes/          # authRoutes, patientRoutes, rdvRoutes, consultationRoutes
│   │   ├── utils/           # jwt.ts, password.ts, seed.ts
│   │   └── index.ts
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/      # layout (Sidebar, Header, MainLayout)
    │   ├── contexts/        # AuthContext
    │   ├── hooks/           # useAuth, usePermissions
    │   ├── pages/           # Login, Dashboard, Calendar, Appointments, Patients, PatientDetail...
    │   ├── routes/          # ProtectedRoute
    │   ├── services/        # api.ts (axios + interceptors)
    │   ├── types/           # index.ts
    │   ├── App.tsx
    │   └── main.tsx
    └── package.json
```

---

## RBAC – Matrice des permissions

| Fonctionnalité              | SENIOR | JUNIOR | SECRÉTAIRE |
|-----------------------------|--------|--------|------------|
| Créer RDV                   | ✅     | ✅      | ✅          |
| Modifier RDV                | ✅     | ✅ (own)| ✅          |
| Annuler RDV                 | ✅     | ✅ (own)| ✅          |
| Supprimer RDV               | ✅     | ❌      | ❌          |
| Assigner RDV à médecin      | ✅     | ❌      | ✅          |
| Créer/modifier patient      | ✅     | ✅      | ✅ (limité) |
| Supprimer patient           | ✅     | ❌      | ❌          |
| Voir consultations          | ✅     | ✅      | ❌ (403)    |
| Créer consultation          | ✅     | ✅      | ❌ (403)    |
| Diagnostics / Traitements   | ✅     | ✅      | ❌ (403)    |

---

## API Endpoints

### Auth
```
POST /api/auth/login        – Connexion
POST /api/auth/refresh      – Refresh token
POST /api/auth/logout       – Déconnexion (révoque tous les refresh tokens)
GET  /api/auth/profile      – Profil utilisateur
PUT  /api/auth/change-password
GET  /api/auth/doctors      – Liste des médecins
```

### Patients
```
GET    /api/patients          – Liste (paginated, searchable)
GET    /api/patients/:id      – Détail
POST   /api/patients          – Créer
PUT    /api/patients/:id      – Mettre à jour
DELETE /api/patients/:id      – Supprimer (SENIOR only)
```

### RendezVous
```
GET    /api/rdv               – Liste (filters: status, date, doctor, patient)
GET    /api/rdv/today         – Aujourd'hui
GET    /api/rdv/stats         – Stats dashboard
GET    /api/rdv/:id
POST   /api/rdv               – Créer
PUT    /api/rdv/:id           – Mettre à jour
PATCH  /api/rdv/:id/cancel    – Annuler
DELETE /api/rdv/:id           – Supprimer (SENIOR only)
```

### Consultations (doctors only - 403 for SECRETAIRE)
```
POST /api/consultations           – Créer (marque RDV comme TERMINE)
GET  /api/consultations/:id
GET  /api/consultations/rdv/:rdvId
GET  /api/consultations/patient/:patientId
PUT  /api/consultations/:id
```

---

## Sécurité
- JWT Access Token (15 min) + Refresh Token (14 jours, HttpOnly cookie)
- Refresh token stocké en DB + révocation complète au logout
- bcrypt (12 rounds) pour les mots de passe
- Helmet, CORS, Rate limiting sur login et refresh
- All medical data (consultations) blocked at route level for SECRETAIRE
