with open('middleware.ts', 'r', encoding='utf-8') as f:
    c = f.read()

new_mid = """import { NextResponse } from 'next/server';
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
                // Next.js middleware doesn't support atob directly, need to use Buffer
                const decodedStr = Buffer.from(padded, 'base64').toString('utf-8');
                const decoded = JSON.parse(decodedStr);
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
    const isAuthRoute = pathname.startsWith('/auth');"""

idx = c.find("    const isAuthRoute = pathname.startsWith('/auth');")
if idx != -1:
    c = new_mid + c[idx + len("    const isAuthRoute = pathname.startsWith('/auth');"):]
    with open('middleware.ts', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Fixed middleware")
else:
    print("Could not find insertion point")
