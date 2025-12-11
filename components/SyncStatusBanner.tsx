import { useAutoSave } from '@/hooks/useAutoSave';

export default function SyncStatusBanner() {
    const { isOnline } = useAutoSave();

    // ONLY show banner when offline
    if (isOnline) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
            <div className="max-w-7xl mx-auto px-4 pt-2">
                <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 justify-center text-sm font-medium pointer-events-auto">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    </svg>
                    <span>You're offline. Changes will sync when you reconnect to the internet.</span>
                </div>
            </div>
        </div>
    );
}
