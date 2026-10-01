import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const authToken = request.cookies.get('authToken')?.value;
    const { pathname } = request.nextUrl;

    // Define protected routes (dashboard pages)
    const isProtectedRoute = pathname.startsWith('/dashboard');

    let isExpired = false;
    if (authToken) {
        try {
            const payload = authToken.split('.')[1];
            if (payload) {
                const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
                const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
                // Next.js middleware supports atob in Edge runtime
                const decoded = JSON.parse(atob(padded));
                if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
                    isExpired = true;
                }
            }
        } catch (e) {
            // Invalid token format
            isExpired = true;
        }
    }

    // If accessing a protected route without token OR with expired token, redirect to login
    if (isProtectedRoute && (!authToken || isExpired)) {
        const loginUrl = new URL('/auth/login', request.url);
        // Add redirect parameter to return user to intended page after login
        loginUrl.searchParams.set('redirect', pathname);
        const response = NextResponse.redirect(loginUrl);
        // Clear the expired cookie
        if (isExpired) {
            response.cookies.delete('authToken');
        }
        return response;
    }

    // Define auth routes (login, signup, etc.)
    const isAuthRoute = pathname.startsWith('/auth');

    // If accessing a protected route without token, redirect to login
    if (isProtectedRoute && !authToken) {
        const loginUrl = new URL('/auth/login', request.url);
        // Add redirect parameter to return user to intended page after login
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
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

