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
    },
    isActive: {
        type: Boolean,
        default: true
    },
    deauthorizedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.accessToken;
            delete ret.refreshToken;
            return ret;
        }
    }
});

// Méthodes pour décrypter les tokens
sessionSchema.methods.getDecryptedAccessToken = function() {
    return decrypt(this.accessToken.encryptedData, this.accessToken.iv);
};

sessionSchema.methods.getDecryptedRefreshToken = function() {
    return decrypt(this.refreshToken.encryptedData, this.refreshToken.iv);
};

// Méthode pour rafraîchir le token Strava
sessionSchema.methods.refreshStravaToken = async function() {
    console.log(`[REFRESH] Tentative de rafraîchissement du token pour l'athlète ${this.athleteId}`);

    return new Promise((resolve, reject) => {
        try {
            const refreshToken = this.getDecryptedRefreshToken();
            const requestBody = {
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            };

            const data = JSON.stringify(requestBody);

            const options = {
                hostname: 'www.strava.com',
                path: '/oauth/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', chunk => responseData += chunk);

                res.on('end', async () => {
                    if (res.statusCode === 200) {
                        try {
                            const tokenData = JSON.parse(responseData);

                            if (!tokenData.access_token || !tokenData.refresh_token) {
                                console.error(`[REFRESH ERROR] Données de token invalides reçues pour l'athlète ${this.athleteId}`);
                                reject(new Error('Invalid token data received from Strava'));
                                return;
                            }

                            // Encrypt and update tokens
                            const encryptedAccess = encrypt(tokenData.access_token);
                            const encryptedRefresh = encrypt(tokenData.refresh_token);

                            this.accessToken = encryptedAccess;
                            this.refreshToken = encryptedRefresh;
                            this.expiresAt = tokenData.expires_at;

                            await this.save();

                            console.log(`[REFRESH] Token rafraîchi avec succès pour l'athlète ${this.athleteId}`);
                            resolve(tokenData.access_token);
                        } catch (error) {
                            console.error(`[REFRESH ERROR] Erreur lors du traitement de la réponse pour l'athlète ${this.athleteId}:`, error);
                            reject(error);
                        }
                    } else {
                        console.error(`[REFRESH ERROR] Échec du rafraîchissement pour l'athlète ${this.athleteId}. Status: ${res.statusCode}`);
                        console.error(`[REFRESH ERROR] Réponse d'erreur:`, responseData);
                        reject(new Error(`Strava returned status ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`[REFRESH ERROR] Erreur réseau pour l'athlète ${this.athleteId}:`, error);
                reject(error);
            });

            req.write(data);
            req.end();
        } catch (error) {
            console.error(`[REFRESH ERROR] Erreur lors de la préparation de la requête:`, error);
            reject(error);
        }
    });
};

// Méthode pour la déautorisation Strava
sessionSchema.methods.deauthorizeFromStrava = async function() {
    console.log(`[DEAUTH] Début de la déautorisation pour l'athlète ${this.athleteId} (${this.firstname} ${this.lastname})`);

    try {
        // Rafraîchir le token avant la déautorisation
        const accessToken = await this.refreshStravaToken();

        const options = {
            hostname: 'www.strava.com',
            path: '/api/v3/oauth/deauthorize',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`[DEAUTH SUCCESS] Athlète ${this.athleteId} déautorisé avec succès de Strava`);
                        resolve(data);
                    } else {
                        console.error(`[DEAUTH ERROR] Échec de la déautorisation pour l'athlète ${this.athleteId}. Status: ${res.statusCode}`);
                        console.error(`[DEAUTH ERROR] Réponse complète:`, data);
                        reject(new Error(`Strava returned status ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`[DEAUTH ERROR] Erreur lors de la déautorisation de l'athlète ${this.athleteId}:`, error);
                reject(error);
            });

            req.end();
        });
    } catch (error) {
        console.error(`[DEAUTH ERROR] Erreur lors de la déautorisation de l'athlète ${this.athleteId}:`, error.message);
        throw error;
    }
};

const Session = mongoose.model('Session', sessionSchema);

// Fonction pour vérifier les sessions inactives
const checkInactiveSessions = async () => {
    console.log('[CHECK] Début de la vérification des sessions inactives');
    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const inactiveSessions = await Session.find({
            lastActivity: { $lt: oneMonthAgo },
            $or: [
                {
                    $and: [
                        { isActive: true },
                        { deauthorizedAt: null }
                    ]
                },
                {
                    $and: [
                        { isActive: { $exists: false } },
                        { deauthorizedAt: { $exists: false } }
                    ]
                }
            ]
        });

        console.log(`[CHECK] ${inactiveSessions.length} session(s) inactive(s) trouvée(s)`);

        for (const session of inactiveSessions) {
            try {
                await session.deauthorizeFromStrava();

                session.isActive = false;
                session.deauthorizedAt = new Date();
                await session.save();

                console.log(`[UPDATE] Session ${session.athleteId} marquée comme inactive et déautorisée`);
            } catch (error) {
                // Refresh token révoqué : l'athlète a déjà retiré l'accès côté Strava
                if (/"code":"invalid"/.test(error.message)) {
                    session.isActive = false;
                    session.deauthorizedAt = new Date();
                    await session.save();
                    console.log(`[UPDATE] Session ${session.athleteId} marquée inactive (token déjà révoqué côté Strava)`);
                } else {
                    console.error(`[ERROR] Erreur lors du traitement de la session ${session.athleteId}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('[CHECK ERROR] Erreur lors de la vérification des sessions:', error);
    }
};

module.exports = Session;
module.exports.checkInactiveSessions = checkInactiveSessions;
