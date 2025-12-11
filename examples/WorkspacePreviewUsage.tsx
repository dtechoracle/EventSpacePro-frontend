// Example: How to use WorkspacePreview in your dashboard

import WorkspacePreview from '@/components/WorkspacePreview';
import { useProjectStore } from '@/store/projectStore';

function EventCard({ eventId }: { eventId: string }) {
    // Get workspace data (from projectStore or API)
    const { walls, shapes, assets } = useProjectStore();

    return (
        <div className="event-card">
            <h3>Event Preview</h3>

            {/* Auto-cropped workspace preview */}
            <WorkspacePreview
                walls={walls}
                shapes={shapes}
                assets={assets}
                width={400}
                height={300}
                backgroundColor="#f5f5f5"
            />
        </div>
    );
}

export default EventCard;
