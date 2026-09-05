import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Mail, Lock, Phone, Loader2, Eye, EyeOff } from "lucide-react";
import Layout from "@/components/Layout";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { toast } from "sonner";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { establishServerSession } from "@/lib/session";

export default function Register() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim() || formData.name.length < 3) { setError("الاسم يجب أن يكون 3 أحرف على الأقل"); return; }
    if (!formData.email) { setError("يرجى إدخال البريد الإلكتروني"); return; }
    if (formData.password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (formData.password !== formData.confirmPassword) { setError("كلمتا المرور غير متطابقتين"); return; }
    if (!agreeTerms) { setError("يجب الموافقة على الشروط والأحكام"); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await updateProfile(cred.user, { displayName: formData.name });
      const db = getFirestore();
      await setDoc(doc(db, "users", cred.user.uid), {
        id: cred.user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || "",
        createdAt: serverTimestamp(),
      });
      const idToken = await cred.user.getIdToken();
      await establishServerSession(idToken);
      toast.success("تم إنشاء الحساب بنجاح 🎉");
      setLocation("/");
    } catch (err: any) {
      const msg = err.code === "auth/email-already-in-use" ? "البريد الإلكتروني مستخدم بالفعل"
        : err.code === "auth/invalid-email" ? "البريد الإلكتروني غير صحيح"
        : err.code === "auth/weak-password" ? "كلمة المرور ضعيفة جداً"
        : "فشل إنشاء الحساب، يرجى المحاولة مرة أخرى";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const db = getFirestore();
      await setDoc(doc(db, "users", cred.user.uid), {
        id: cred.user.uid,
        name: cred.user.displayName || "",
        email: cred.user.email || "",
        phone: "",
        avatar: cred.user.photoURL || "",
        createdAt: serverTimestamp(),
      }, { merge: true });
      const idToken = await cred.user.getIdToken();
      await establishServerSession(idToken);
      toast.success("تم إنشاء الحساب بنجاح");
      setLocation("/");
    } catch (err: any) {
      toast.error("فشل التسجيل عبر Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card overflow-hidden shadow-lg">
            <div className="h-1 bg-primary"></div>
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex flex-col items-center gap-2 mb-6">
                  <span className="text-4xl font-bold" style={{ color: 'var(--primary)', fontFamily: 'Georgia, serif' }}>11</span>
                  <span className="text-xs tracking-widest font-bold" style={{ color: 'var(--primary)' }}>ELEVEN</span>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2" style={{ fontFamily: 'Georgia, serif' }}>إنشاء حساب جديد</h1>
                <p className="text-sm text-muted-foreground">انضم إلينا واستمتع بالتسوق المميز</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm font-medium">{error}</div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">الاسم الكامل <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input type="text" name="name" placeholder="أحمد محمد" value={formData.name} onChange={handleChange}
                      className="pr-10 h-11 border-border bg-secondary/30 focus:ring-2 focus:ring-primary rounded-lg" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">البريد الإلكتروني <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input type="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleChange}
                      className="pr-10 h-11 border-border bg-secondary/30 focus:ring-2 focus:ring-primary rounded-lg" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">رقم الهاتف <span className="text-muted-foreground text-xs">(اختياري)</span></label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input type="tel" name="phone" placeholder="+966501234567" value={formData.phone} onChange={handleChange}
                      className="pr-10 h-11 border-border bg-secondary/30 focus:ring-2 focus:ring-primary rounded-lg" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">كلمة المرور <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} name="password" placeholder="••••••••" value={formData.password}
                      onChange={handleChange} className="pr-10 pl-10 h-11 border-border bg-secondary/30 focus:ring-2 focus:ring-primary rounded-lg" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">تأكيد كلمة المرور <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input type={showConfirm ? "text" : "password"} name="confirmPassword" placeholder="••••••••" value={formData.confirmPassword}
                      onChange={handleChange} className="pr-10 pl-10 h-11 border-border bg-secondary/30 focus:ring-2 focus:ring-primary rounded-lg" required />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-secondary/20 rounded-lg border border-border">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={agreeTerms} onCheckedChange={(c) => setAgreeTerms(c as boolean)} className="mt-1" />
                    <span className="text-sm text-foreground leading-relaxed">
                      {/* ✅ إصلاح: كان href="#" (رابط ميت) رغم وجود صفحتين فعليتين موجَّهتين
                          بالفعل بنفس المشروع. فتحهما بتبويب جديد للحفاظ على بيانات نموذج التسجيل. */}
                      أوافق على <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 font-semibold">شروط الاستخدام</a> و<a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 font-semibold">سياسة الخصوصية</a>
                    </span>
                  </label>
                </div>

                <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base rounded-lg" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الإنشاء...</> : "إنشاء الحساب"}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-card text-muted-foreground font-semibold uppercase tracking-wider">أو</span>
                  </div>
                </div>

                <Button type="button" variant="outline" className="w-full h-11 border-border hover:bg-secondary/30 font-semibold gap-3 rounded-lg" onClick={handleGoogleRegister} disabled={loading}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  التسجيل عبر Google
                </Button>

                <p className="text-center text-sm text-muted-foreground mt-4 font-medium">
                  هل لديك حساب بالفعل؟{" "}
                  <a href="/login" className="text-primary font-bold hover:text-primary/80 transition-colors">تسجيل الدخول</a>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
