import { useState } from "react";
import { useLocation, Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LogOut, ChevronLeft, Trash2, Lock, Eye, EyeOff, FileText, ShieldCheck
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { toast } from "sonner";

export default function Settings() {
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("تم تسجيل الخروج بنجاح");
      setLocation("/login");
    } catch {
      toast.error("فشل تسجيل الخروج");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (!user?.email) return;
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("تم تغيير كلمة المرور بنجاح");
      setShowChangePassword(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      const msg = err.code === "auth/wrong-password" ? "كلمة المرور الحالية غير صحيحة" : "فشل تغيير كلمة المرور";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("هل أنت متأكد من حذف حسابك؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
    if (!user) return;
    try {
      await deleteUser(user);
      toast.success("تم حذف الحساب بنجاح");
      setLocation("/");
    } catch (err: any) {
      toast.error("يرجى إعادة تسجيل الدخول أولاً قبل حذف الحساب");
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Georgia, serif' }}>الإعدادات</h1>

          {/* Account security */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="w-5 h-5 text-primary" /> الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user && (
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">الحساب الحالي</p>
                  <p className="text-sm font-medium text-foreground">{user.email}</p>
                </div>
              )}

              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">تغيير كلمة المرور</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>

              {showChangePassword && (
                <form onSubmit={handleChangePassword} className="space-y-3 p-3 bg-secondary/20 rounded-lg">
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      placeholder="كلمة المرور الحالية"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pr-9 pl-9 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute left-3 top-1/2 -translate-y-1/2">
                      {showCurrentPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showNewPw ? "text" : "password"}
                      placeholder="كلمة المرور الجديدة"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pr-9 pl-9 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute left-3 top-1/2 -translate-y-1/2">
                      {showNewPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="تأكيد كلمة المرور الجديدة"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 bg-primary text-primary-foreground h-9 text-sm" disabled={loading}>
                      {loading ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={() => setShowChangePassword(false)}>
                      إلغاء
                    </Button>
                  </div>
                </form>
              )}

              <Separator />

              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">حذف الحساب</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>

          {/* Legal */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-primary" /> القانونية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link href="/privacy-policy">
                <a className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">سياسة الخصوصية</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </a>
              </Link>
              <Separator />
              <Link href="/terms">
                <a className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">الشروط والأحكام</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </a>
              </Link>
            </CardContent>
          </Card>

          {/* Logout */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-white gap-2 font-semibold rounded-lg"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </Button>

          <p className="text-center text-xs text-muted-foreground pb-4">
            Eleven Store — النسخة 1.0.0
          </p>
        </div>
      </div>
    </Layout>
  );
}
