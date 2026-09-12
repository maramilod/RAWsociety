import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 1. جلب التوكين أو جلسة التسجيل من الكوكيز (حسب مكتبة المصادقة المستخدمة)
  const token = request.cookies.get("auth_token")?.value;

  // 2. التحقق مما إذا كان المستخدم يحاول الوصول إلى مسار محمي وهو غير مسجل
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute && !token) {
    // إعادة توجيه المستخدم لصفحة تسجيل الدخول إذا لم يملك توكين
    const loginUrl = new URL("/login", request.url);
    // الاحتفاظ بالمسار الذي حاول دخوله للرجوع إليه بعد التسجيل
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// 3. تحديد المسارات التي تنطبق عليها الحماية فقط
export const config = {
  matcher: ["/dashboard/:path*"],
};