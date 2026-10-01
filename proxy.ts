import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  // 1. جلب جلسة التسجيل من كوكيز NextAuth
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // 2. مستخدم غير مسجل يحاول دخول صفحة محمية -> صفحة تسجيل الدخول
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    // الاحتفاظ بالمسار الذي حاول دخوله للرجوع إليه بعد التسجيل
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. صفحات الإدارة للأدمن فقط
  if (pathname.startsWith("/admin")) {
    if (token.role !== "admin") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  // 4. كل دور يدخل داشبورده فقط (والأدمن يذهب للوحة الإدارة)
  if (token.role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (pathname.startsWith("/dashboard/creator") && token.role === "client") {
    return NextResponse.redirect(new URL("/dashboard/client", request.url));
  }
  if (pathname.startsWith("/dashboard/client") && token.role === "creator") {
    return NextResponse.redirect(new URL("/dashboard/creator", request.url));
  }

  return NextResponse.next();
}

// 5. تحديد المسارات التي تنطبق عليها الحماية فقط
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
