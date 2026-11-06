const express = require('express');
const router = express.Router();
const Session = require('../models/session.model');
const { authenticate, encrypt } = require('../middleware/auth.middleware');

router.use(authenticate);

// Appel à l'endpoint OAuth de Strava : le client_secret ne quitte jamais le serveur
const stravaToken = async (params) => {
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            ...params
        })
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
};

// Échange du code d'autorisation contre les tokens + création de la session
router.post('/token', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Code manquant' });
    }

    try {
        const { ok, data } = await stravaToken({ code, grant_type: 'authorization_code' });
        if (!ok || !data.athlete) {
            return res.status(401).json({ error: 'Code refusé par Strava' });
        }

        const { athlete } = data;
        await Session.findOneAndUpdate(
            { athleteId: String(athlete.id) },
            {
                athleteId: String(athlete.id),
                firstname: athlete.firstname,
                lastname: athlete.lastname,
                accessToken: encrypt(data.access_token),
                refreshToken: encrypt(data.refresh_token),
                expiresAt: data.expires_at,
                lastActivity: new Date(),
                isActive: true,
                deauthorizedAt: null
            },
            { upsert: true }
        );

        res.json({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            athlete: { id: athlete.id, firstname: athlete.firstname, lastname: athlete.lastname }
        });
    } catch (error) {
        console.error('[AUTH] Erreur lors de l\'échange du code:', error.message);
        res.status(500).json({ error: 'Erreur lors de l\'authentification' });
    }
});

// Rafraîchissement du token d'accès (expire toutes les 6h côté Strava)
router.post('/refresh', async (req, res) => {
    const { refresh_token, athleteId } = req.body;
    if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token manquant' });
    }

    try {
        const { ok, data } = await stravaToken({ refresh_token, grant_type: 'refresh_token' });
        if (!ok) {
            return res.status(401).json({ error: 'Refresh token refusé par Strava' });
        }

        // Garder la session à jour (sert à la déautorisation après inactivité).
        // On ne la modifie que si le refresh token fourni est bien celui stocké : athleteId n'est pas une preuve.
        const session = athleteId && await Session.findOne({ athleteId: String(athleteId) });
        if (session && session.getDecryptedRefreshToken() === refresh_token) {
            session.accessToken = encrypt(data.access_token);
            session.refreshToken = encrypt(data.refresh_token);
            session.expiresAt = data.expires_at;
            session.lastActivity = new Date();
            await session.save();
        }

        res.json({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at
        });
    } catch (error) {
        console.error('[AUTH] Erreur lors du rafraîchissement:', error.message);
        res.status(500).json({ error: 'Erreur lors du rafraîchissement du token' });
    }
});

module.exports = router;
