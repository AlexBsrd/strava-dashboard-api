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

// Méthode pour la déautorisation Strava
sessionSchema.methods.deauthorizeFromStrava = async function() {
    console.log(`[DEAUTH] Début de la déautorisation pour l\'athlète ${this.athleteId} (${this.firstname} ${this.lastname})`);

    try {
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

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`[DEAUTH SUCCESS] Athlète ${this.athleteId} déautorisé avec succès de Strava`);
                        resolve(data);
                    } else {
                        console.error(`[DEAUTH ERROR] Échec de la déautorisation pour l\'athlète ${this.athleteId}. Status: ${res.statusCode}`);
                        reject(new Error(`Strava returned status ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`[DEAUTH ERROR] Erreur lors de la déautorisation de l\'athlète ${this.athleteId}:`, error);
                reject(error);
            });

            req.end();
        });
    } catch (error) {
        console.error(`[DEAUTH ERROR] Erreur critique lors de la déautorisation de l\'athlète ${this.athleteId}:`, error);
        throw error;
    }
};

const Session = mongoose.model('Session', sessionSchema);

// Fonction pour supprimer les index existants
const cleanExistingIndexes = async () => {
    try {
        console.log('[INDEX] Début de la vérification des index existants');
        const collection = Session.collection;
        const indexes = await collection.getIndexes();

        console.log('[INDEX] Index trouvés:', Object.keys(indexes));

        for (const [indexName, indexInfo] of Object.entries(indexes)) {
            // Ne pas supprimer l'index _id
            if (indexName !== '_id_') {
                if (indexInfo.expireAfterSeconds !== undefined) {
                    console.log(`[INDEX] Suppression de l\'index TTL: ${indexName}`);
                    await collection.dropIndex(indexName);
                } else {
                    console.log(`[INDEX] Index conservé: ${indexName} (non-TTL)`);
                }
            }
        }
        console.log('[INDEX] Nettoyage des index terminé');
    } catch (error) {
        console.error('[INDEX ERROR] Erreur lors du nettoyage des index:', error);
    }
};

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
                console.error(`[ERROR] Erreur lors du traitement de la session ${session.athleteId}:`, error);
            }
        }
    } catch (error) {
        console.error('[CHECK ERROR] Erreur lors de la vérification des sessions:', error);
    }
};

// Fonction d'initialisation
const initialize = async () => {
    console.log('[INIT] Démarrage de l\'initialisation du modèle Session');

    // Nettoyer les index existants
    await cleanExistingIndexes();

    // Démarrer la vérification initiale des sessions
    console.log('[INIT] Démarrage de la vérification initiale des sessions');
    await checkInactiveSessions();
};

// Planifier la vérification toutes les 24 heures
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;
setInterval(() => {
    console.log('[SCHEDULER] Démarrage de la vérification périodique des sessions');
    checkInactiveSessions();
}, CHECK_INTERVAL);

// Exécuter l'initialisation au démarrage
initialize().catch(error => {
    console.error('[INIT ERROR] Erreur lors de l\'initialisation:', error);
});

module.exports = Session;
