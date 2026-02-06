import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";
import { User } from "../models/User.js";
import { Op } from "sequelize";

export async function getRecentActivities(req, res) {
    try {
        const limit = 10;

        // 1. Fetch recent assignments (Trip Created)
        const recentAssignments = await Trip.findAll({
            order: [['created_at', 'DESC']],
            limit: limit,
            include: [{ model: User, attributes: ['name'] }]
        });

        // 2. Fetch recent completions (Trip Completed)
        const recentCompletions = await Trip.findAll({
            where: { 
                current_phase: { [Op.or]: ["COMPLETED", "FINALIZED"] }, 
                actual_end_time: { [Op.ne]: null } 
            },
            order: [['actual_end_time', 'DESC']],
            limit: limit,
            include: [{ model: User, attributes: ['name'] }]
        });

        // 3. Fetch recent alerts (Logs with type 'ALERT')
        const recentAlerts = await Log.findAll({
            where: { type: "ALERT" },
            order: [['created_at', 'DESC']],
            limit: limit,
            include: [{ 
                model: Trip, 
                include: [{ model: User, attributes: ['name'] }] 
            }]
        });

        // 4. Normalize
        const activities = [];

        recentAssignments.forEach(trip => {
            const assignmentId = trip.task_title || `#${trip.id}`;
            activities.push({
                id: `assign-${trip.id}`,
                type: 'ASSIGNMENT',
                title: 'New Assignment',
                description: `Assignment ${assignmentId} assigned to ${trip.User?.name || 'Unknown'}`,
                timestamp: trip.createdAt,
                meta: { tripId: trip.id }
            });
        });

        recentCompletions.forEach(trip => {
            const assignmentId = trip.task_title || `#${trip.id}`;
            activities.push({
                id: `complete-${trip.id}`,
                type: 'COMPLETION',
                title: 'Assignment Completed',
                description: `Assignment ${assignmentId} completed by ${trip.User?.name || 'Unknown'}`,
                timestamp: trip.actual_end_time,
                meta: { tripId: trip.id }
            });
        });

        recentAlerts.forEach(log => {
            activities.push({
                id: `alert-${log.id}`,
                type: 'ALERT',
                title: 'Safety Alert',
                description: log.message,
                timestamp: log.createdAt,
                meta: { tripId: log.trip_id, user: log.Trip?.User?.name }
            });
        });

        // 5. Sort and Slice
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const finalActivities = activities.slice(0, 10);

        res.json(finalActivities);

    } catch (error) {
        console.error("Error fetching recent activities:", error);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
}
