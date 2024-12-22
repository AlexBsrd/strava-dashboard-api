# Strava Dashboard API

Cette API sert de backend pour l'application Strava Dashboard. Elle gère les sessions utilisateurs et leur accès à l'application.

## Fonctionnalités

- Gestion des sessions utilisateurs Strava
- Suivi de l'activité des utilisateurs
- Déautorisation automatique après 30 jours d'inactivité
- Interface d'administration sécurisée pour visualiser les connexions
- Chiffrement des tokens d'authentification
- Double niveau d'authentification (client et admin)

## Prérequis

- Node.js
- MongoDB
- Un compte MongoDB Atlas (ou une instance MongoDB locale)
- OpenSSL pour la génération de clés

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

3. Générez les clés nécessaires
```bash
# Clé de chiffrement (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Clé API Admin
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Clé API Client
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Créez un fichier `.env` à la racine du projet avec les variables suivantes :
```env
MONGODB_URI=votre_url_mongodb
PORT=3000
ENCRYPTION_KEY=votre_clé_de_chiffrement
ADMIN_API_KEY=votre_clé_admin
CLIENT_API_KEY=votre_clé_client
```

Où :
- `MONGODB_URI` : URL de connexion à votre base de données MongoDB
- `PORT` : Port sur lequel l'API va s'exécuter (par défaut : 3000)
- `ENCRYPTION_KEY` : Clé de 32 bytes pour le chiffrement des tokens (générée à l'étape 3)
- `ADMIN_API_KEY` : Clé pour accéder aux routes d'administration (générée à l'étape 3)
- `CLIENT_API_KEY` : Clé pour l'accès client standard (générée à l'étape 3)

## Démarrage

```bash
npm start
```

L'API sera accessible sur `http://localhost:3000` (ou le port spécifié dans votre `.env`).

## Routes et Authentification

Toutes les routes nécessitent une clé API dans le header `x-api-key`. Il existe deux niveaux d'accès :

### Routes Client (CLIENT_API_KEY)
- `POST /api/sessions` : Créer ou mettre à jour une session
- `GET /api/sessions/:athleteId/check` : Vérifier une session
- `POST /api/sessions/:athleteId/activity` : Mettre à jour l'activité d'une session
- `DELETE /api/sessions/:athleteId` : Supprimer sa propre session

### Routes Admin (ADMIN_API_KEY)
- `GET /api/sessions` : Lister toutes les sessions
- Accès à toutes les routes client
- Possibilité de supprimer n'importe quelle session

## Sécurité

### Chiffrement des Tokens
- Utilisation d'AES-256-CBC pour le chiffrement des tokens
- Vecteur d'initialisation (IV) unique pour chaque opération de chiffrement
- Stockage séparé de l'IV et des données chiffrées
- Clé de chiffrement de 32 bytes requise

### Authentification
- Double niveau d'authentification (Client/Admin)
- Vérification de la clé API sur toutes les routes
- Session automatiquement déautorisée après 30 jours d'inactivité
- Tokens d'accès Strava chiffrés en base de données

### Gestion des Sessions
- Chaque activité de l'utilisateur met à jour `lastActivity`
- Après 30 jours d'inactivité :
    1. La session est supprimée automatiquement
    2. L'athlète est déautorisé de l'application Strava
- Les sessions supprimées manuellement ne déautorisent pas l'athlète si celui-ci était actif

### Bonnes Pratiques
- N'exposez jamais les clés API ou de chiffrement
- Changez régulièrement vos clés API et de chiffrement
- Utilisez HTTPS en production
- Surveillez régulièrement les sessions actives
- Ne stockez jamais les tokens en clair
- Limitez l'accès à la route d'administration

## Structure des Données

### Format de Session MongoDB
```javascript
{
  athleteId: String,
  firstname: String,
  lastname: String,
  accessToken: {
    iv: String,
    encryptedData: String
  },
  refreshToken: {
    iv: String,
    encryptedData: String
  },
  expiresAt: Number,
  lastActivity: Date
}
```

## Notes de Développement

### Configuration Frontend
```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'VOTRE_CLIENT_API_KEY'
};
```

### Intercepteur HTTP
```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(environment.apiUrl)) {
    return next(req.clone({
      setHeaders: {
        'x-api-key': environment.apiKey
      }
    }));
  }
  return next(req);
};
```

## Sécurité et Maintenance

### Rotation des Clés
```bash
# Générer de nouvelles clés
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Mettre à jour le .env avec les nouvelles clés
# Redémarrer l'API
```

### Vérification des Sessions
```bash
# Avec curl
curl -H "x-api-key: VOTRE_ADMIN_API_KEY" http://localhost:3000/api/sessions
```

## Support et Contribution

Pour toute question ou problème :
1. Vérifiez les logs de l'API
2. Assurez-vous d'utiliser les bonnes clés API
3. Vérifiez la validité de votre clé de chiffrement
4. Ouvrez une issue dans le dépôt GitHub

### Debugging Courant
- Invalid key length : La clé de chiffrement n'est pas de 32 bytes
- API key manquante : Header x-api-key non fourni
- API key invalide : Mauvaise clé ou niveau d'accès incorrect
- Erreur de validation : Format de session incorrect

## Licence

MIT License - voir le fichier LICENSE pour plus de détails.
