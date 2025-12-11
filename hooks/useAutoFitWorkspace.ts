import { useProjectStore } from '@/store/projectStore';
import { fitWorkspaceToContainer } from '@/utils/workspaceBounds';

/**
 * Hook to automatically fit workspace to container dimensions
 */
export function useAutoFitWorkspace(
    containerWidth: number,
    containerHeight: number,
    enabled: boolean = true
): {
    zoom: number;
    panX: number;
    panY: number;
} {
    const { walls, shapes, assets } = useProjectStore();

    if (!enabled) {
        return { zoom: 1, panX: 0, panY: 0 };
    }

    return fitWorkspaceToContainer(walls, shapes, assets, containerWidth, containerHeight, 50);
}
