// src/models/session.model.js
const mongoose = require('mongoose');
const https = require('https');

const sessionSchema = new mongoose.Schema({
    athleteId: {
        type: String,
        required: true,
        unique: true
    },
    firstname: String,
    lastname: String,
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Number,
        required: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index TTL pour supprimer les sessions après 24h d'inactivité
sessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

// Index TTL pour supprimer les sessions après 1 mois depuis la création
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Middleware pre-remove pour déautoriser auprès de Strava avant suppression
sessionSchema.pre('deleteOne', { document: true }, async function(next) {
    try {
        const options = {
            hostname: 'www.strava.com',
            path: '/oauth/deauthorize',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`
            }
        };

        await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`Strava returned status ${res.statusCode}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });

        next();
    } catch (error) {
        console.error('Erreur lors de la déautorisation Strava:', error);
        next();
    }
});

// Créer le modèle
const Session = mongoose.model('Session', sessionSchema);

// Vérification périodique des sessions à expirer
const checkExpiredSessions = async () => {
    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const expiredSessions = await Session.find({
            createdAt: { $lt: oneMonthAgo }
        });

        for (const session of expiredSessions) {
            await session.deleteOne();
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des sessions expirées:', error);
    }
};

// Exécuter la vérification toutes les 24 heures
setInterval(checkExpiredSessions, 24 * 60 * 60 * 1000);

// Exécuter une première vérification au démarrage
checkExpiredSessions();

module.exports = Session;
