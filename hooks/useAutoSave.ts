import { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useRouter } from 'next/router';

interface UseAutoSaveOptions {
    interval?: number; // milliseconds
    enabled?: boolean;
}

export function useAutoSave({ interval = 30000, enabled = true }: UseAutoSaveOptions = {}) {
    const router = useRouter();
    const { id, slug } = router.query;
    const [isOnline, setIsOnline] = useState(true);
    const [pendingSave, setPendingSave] = useState(false);

    const hasUnsavedChanges = useProjectStore((s) => s.hasUnsavedChanges);
    const saveEvent = useProjectStore((s) => s.saveEvent);
    const isSaving = useProjectStore((s) => s.isSaving);

    // Monitor online/offline status (silently)
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (pendingSave && id && typeof id === 'string' && slug && typeof slug === "string") {
                saveEvent(id, slug).then(() => {
                    setPendingSave(false);
                }).catch(() => {
                    // Silent fail
                });
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [pendingSave, id, saveEvent]);

    // Auto-save at intervals (silently)
    useEffect(() => {
        if (!enabled || !id || typeof id !== 'string' || !slug || typeof slug !== 'string') return;

        const autoSaveInterval = setInterval(async () => {
            if (hasUnsavedChanges && !isSaving) {
                if (isOnline) {
                    try {
                        await saveEvent(id, slug);
                    } catch (error) {
                        // Silent fail
                        setPendingSave(true);
                    }
                } else {
                    setPendingSave(true);
                }
            }
        }, interval);

        return () => clearInterval(autoSaveInterval);
    }, [enabled, id, hasUnsavedChanges, isSaving, isOnline, interval, saveEvent]);

    return {
        isOnline,
        isSaving,
        hasUnsavedChanges,
        pendingSave,
    };
}
