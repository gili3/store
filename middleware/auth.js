const admin = require('firebase-admin');

/**
 * التحقق من أن المستخدم مسجل دخول
 */
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }

    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(401).json({ error: 'توكن غير صالح' });
    }
};

/**
 * التحقق من أن المستخدم أدمن
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'يجب تسجيل الدخول' });
        }

        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(req.user.uid).get();

        if (!userDoc.exists || !userDoc.data().isAdmin) {
            return res.status(403).json({ error: 'لا توجد صلاحيات كافية' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { requireAuth, requireAdmin };
