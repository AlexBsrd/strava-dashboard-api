const express = require('express');
const router = express.Router();
const Session = require('../models/session.model');
const { authenticate, authenticateAdmin, encrypt } = require('../middleware/auth.middleware');

// Authentification requise pour toutes les routes
router.use(authenticate);

// Créer ou mettre à jour une session
router.post('/', async (req, res) => {
    try {
        const { athleteId, firstname, lastname, accessToken, refreshToken, expiresAt } = req.body;

        // Vérifier que les tokens sont présents
        if (!accessToken || !refreshToken) {
            return res.status(400).json({ error: 'Tokens manquants' });
        }

        // Chiffrer les tokens
        const encryptedAccessToken = encrypt(accessToken);
        const encryptedRefreshToken = encrypt(refreshToken);

        const session = await Session.findOneAndUpdate(
            { athleteId },
            {
                athleteId,
                firstname,
                lastname,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                expiresAt,
                lastActivity: new Date()
            },
            { upsert: true, new: true }
        );

        // Log de confirmation après sauvegarde
        console.log('[Session Creation] Session sauvegardée:', {
            athleteId: session.athleteId,
            firstname: session.firstname,
            lastname: session.lastname,
            expiresAt: session.expiresAt,
            lastActivity: session.lastActivity
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error creating/updating session:', error);
        res.status(500).json({
            error: 'Erreur lors de la création/mise à jour de la session',
            details: error.message
        });
    }
});

// Vérifier une session
router.get('/:athleteId/check', async (req, res) => {
    try {
        const session = await Session.findOne({ athleteId: req.params.athleteId });
        if (!session) {
            return res.status(404).send('Session not found');
        }

        // Mettre à jour lastActivity
        session.lastActivity = new Date();
        await session.save();

        res.status(200).send();
    } catch (error) {
        console.error('Error checking session:', error);
        res.status(500).send(error.message);
    }
});

// Mettre à jour l'activité
router.post('/:athleteId/activity', async (req, res) => {
    try {
        const session = await Session.findOneAndUpdate(
            { athleteId: req.params.athleteId },
            { lastActivity: new Date() }
        );

        if (!session) {
            return res.status(404).send('Session not found');
        }

        res.status(200).send();
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).send(error.message);
    }
});

// Lister toutes les sessions (admin seulement)
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const sessions = await Session.find()
            .sort({ lastActivity: -1 });

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).send(error.message);
    }
});

// Supprimer une session
router.delete('/:athleteId', async (req, res) => {
    try {
        // Vérifier que l'utilisateur est admin ou que c'est sa propre session
        if (req.userRole !== 'admin' && req.body.athleteId !== req.params.athleteId) {
            return res.status(403).send('Non autorisé à supprimer cette session');
        }

        const session = await Session.findOne({ athleteId: req.params.athleteId });
        if (!session) {
            return res.status(404).send('Session not found');
        }

        await session.deleteOne();
        res.status(200).send();
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).send(error.message);
    }
});

module.exports = router;
