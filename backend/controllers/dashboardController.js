import { Trip } from "../models/Trip.js";
import { Log } from "../models/Log.js";
import { User } from "../models/User.js";
import { Op } from "sequelize";

export async function getRecentActivities(req, res) {
    try {
        const limit = 10;

        // Recent assignment creations
        const recentAssignments = await Trip.findAll({
            order: [['created_at', 'DESC']],
            limit,
            include: [{ model: User, attributes: ['name'] }]
        });

        // Recent status changes (any phase change we log)
        const statusLogs = await Log.findAll({
            where: { type: "STATUS" },
            order: [['created_at', 'DESC']],
            limit,
            include: [{
                model: Trip,
                include: [{ model: User, attributes: ['name'] }]
            }]
        });

        // Recent alerts (SOS / safety)
        const recentAlerts = await Log.findAll({
            where: { type: "ALERT" },
            order: [['created_at', 'DESC']],
            limit,
            include: [{ 
                model: Trip, 
                include: [{ model: User, attributes: ['name'] }] 
            }]
        });

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

        statusLogs.forEach(log => {
            const trip = log.Trip;
            const assignmentId = trip?.task_title || `#${trip?.id || log.assignment_id}`;
            activities.push({
                id: `status-${log.id}`,
                type: 'STATUS',
                title: 'Assignment Status',
                description: log.message,
                timestamp: log.createdAt,
                meta: { tripId: log.assignment_id, user: trip?.User?.name }
            });
        });

        recentAlerts.forEach(log => {
            activities.push({
                id: `alert-${log.id}`,
                type: 'ALERT',
                title: 'Safety Alert',
                description: log.message,
                timestamp: log.createdAt,
                meta: { tripId: log.assignment_id, user: log.Trip?.User?.name }
            });
        });

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const finalActivities = activities.slice(0, limit);

        res.json(finalActivities);

    } catch (error) {
        console.error("Error fetching recent activities:", error);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
}
