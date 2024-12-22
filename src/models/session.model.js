// src/models/session.model.js
const mongoose = require('mongoose');
const https = require('https');
const { encrypt, decrypt } = require('../middleware/auth.middleware');

const sessionSchema = new mongoose.Schema({
    athleteId: {
        type: String,
        required: true,
        unique: true
    },
    firstname: String,
    lastname: String,
    accessToken: {
        iv: { type: String, required: true },
        encryptedData: { type: String, required: true }
    },
    refreshToken: {
        iv: { type: String, required: true },
        encryptedData: { type: String, required: true }
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
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Ne pas inclure les tokens chiffrés dans la sortie JSON
            delete ret.accessToken;
            delete ret.refreshToken;
            return ret;
        }
    }
});

// Méthode pour décrypter l'access token
sessionSchema.methods.getDecryptedAccessToken = function() {
    return decrypt(this.accessToken.encryptedData, this.accessToken.iv);
};

// Méthode pour décrypter le refresh token
sessionSchema.methods.getDecryptedRefreshToken = function() {
    return decrypt(this.refreshToken.encryptedData, this.refreshToken.iv);
};

// Index TTL : supprime et déautorise les sessions après 30 jours d'inactivité
sessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Middleware pre-remove pour déautoriser auprès de Strava avant suppression
sessionSchema.pre('deleteOne', { document: true }, async function(next) {
    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Ne déautoriser que si la dernière activité date de plus de 30 jours
        if (this.lastActivity < oneMonthAgo) {
            const accessToken = this.getDecryptedAccessToken();
            const options = {
                hostname: 'www.strava.com',
                path: '/oauth/deauthorize',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
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

            console.log(`Athlète ${this.athleteId} déautorisé après 30 jours d'inactivité`);
        } else {
            console.log(`Session de l'athlète ${this.athleteId} supprimée sans déautorisation`);
        }

        next();
    } catch (error) {
        console.error('Erreur lors de la déautorisation Strava:', error);
        next();
    }
});

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

const Session = mongoose.model('Session', sessionSchema);

// Exécuter la vérification toutes les 24 heures
setInterval(checkExpiredSessions, 24 * 60 * 60 * 1000);

// Exécuter une première vérification au démarrage
checkExpiredSessions();

module.exports = Session;
