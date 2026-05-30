/**
 * auth-module-ultimate.js - نظام المصادقة المتكامل (النسخة النهائية المحسنة)
 * @version 3.1.1 - إصلاح مشكلة إعادة التوجيه
 * يدعم: Google, Email, Guest, Forgot Password, Sign Out
 * تحسينات أمنية: 
 * - كلمة مرور قوية (8 أحرف، حرف كبير، رقم، رمز)
 * - قفل الحساب لمدة 30 دقيقة بعد 5 محاولات فاشلة
 * - التحقق المسبق من البريد الإلكتروني
 */

(function() {
    'use strict';

    // ======================== المتغيرات العامة ========================
    let auth = null;
    let db = null;
    let isProcessing = false;
    
    // نظام منع الهجمات (Rate Limiting) - محسن
    const failedAttempts = new Map(); // تخزين عدد المحاولات الفاشلة لكل بريد
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 دقيقة
    
    // إعدادات التحقق من كلمة المرور - محسّنة
    const MIN_PASSWORD_LENGTH = 8;
    const MIN_NAME_LENGTH = 2;
    
    // متطلبات كلمة المرور
    const PASSWORD_REQUIREMENTS = {
        minLength: 8,
        hasUpperCase: /[A-Z]/,
        hasLowerCase: /[a-z]/,
        hasNumber: /[0-9]/,
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>_\-+=~`\[\]\\/]/,
        noSpaces: /^\S*$/
    };
    
    // ======================== دوال مساعدة ========================
    
    function log(message, type = 'info') {
        const prefix = {
            'error': '❌',
            'success': '✅',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        console.log(`[Auth] ${prefix[type] || '📌'} ${new Date().toLocaleTimeString()} - ${message}`);
    }

    function showLoader() {
        const loader = document.getElementById('initialLoader');
        if (loader) {
            loader.classList.remove('hidden');
            loader.style.display = 'flex';
            loader.style.opacity = '1';
        }
    }

    function hideLoader() {
        const loader = document.getElementById('initialLoader');
        if (loader) {
            loader.style.opacity = '0';
            loader.classList.add('hidden');
            setTimeout(() => {
                if (loader.classList.contains('hidden')) {
                    loader.style.display = 'none';
                }
            }, 500);
        }
    }

    function showMessage(elementId, message, type = 'error') {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`[Auth] عنصر الرسائل "${elementId}" غير موجود`);
            return;
        }
        
        if (element._timeout) {
            clearTimeout(element._timeout);
        }
        
        element.textContent = message;
        element.className = `auth-message ${type} show`;
        
        let duration = type === 'error' ? 10000 : (type === 'success' ? 6000 : 12000);
        
        element._timeout = setTimeout(() => {
            element.classList.remove('show');
        }, duration);
    }

    function hideMessage(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('show');
            if (element._timeout) {
                clearTimeout(element._timeout);
            }
        }
    }

    function disableButtons(disable = true) {
        const buttons = document.querySelectorAll('button.submit-btn, button.auth-btn');
        buttons.forEach(btn => {
            if (disable) {
                btn.setAttribute('data-original-text', btn.innerHTML);
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';
                btn.disabled = true;
            } else {
                const original = btn.getAttribute('data-original-text');
                if (original) {
                    btn.innerHTML = original;
                }
                btn.disabled = false;
            }
        });
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
    }
    
    function validatePasswordStrength(password) {
        const checks = {
            minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
            hasUpperCase: PASSWORD_REQUIREMENTS.hasUpperCase.test(password),
            hasLowerCase: PASSWORD_REQUIREMENTS.hasLowerCase.test(password),
            hasNumber: PASSWORD_REQUIREMENTS.hasNumber.test(password),
            hasSpecialChar: PASSWORD_REQUIREMENTS.hasSpecialChar.test(password),
            noSpaces: PASSWORD_REQUIREMENTS.noSpaces.test(password)
        };
        
        const isValid = Object.values(checks).every(check => check === true);
        
        let missingRequirements = [];
        if (!checks.minLength) missingRequirements.push(`• ${PASSWORD_REQUIREMENTS.minLength} أحرف على الأقل`);
        if (!checks.hasUpperCase) missingRequirements.push('• حرف كبير واحد على الأقل (A-Z)');
        if (!checks.hasLowerCase) missingRequirements.push('• حرف صغير واحد على الأقل (a-z)');
        if (!checks.hasNumber) missingRequirements.push('• رقم واحد على الأقل (0-9)');
        if (!checks.hasSpecialChar) missingRequirements.push('• رمز خاص واحد على الأقل (!@#$%^&*)');
        if (!checks.noSpaces) missingRequirements.push('• بدون مسافات');
        
        return {
            isValid,
            missingRequirements,
            checks
        };
    }
    
    function validatePassword(password) {
        const result = validatePasswordStrength(password);
        return result.isValid;
    }
    
    function validateName(name) {
        return name && name.trim().length >= MIN_NAME_LENGTH;
    }
    
    function getPasswordRequirementsMessage() {
        return `🔐 متطلبات كلمة المرور:\n` +
               `• ${PASSWORD_REQUIREMENTS.minLength} أحرف على الأقل\n` +
               `• حرف كبير واحد على الأقل (A-Z)\n` +
               `• حرف صغير واحد على الأقل (a-z)\n` +
               `• رقم واحد على الأقل (0-9)\n` +
               `• رمز خاص واحد على الأقل (!@#$%^&*)\n` +
               `• بدون مسافات`;
    }
    
    function isAccountLocked(email) {
        const record = failedAttempts.get(email.toLowerCase());
        if (!record) return { locked: false };
        
        if (record.count >= MAX_FAILED_ATTEMPTS) {
            const timeSinceLastAttempt = Date.now() - record.lastAttempt;
            if (timeSinceLastAttempt < LOCKOUT_DURATION) {
                const remainingMinutes = Math.ceil((LOCKOUT_DURATION - timeSinceLastAttempt) / 60000);
                const remainingSeconds = Math.ceil((LOCKOUT_DURATION - timeSinceLastAttempt) / 1000);
                return { 
                    locked: true, 
                    remainingMinutes,
                    remainingSeconds,
                    message: `🔒 تم قفل الحساب مؤقتاً بسبب ${MAX_FAILED_ATTEMPTS} محاولات فاشلة.\n⏱️ يرجى الانتظار ${remainingMinutes} دقيقة (${remainingSeconds} ثانية) ثم المحاولة مرة أخرى.`
                };
            } else {
                failedAttempts.delete(email.toLowerCase());
                return { locked: false };
            }
        }
        return { locked: false };
    }
    
    function recordFailedAttempt(email) {
        const key = email.toLowerCase();
        const record = failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
        record.count++;
        record.lastAttempt = Date.now();
        failedAttempts.set(key, record);
        
        const remainingAttempts = MAX_FAILED_ATTEMPTS - record.count;
        if (remainingAttempts > 0) {
            log(`محاولة فاشلة ${record.count}/${MAX_FAILED_ATTEMPTS} للبريد: ${email} - متبقى ${remainingAttempts} محاولات`, 'warning');
        } else {
            log(`🔒 تم قفل الحساب للبريد: ${email} لمدة 30 دقيقة`, 'warning');
        }
    }
    
    function clearFailedAttempts(email) {
        failedAttempts.delete(email.toLowerCase());
    }

    function safeRedirect(url) {
        log(`توجيه إلى: ${url}`, 'info');
        showLoader();
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }

    function safeAddEventListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`[Auth] العنصر "${id}" غير موجود في الصفحة`);
        }
    }

    // ======================== انتظار تهيئة Firebase ========================
    
    async function waitForFirebase() {
        log('انتظار تهيئة Firebase...', 'info');
        
        if (window.firebaseInitialized && window.auth && window.db) {
            auth = window.auth;
            db = window.db;
            log('✅ Firebase جاهزة مسبقاً', 'success');
            return true;
        }
        
        if (!window.firebaseModules) {
            log('⏳ انتظار تحميل وحدات Firebase...', 'info');
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('مهلة انتظار وحدات Firebase'));
                }, 10000);
                
                const checkModules = () => {
                    if (window.firebaseModules) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(checkModules, 100);
                    }
                };
                
                window.addEventListener('firebase-ready', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
                
                checkModules();
            });
        }
        
        if (window.initializeFirebaseUnified) {
            try {
                const instance = await window.initializeFirebaseUnified();
                auth = instance.auth;
                db = instance.db;
                log('✅ Firebase مهيأة بنجاح', 'success');
                return true;
            } catch (error) {
                log('❌ فشل تهيئة Firebase: ' + error.message, 'error');
                return false;
            }
        }
        
        return false;
    }

    // ======================== حفظ المستخدم في Firestore ========================
    
    async function saveUserToFirestore(user, additionalData = {}) {
        if (!db || !user) {
            console.warn('[Auth] تعذر حفظ المستخدم: Firestore غير متاح');
            return;
        }
        
        try {
            const userRef = window.firebaseModules.doc(db, "users", user.uid);
            const userDoc = await window.firebaseModules.getDoc(userRef);
            
            const userData = {
                email: user.email || '',
                name: user.displayName || user.email?.split('@')[0] || 'مستخدم',
                phone: user.phoneNumber || additionalData.phone || '',
                address: additionalData.address || '',
                photoURL: user.photoURL || '/public/images/user-placeholder.png',
                role: 'user',
                isAdmin: false,
                isGuest: false,
                isActive: true,
                emailVerified: user.emailVerified || false,
                totalOrders: 0,
                totalSpent: 0,
                favorites: [],
                cart: [],
                lastLogin: window.firebaseModules.serverTimestamp(),
                createdAt: window.firebaseModules.serverTimestamp(),
                updatedAt: window.firebaseModules.serverTimestamp()
            };
            
            if (!userDoc.exists()) {
                await window.firebaseModules.setDoc(userRef, userData);
                log('✅ تم إنشاء مستند المستخدم في Firestore', 'success');
            } else {
                await window.firebaseModules.updateDoc(userRef, {
                    lastLogin: window.firebaseModules.serverTimestamp(),
                    emailVerified: user.emailVerified || false,
                    name: user.displayName || userDoc.data().name,
                    phone: additionalData.phone || userDoc.data().phone
                });
                log('✅ تم تحديث بيانات المستخدم', 'success');
            }
        } catch (error) {
            console.error('❌ خطأ في حفظ المستخدم:', error);
            showMessage('emailAuthMessage', 'حدث خطأ أثناء حفظ بيانات المستخدم', 'error');
        }
    }

    // ======================== التحقق من وجود البريد في Firestore ========================
    
    async function checkEmailExistsInFirestore(email) {
        if (!db) return null;
        
        try {
            const usersRef = window.firebaseModules.collection(db, "users");
            const q = window.firebaseModules.query(
                usersRef, 
                window.firebaseModules.where("email", "==", email.toLowerCase())
            );
            const querySnapshot = await window.firebaseModules.getDocs(q);
            
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                return userDoc.data();
            }
            return null;
        } catch (error) {
            log('خطأ في التحقق من البريد: ' + error.message, 'error');
            return null;
        }
    }

    // ======================== تسجيل الدخول بـ Google ========================
    
    async function signInWithGoogle() {
        if (isProcessing) {
            console.warn('[Auth] عملية مصادقة جارية بالفعل');
            return;
        }
        isProcessing = true;
        
        try {
            log('بدء تسجيل الدخول بـ Google...', 'info');
            showMessage('emailAuthMessage', '⏳ جاري الاتصال بـ Google...', 'info');
            disableButtons(true);
            
            if (!await waitForFirebase()) {
                showMessage('emailAuthMessage', '❌ تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت.', 'error');
                return;
            }
            
            const provider = new window.firebaseModules.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            
            const result = await window.firebaseModules.signInWithPopup(auth, provider);
            log('✅ تم تسجيل الدخول بنجاح', 'success');
            
            await saveUserToFirestore(result.user);
            
            showMessage('emailAuthMessage', '✅ تم تسجيل الدخول بنجاح! جاري التوجيه...', 'success');
            safeRedirect('index.html');
            
        } catch (error) {
            log('خطأ: ' + (error.code || error.message), 'error');
            
            const messages = {
                'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
                'auth/cancelled-popup-request': 'تم إلغاء الطلب',
                'auth/popup-blocked': 'الرجاء السماح بالنوافذ المنبثقة في المتصفح',
                'auth/configuration-not-found': 'خطأ في إعدادات Google Sign-In، يرجى التواصل مع الدعم',
                'auth/network-request-failed': 'فشل الاتصال بالشبكة. تحقق من اتصالك بالإنترنت'
            };
            
            showMessage('emailAuthMessage', messages[error.code] || 'حدث خطأ غير متوقع أثناء تسجيل الدخول', 'error');
        } finally {
            isProcessing = false;
            disableButtons(false);
        }
    }

    // ======================== تسجيل الدخول كضيف ========================
    
    function signInAsGuest() {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            log('الدخول كضيف...', 'info');
            
            const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const guestUser = {
                uid: guestId,
                displayName: 'زائر',
                email: null,
                photoURL: '/public/images/user-placeholder.png',
                phone: '',
                address: '',
                isGuest: true,
                isAdmin: false,
                createdAt: new Date().toISOString()
            };
            
            sessionStorage.setItem('guest_user', JSON.stringify(guestUser));
            
            log('✅ تم إنشاء جلسة ضيف', 'success');
            
            safeRedirect('index.html');
            
        } catch (error) {
            log('خطأ في الدخول كضيف: ' + error.message, 'error');
            showMessage('emailAuthMessage', 'حدث خطأ. حاول مرة أخرى.', 'error');
            isProcessing = false;
        }
    }

    // ======================== تسجيل الدخول بالبريد ========================
    
    async function signInWithEmail(email, password) {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            if (!email || !password) {
                showMessage('emailAuthMessage', '❌ الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
                return;
            }
            
            if (!validateEmail(email)) {
                showMessage('emailAuthMessage', '❌ صيغة البريد الإلكتروني غير صحيحة', 'error');
                return;
            }
            
            const lockStatus = isAccountLocked(email);
            if (lockStatus.locked) {
                showMessage('emailAuthMessage', lockStatus.message, 'error');
                return;
            }
            
            const userData = await checkEmailExistsInFirestore(email);
            if (!userData) {
                showMessage('emailAuthMessage', 
                    '❌ لا يوجد حساب مسجل بهذا البريد الإلكتروني.\n📝 هل تريد إنشاء حساب جديد؟', 
                    'error'
                );
                return;
            }
            
            showMessage('emailAuthMessage', '⏳ جاري التحقق من بيانات الدخول...', 'info');
            disableButtons(true);
            
            if (!await waitForFirebase()) {
                showMessage('emailAuthMessage', '❌ تعذر الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت', 'error');
                return;
            }
            
            const userCredential = await window.firebaseModules.signInWithEmailAndPassword(auth, email, password);
            log('✅ تم تسجيل الدخول بنجاح', 'success');
            
            clearFailedAttempts(email);
            
            if (userCredential.user && !userCredential.user.emailVerified) {
                log('⚠️ البريد الإلكتروني غير مؤكد', 'warning');
                
                try {
                    await window.firebaseModules.sendEmailVerification(userCredential.user);
                    showMessage('emailAuthMessage', 
                        `⚠️ بريدك الإلكتروني (${email}) لم يتم تأكيده بعد.\n\n` +
                        `📧 تم إرسال رابط التأكيد مرة أخرى إلى بريدك.\n` +
                        `🔍 يرجى التحقق من صندوق الوارد والبريد المزعج (Spam).\n` +
                        `✅ بعد التأكيد، يمكنك تسجيل الدخول مجدداً.`,
                        'info'
                    );
                    log('✅ تم إرسال رابط التأكيد مجدداً', 'success');
                } catch (e) {
                    log('⚠️ فشل إرسال رابط التأكيد: ' + e.message, 'warning');
                    showMessage('emailAuthMessage', 
                        `⚠️ بريدك الإلكتروني (${email}) لم يتم تأكيده بعد.\n` +
                        `📧 يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب.`,
                        'info'
                    );
                }
                
                await window.firebaseModules.signOut(auth);
                return;
            }
            
            await saveUserToFirestore(userCredential.user);
            
            showMessage('emailAuthMessage', '✅ تم تسجيل الدخول بنجاح! جاري التوجيه...', 'success');
            setTimeout(() => {
                safeRedirect('index.html');
            }, 1500);
            
        } catch (error) {
            log('❌ فشل تسجيل الدخول: ' + error.code, 'error');
            
            if (email) {
                recordFailedAttempt(email);
                const lockStatus = isAccountLocked(email);
                if (lockStatus.locked) {
                    showMessage('emailAuthMessage', lockStatus.message, 'error');
                    return;
                }
            }
            
            const messages = {
                'auth/user-not-found': '❌ لا يوجد حساب مسجل بهذا البريد الإلكتروني.\n📝 هل تريد إنشاء حساب جديد؟',
                'auth/wrong-password': '❌ كلمة المرور غير صحيحة.\n🔑 يرجى المحاولة مجدداً أو استخدام "نسيت كلمة المرور".',
                'auth/invalid-email': '❌ صيغة البريد الإلكتروني غير صحيحة',
                'auth/user-disabled': '❌ تم تعطيل هذا الحساب. يرجى التواصل مع الدعم الفني',
                'auth/too-many-requests': '❌ محاولات دخول كثيرة جداً.\n⏱️ يرجى الانتظار 30 دقيقة ثم المحاولة مرة أخرى.',
                'auth/invalid-credential': '❌ بيانات الدخول غير صحيحة.\n🔑 يرجى التحقق من البريد وكلمة المرور',
                'auth/network-request-failed': '❌ فشل الاتصال بالشبكة.\n🌐 يرجى التحقق من اتصالك بالإنترنت'
            };
            
            showMessage('emailAuthMessage', messages[error.code] || '❌ فشل تسجيل الدخول. حاول مرة أخرى.', 'error');
            
        } finally {
            isProcessing = false;
            disableButtons(false);
        }
    }

    // ======================== إنشاء حساب جديد ========================
    
    async function signUpWithEmail(email, password, name, phone = '') {
        if (isProcessing) return false;
        isProcessing = true;
        
        try {
            if (!email || !password || !name) {
                showMessage('emailAuthMessage', '❌ الرجاء إدخال جميع البيانات المطلوبة', 'error');
                return false;
            }
            
            if (!validateEmail(email)) {
                showMessage('emailAuthMessage', '❌ صيغة البريد الإلكتروني غير صحيحة\n📧 مثال: name@example.com', 'error');
                return false;
            }
            
            const passwordStrength = validatePasswordStrength(password);
            if (!passwordStrength.isValid) {
                let message = '❌ كلمة المرور غير متطابقة مع المتطلبات:\n\n';
                message += passwordStrength.missingRequirements.join('\n');
                message += '\n\n' + getPasswordRequirementsMessage();
                showMessage('emailAuthMessage', message, 'error');
                return false;
            }
            
            if (!validateName(name)) {
                showMessage('emailAuthMessage', `❌ الاسم يجب أن يكون ${MIN_NAME_LENGTH} أحرف على الأقل`, 'error');
                return false;
            }
            
            showMessage('emailAuthMessage', '⏳ جاري إنشاء الحساب...', 'info');
            disableButtons(true);
            
            if (!await waitForFirebase()) {
                showMessage('emailAuthMessage', '❌ تعذر الاتصال بالخادم', 'error');
                return false;
            }
            
            const existingUser = await checkEmailExistsInFirestore(email);
            if (existingUser) {
                showMessage('emailAuthMessage', 
                    '❌ هذا البريد الإلكتروني مسجل بالفعل.\n🔑 يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.', 
                    'error'
                );
                return false;
            }
            
            const userCredential = await window.firebaseModules.createUserWithEmailAndPassword(auth, email, password);
            
            await window.firebaseModules.updateProfile(userCredential.user, {
                displayName: name,
                photoURL: '/public/images/user-placeholder.png'
            });
            
            try {
                await window.firebaseModules.sendEmailVerification(userCredential.user);
                log('✅ تم إرسال رابط التأكيد', 'success');
            } catch (e) {
                log('⚠️ فشل إرسال رابط التأكيد: ' + e.message, 'warning');
            }
            
            await saveUserToFirestore(userCredential.user, { phone });
            
            if (phone) {
                const userRef = window.firebaseModules.doc(db, "users", userCredential.user.uid);
                await window.firebaseModules.updateDoc(userRef, { phone });
            }
            
            showMessage('emailAuthMessage', 
                `✅ تم إنشاء الحساب بنجاح!\n\n` +
                `📧 تم إرسال رابط التأكيد إلى: ${email}\n` +
                `🔍 يرجى التحقق من صندوق الوارد والبريد المزعج (Spam).\n` +
                `✅ بعد التأكيد، يمكنك تسجيل الدخول.\n` +
                `⏱️ الرابط صالح لمدة ساعة واحدة.`,
                'success'
            );
            
            await window.firebaseModules.signOut(auth);
            
            setTimeout(() => {
                hideAllForms();
                showLoginForm();
                const emailInput = document.getElementById('emailInput');
                if (emailInput) emailInput.value = email;
            }, 3000);
            
            return true;
            
        } catch (error) {
            log('❌ فشل إنشاء الحساب: ' + error.code, 'error');
            
            const messages = {
                'auth/email-already-in-use': '❌ البريد الإلكتروني مستخدم بالفعل.\n🔑 يرجى تسجيل الدخول أو استخدام بريد آخر.',
                'auth/invalid-email': '❌ صيغة البريد الإلكتروني غير صحيحة',
                'auth/weak-password': `❌ كلمة المرور ضعيفة جداً.\n💡 ${getPasswordRequirementsMessage()}`,
                'auth/network-request-failed': '❌ فشل الاتصال بالشبكة.\n🌐 يرجى التحقق من اتصالك بالإنترنت'
            };
            
            showMessage('emailAuthMessage', messages[error.code] || '❌ فشل إنشاء الحساب. حاول مرة أخرى.', 'error');
            return false;
            
        } finally {
            isProcessing = false;
            disableButtons(false);
        }
    }

    // ======================== استعادة كلمة المرور ========================
    
    async function sendPasswordReset(email) {
        if (isProcessing) return false;
        isProcessing = true;
        
        try {
            if (!email) {
                showMessage('resetPasswordMessage', '❌ الرجاء إدخال البريد الإلكتروني', 'error');
                return false;
            }
            
            if (!validateEmail(email)) {
                showMessage('resetPasswordMessage', '❌ صيغة البريد الإلكتروني غير صحيحة', 'error');
                return false;
            }
            
            showMessage('resetPasswordMessage', '⏳ جاري التحقق من البريد الإلكتروني...', 'info');
            
            const userData = await checkEmailExistsInFirestore(email);
            
            if (!userData) {
                showMessage('resetPasswordMessage', 
                    '❌ لا يوجد حساب مسجل بهذا البريد الإلكتروني.\n' +
                    '📝 يرجى التحقق من البريد أو إنشاء حساب جديد.',
                    'error'
                );
                return false;
            }
            
            showMessage('resetPasswordMessage', '⏳ جاري إرسال رابط إعادة التعيين...', 'info');
            disableButtons(true);
            
            if (!await waitForFirebase()) {
                showMessage('resetPasswordMessage', '❌ تعذر الاتصال بالخادم', 'error');
                return false;
            }
            
            await window.firebaseModules.sendPasswordResetEmail(auth, email);
            
            showMessage('resetPasswordMessage', 
                `✅ تم إرسال رابط إعادة التعيين!\n\n` +
                `📧 تم الإرسال إلى: ${email}\n` +
                `🔍 يرجى التحقق من صندوق الوارد والبريد المزعج (Spam).\n` +
                `⏱️ الرابط صالح لمدة ساعة واحدة فقط.\n` +
                `🔒 إذا لم تصلك الرسالة، حاول مرة أخرى بعد 5 دقائق.`,
                'success'
            );
            
            log('✅ تم إرسال رابط استعادة كلمة المرور', 'success');
            return true;
            
        } catch (error) {
            log('❌ فشل إرسال رابط الاستعادة: ' + error.code, 'error');
            
            const messages = {
                'auth/user-not-found': '❌ لا يوجد حساب مسجل بهذا البريد الإلكتروني',
                'auth/invalid-email': '❌ صيغة البريد الإلكتروني غير صحيحة',
                'auth/too-many-requests': '❌ تم إرسال طلبات كثيرة.\n⏱️ يرجى الانتظار 30 دقيقة ثم المحاولة مرة أخرى.',
                'auth/network-request-failed': '❌ فشل الاتصال بالشبكة.\n🌐 يرجى التحقق من اتصالك بالإنترنت'
            };
            
            showMessage('resetPasswordMessage', messages[error.code] || '❌ فشل إرسال رابط الاستعادة', 'error');
            return false;
            
        } finally {
            isProcessing = false;
            disableButtons(false);
        }
    }

    // ======================== تسجيل الخروج ========================
    
    async function logout() {
        log('تسجيل الخروج...', 'info');
        showLoader();
        
        sessionStorage.removeItem('guest_user');
        
        if (auth && window.firebaseModules) {
            try {
                await window.firebaseModules.signOut(auth);
                log('✅ تم تسجيل الخروج من Firebase', 'success');
            } catch (error) {
                log('⚠️ خطأ في تسجيل الخروج: ' + error.message, 'warning');
            }
        }
        
        safeRedirect('login.html');
    }

    // ======================== التحقق من حالة المستخدم (معدل - إصلاح مشكلة التوجيه) ========================
    
    async function checkAuthState() {
        log('التحقق من حالة المصادقة...', 'info');
        
        if (!await waitForFirebase()) {
            log('⚠️ Firebase غير متاحة', 'warning');
            hideLoader();
            return;
        }
        
        window.firebaseModules.onAuthStateChanged(auth, (user) => {
            const currentPath = window.location.pathname;
            const isLoginPage = currentPath.includes('login.html') || currentPath === '/' || currentPath === '/login';
            const isIndexPage = currentPath.includes('index.html') || currentPath === '/index';
            
            if (user) {
                log('👤 مستخدم مسجل: ' + (user.email || user.displayName), 'success');
                
                // فقط في صفحة الدخول نوجه للرئيسية
                if (isLoginPage) {
                    log('🔄 مستخدم مسجل على صفحة الدخول، جاري التوجيه للرئيسية', 'info');
                    safeRedirect('index.html');
                } else {
                    hideLoader();
                }
                return;
            }
            
            const guest = sessionStorage.getItem('guest_user');
            if (guest) {
                log('👤 جلسة ضيف موجودة', 'info');
                
                // فقط في صفحة الدخول نوجه للرئيسية
                if (isLoginPage) {
                    log('🔄 جلسة ضيف على صفحة الدخول، جاري التوجيه للرئيسية', 'info');
                    safeRedirect('index.html');
                } else {
                    hideLoader();
                }
                return;
            }
            
            // لا يوجد مستخدم ولا ضيف
            if (isLoginPage) {
                log('✅ لا يوجد مستخدم، إظهار واجهة تسجيل الدخول', 'info');
                hideLoader();
            } else if (!isIndexPage && !currentPath.includes('404.html') && 
                       !currentPath.includes('about.html') && !currentPath.includes('contact.html')) {
                log('🔒 صفحة محمية، توجيه إلى تسجيل الدخول', 'info');
                safeRedirect('login.html');
            } else {
                hideLoader();
            }
        });
    }

    // ======================== إدارة النماذج ========================
    
    function showEmailAuthForm() {
        const authOptions = document.getElementById('authOptions');
        const emailAuthForm = document.getElementById('emailAuthForm');
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        
        if (authOptions) authOptions.style.display = 'none';
        if (emailAuthForm) emailAuthForm.style.display = 'block';
        if (resetPasswordForm) resetPasswordForm.style.display = 'none';
        showLoginForm();
    }

    function showLoginForm() {
        const loginFields = document.getElementById('loginFields');
        const registerFields = document.getElementById('registerFields');
        const authFormTitle = document.getElementById('authFormTitle');
        
        if (loginFields) loginFields.style.display = 'block';
        if (registerFields) registerFields.style.display = 'none';
        if (authFormTitle) authFormTitle.textContent = 'تسجيل الدخول';
        hideMessage('emailAuthMessage');
        
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }

    function showRegistrationForm() {
        const loginFields = document.getElementById('loginFields');
        const registerFields = document.getElementById('registerFields');
        const authFormTitle = document.getElementById('authFormTitle');
        
        if (loginFields) loginFields.style.display = 'none';
        if (registerFields) registerFields.style.display = 'block';
        if (authFormTitle) authFormTitle.textContent = 'إنشاء حساب جديد';
        hideMessage('emailAuthMessage');
        
        const registerName = document.getElementById('registerName');
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const registerPhone = document.getElementById('registerPhone');
        if (registerName) registerName.value = '';
        if (registerEmail) registerEmail.value = '';
        if (registerPassword) registerPassword.value = '';
        if (registerPhone) registerPhone.value = '';
        
        const passwordHint = document.getElementById('passwordHint');
        if (passwordHint) {
            passwordHint.textContent = getPasswordRequirementsMessage();
            passwordHint.style.display = 'block';
        }
    }

    function showResetPasswordForm() {
        const authOptions = document.getElementById('authOptions');
        const emailAuthForm = document.getElementById('emailAuthForm');
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        
        if (authOptions) authOptions.style.display = 'none';
        if (emailAuthForm) emailAuthForm.style.display = 'none';
        if (resetPasswordForm) resetPasswordForm.style.display = 'block';
        
        const resetEmailInput = document.getElementById('resetEmailInput');
        if (resetEmailInput) resetEmailInput.value = '';
        hideMessage('resetPasswordMessage');
        
        const sendResetLinkBtn = document.getElementById('sendResetLinkBtn');
        if (sendResetLinkBtn) sendResetLinkBtn.style.display = 'flex';
    }

    function hideAllForms() {
        const authOptions = document.getElementById('authOptions');
        const emailAuthForm = document.getElementById('emailAuthForm');
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        
        if (emailAuthForm) emailAuthForm.style.display = 'none';
        if (resetPasswordForm) resetPasswordForm.style.display = 'none';
        if (authOptions) authOptions.style.display = 'flex';
        
        hideMessage('emailAuthMessage');
        hideMessage('resetPasswordMessage');
    }

    // ======================== إعداد المستمعين ========================
    
    function setupEventListeners() {
        log('إعداد مستمعي الأحداث...', 'info');
        
        safeAddEventListener('googleSignInBtn', 'click', signInWithGoogle);
        safeAddEventListener('guestSignInBtn', 'click', signInAsGuest);
        safeAddEventListener('emailSignInBtn', 'click', showEmailAuthForm);
        
        safeAddEventListener('backToAuthOptions', 'click', hideAllForms);
        safeAddEventListener('backFromReset', 'click', hideAllForms);
        
        safeAddEventListener('signInBtn', 'click', () => {
            const email = document.getElementById('emailInput')?.value.trim() || '';
            const password = document.getElementById('passwordInput')?.value || '';
            signInWithEmail(email, password);
        });
        
        safeAddEventListener('signUpBtn', 'click', showRegistrationForm);
        
        safeAddEventListener('completeSignUpBtn', 'click', () => {
            const email = document.getElementById('registerEmail')?.value.trim() || '';
            const password = document.getElementById('registerPassword')?.value || '';
            const name = document.getElementById('registerName')?.value.trim() || '';
            const phone = document.getElementById('registerPhone')?.value.trim() || '';
            signUpWithEmail(email, password, name, phone);
        });
        
        safeAddEventListener('switchToLoginBtn', 'click', showLoginForm);
        
        safeAddEventListener('forgotPasswordBtn', 'click', (e) => {
            e.preventDefault();
            showResetPasswordForm();
        });
        
        safeAddEventListener('sendResetLinkBtn', 'click', () => {
            const email = document.getElementById('resetEmailInput')?.value.trim() || '';
            sendPasswordReset(email);
        });
        
        const passwordInput = document.getElementById('passwordInput');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const email = document.getElementById('emailInput')?.value.trim() || '';
                    const password = e.target.value;
                    signInWithEmail(email, password);
                }
            });
        }
        
        const registerPassword = document.getElementById('registerPassword');
        if (registerPassword) {
            registerPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const email = document.getElementById('registerEmail')?.value.trim() || '';
                    const password = e.target.value;
                    const name = document.getElementById('registerName')?.value.trim() || '';
                    const phone = document.getElementById('registerPhone')?.value.trim() || '';
                    signUpWithEmail(email, password, name, phone);
                }
            });
            
            registerPassword.addEventListener('input', (e) => {
                const password = e.target.value;
                if (password.length > 0) {
                    const strength = validatePasswordStrength(password);
                    const passwordHint = document.getElementById('passwordHint');
                    if (passwordHint) {
                        if (strength.isValid) {
                            passwordHint.innerHTML = '✅ كلمة المرور قوية ومطابقة للمتطلبات';
                            passwordHint.style.color = '#4CAF50';
                        } else {
                            passwordHint.innerHTML = '⚠️ ' + strength.missingRequirements.join('<br>⚠️ ');
                            passwordHint.style.color = '#ff9800';
                        }
                    }
                }
            });
        }
        
        const resetEmailInput = document.getElementById('resetEmailInput');
        if (resetEmailInput) {
            resetEmailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendPasswordReset(e.target.value.trim());
                }
            });
        }
        
        log('✅ تم إعداد جميع المستمعين', 'success');
    }

    // ======================== تصدير الدوال العامة ========================
    
    window.AuthModule = {
        signInWithGoogle,
        signInAsGuest,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        logout,
        showEmailAuthForm,
        showLoginForm,
        showRegistrationForm,
        showResetPasswordForm,
        hideAllForms,
        getPasswordRequirementsMessage,
        validatePasswordStrength
    };
    
    window.signOutAndRedirect = logout;
    window.resetPassword = (email) => sendPasswordReset(email);

    // ======================== بدء التطبيق ========================
    
    async function init() {
        log('🚀 بدء تهيئة نظام المصادقة (النسخة المحسنة النهائية v3.1.1)...', 'info');
        
        setupEventListeners();
        
        setTimeout(() => {
            const loader = document.getElementById('initialLoader');
            if (loader && loader.style.display !== 'none') {
                log('⚠️ إخفاء شاشة التحميل (خطة طوارئ)', 'warning');
                hideLoader();
            }
        }, 5000);
        
        await checkAuthState();
        
        log('✅ نظام المصادقة جاهز', 'success');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();