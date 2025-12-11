import type { NextApiRequest, NextApiResponse } from 'next';

// This is a placeholder API route for saving events
// You'll need to implement the actual backend logic to persist to your database

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { id } = req.query;

    if (req.method === 'GET') {
        // Fetch event by ID from database
        // For now, return 404 as this should be implemented in your backend
        return res.status(404).json({
            message: 'Event not found. Backend implementation needed.'
        });
    }

    if (req.method === 'PUT') {
        // Update event in database
        const { canvasData, canvasAssets } = req.body;

        console.log('=== Save Event Request ===');
        console.log('Event ID:', id);
        console.log('Canvas Data:', JSON.stringify(canvasData).substring(0, 200) + '...');
        console.log('Canvas Assets count:', canvasAssets?.length);
        console.log('=========================');

        // TODO: Implement actual database save
        // For now, just acknowledge the save request
        // The data is already being persisted to localStorage via Zustand

        return res.status(200).json({
            message: 'Event saved (localStorage only - backend DB not connected)',
            eventId: id,
            savedAt: new Date().toISOString(),
        });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}
