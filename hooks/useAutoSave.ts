import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
                    toast.success("Back online — changes saved", { id: "autosave-offline" });
                }).catch((error) => {
                    setPendingSave(true);
                    toast.error(`Auto-save failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: "autosave-error", duration: 4000 });
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
    }, [pendingSave, id, slug, saveEvent]);

    // Auto-save at intervals (silently)
    useEffect(() => {
        if (!enabled || !id || typeof id !== 'string' || !slug || typeof slug !== 'string') return;

        const autoSaveInterval = setInterval(async () => {
            if (hasUnsavedChanges && !isSaving) {
                if (isOnline) {
                    try {
                        await saveEvent(id, slug);
                    } catch (error) {
                        setPendingSave(true);
                        toast.error(`Auto-save failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: "autosave-error", duration: 4000 });
                    }
                } else {
                    setPendingSave(true);
                    toast("You're offline — changes will auto-save when you reconnect", { id: "autosave-offline", duration: 4000 });
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
