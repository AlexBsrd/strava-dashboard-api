# Strava Dashboard API

Cette API sert de backend pour l'application Strava Dashboard. Elle gère les sessions utilisateurs et leur accès à l'application.

## Fonctionnalités

- Gestion des sessions utilisateurs Strava
- Suivi de l'activité des utilisateurs
- Déconnexion automatique après 24h d'inactivité
- Déautorisation automatique de l'application Strava après 30 jours
- Interface d'administration sécurisée pour visualiser les connexions

## Prérequis

- Node.js
- MongoDB
- Un compte MongoDB Atlas (ou une instance MongoDB locale)

## Installation

1. Clonez le dépôt
```bash
git clone https://github.com/votre-username/strava-dashboard-api.git
cd strava-dashboard-api
```

2. Installez les dépendances
```bash
npm install
```

3. Créez un fichier `.env` à la racine du projet avec les variables suivantes :
```env
MONGODB_URI=votre_url_mongodb
PORT=3000
ADMIN_API_KEY=votre_clé_secrète
```

Où :
- `MONGODB_URI` : URL de connexion à votre base de données MongoDB
- `PORT` : Port sur lequel l'API va s'exécuter (par défaut : 3000)
- `ADMIN_API_KEY` : Clé secrète pour accéder aux routes d'administration (générez une clé forte avec `openssl rand -hex 32`)

## Démarrage

```bash
npm start
```

L'API sera accessible sur `http://localhost:3000` (ou le port spécifié dans votre `.env`).

## Routes disponibles

- `POST /api/sessions` : Créer ou mettre à jour une session
- `GET /api/sessions/:athleteId/check` : Vérifier une session
- `POST /api/sessions/:athleteId/activity` : Mettre à jour l'activité d'une session
- `GET /api/sessions` : Lister toutes les sessions (protégé par ADMIN_API_KEY)
- `DELETE /api/sessions/:athleteId` : Supprimer une session

## Sécurité

- Les routes d'administration nécessitent une clé API dans le header `x-api-key`
- Les sessions sont automatiquement supprimées après 24h d'inactivité
- Les tokens d'accès Strava sont stockés de manière sécurisée
- L'application est automatiquement déautorisée de Strava après 30 jours

## Notes

- Assurez-vous de ne jamais commiter votre fichier `.env`
- Changez régulièrement votre `ADMIN_API_KEY`
- Vérifiez régulièrement les sessions actives via la route d'administration

## Support

Pour toute question ou problème, ouvrez une issue dans le dépôt GitHub.
