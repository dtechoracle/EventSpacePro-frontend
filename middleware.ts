import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const authToken = request.cookies.get('authToken')?.value;
    const { pathname } = request.nextUrl;

    // Define protected routes (dashboard pages)
    const isProtectedRoute = pathname.startsWith('/dashboard');

    // Define auth routes (login, signup, etc.)
    const isAuthRoute = pathname.startsWith('/auth');

    // If accessing a protected route without token, redirect to login
    if (isProtectedRoute && !authToken) {
        const loginUrl = new URL('/auth/login', request.url);
        // Add redirect parameter to return user to intended page after login
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If accessing auth routes with valid token, redirect to dashboard
    if (isAuthRoute && authToken) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Allow the request to proceed
    return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - api routes
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

