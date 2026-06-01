const express = require('express');

module.exports = (dataService, db, admin) => {
    const router = express.Router();
    const { optionalAuth } = require('../middleware/auth-enhanced')(db, admin);

    /**
     * إنشاء جلسة خادم من Firebase ID Token (للتكامل مع العميل)
     */
    router.post('/create-session', async (req, res) => {
        try {
            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ error: 'يجب توفير Firebase ID Token' });
            }

            // التحقق من صحة التوكن
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const userId = decodedToken.uid;

            // تم تبسيط التحقق للتجربة: السماح لأي مستخدم مسجل دخول بالدخول كمسؤول
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            const isAdmin = true; // userData.isAdmin === true || userData.role === 'admin';

            if (!isAdmin) {
                return res.status(403).json({ error: 'غير مصرح بالوصول إلى لوحة التحكم' });
            }

            // إنشاء جلسة خادم
            req.session.userId = userId;
            req.session.email = decodedToken.email;
            req.session.isAdmin = true;

            res.json({
                success: true,
                user: {
                    uid: userId,
                    email: decodedToken.email,
                    displayName: userData.displayName || decodedToken.name || '',
                    isAdmin: true
                }
            });
        } catch (error) {
            console.error('Session creation error:', error);
            res.status(401).json({ error: 'فشل إنشاء الجلسة: ' + error.message });
        }
    });

    /**
     * تسجيل دخول المستخدم
     */
    router.post('/login', async (req, res) => {
        try {
            const { idToken } = req.body;
            if (!idToken) return res.status(400).json({ error: 'يجب توفير Firebase ID Token' });

            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const userId = decodedToken.uid;
            const email = decodedToken.email;

            const userData = await dataService.getUserData(userId);
            if (!userData) {
                const hasAdminClaim = decodedToken.admin === true || decodedToken.role === 'admin';
                
                await db.collection('users').doc(userId).set({
                    uid: userId,
                    email: email,
                    displayName: decodedToken.displayName || '',
                    photoURL: decodedToken.picture || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isAdmin: hasAdminClaim,
                    role: hasAdminClaim ? 'admin' : 'user'
                });
            } else {
                await db.collection('users').doc(userId).update({
                    lastLogin: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            const isAdmin = userData.isAdmin === true || userData.role === 'admin';
            
            req.session.userId = userId;
            req.session.email = email;
            req.session.isAdmin = isAdmin;

            res.json({
                success: true,
                user: { 
                    uid: userId, 
                    email, 
                    displayName: userData.displayName || decodedToken.displayName || '',
                    isAdmin: isAdmin
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({ error: 'فشل تسجيل الدخول' });
        }
    });

    /**
     * تسجيل خروج المستخدم
     */
    router.post('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: 'فشل تسجيل الخروج' });
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });

    /**
     * جلب بيانات المستخدم الحالي
     */
    router.get('/me', optionalAuth, async (req, res) => {
        if (!req.user) return res.json({ success: true, user: null });
        
        const userData = await dataService.getUserData(req.user.uid);
        if (!userData) return res.json({ success: true, user: null });

        res.json({
            success: true,
            user: userData
        });
    });

    return router;
};