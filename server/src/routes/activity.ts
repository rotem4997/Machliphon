import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/activity/feed - real-time activity feed
router.get('/feed', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const authorityId = req.user!.authority_id;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    // Combine recent assignments, absences, and notifications into unified feed
    const result = await query(`
      (
        SELECT
          'assignment' as event_type,
          a.id,
          a.status,
          a.created_at as event_time,
          json_build_object(
            'kindergarten', k.name,
            'substitute', u_sub.first_name || ' ' || u_sub.last_name,
            'date', a.assignment_date,
            'assignedBy', u_mgr.first_name || ' ' || u_mgr.last_name
          ) as details
        FROM assignments a
        JOIN kindergartens k ON a.kindergarten_id = k.id
        JOIN substitutes s ON a.substitute_id = s.id
        JOIN users u_sub ON s.user_id = u_sub.id
        JOIN users u_mgr ON a.assigned_by = u_mgr.id
        WHERE k.authority_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT
          'absence' as event_type,
          ar.id,
          ar.status,
          ar.created_at as event_time,
          json_build_object(
            'kindergarten', k.name,
            'employee', ar.absent_employee_name,
            'reason', ar.absence_reason,
            'date', ar.absence_date
          ) as details
        FROM absence_reports ar
        JOIN kindergartens k ON ar.kindergarten_id = k.id
        WHERE k.authority_id = $1
        ORDER BY ar.created_at DESC
        LIMIT $2
      )
      ORDER BY event_time DESC
      LIMIT $2
    `, [authorityId, limit]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Activity feed error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// GET /api/activity/live-stats - real-time stats for live dashboard
router.get('/live-stats', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const authorityId = req.user!.authority_id;
    const today = new Date().toISOString().split('T')[0];

    const [assignmentsToday, absencesToday, availableSubs, recentActivity] = await Promise.all([
      // Today's assignments by status
      query(`
        SELECT status, COUNT(*) as count
        FROM assignments a
        JOIN kindergartens k ON a.kindergarten_id = k.id
        WHERE k.authority_id = $1 AND a.assignment_date = $2
        GROUP BY status
      `, [authorityId, today]),

      // Today's absences by status
      query(`
        SELECT status, COUNT(*) as count
        FROM absence_reports ar
        JOIN kindergartens k ON ar.kindergarten_id = k.id
        WHERE k.authority_id = $1 AND ar.absence_date = $2
        GROUP BY status
      `, [authorityId, today]),

      // Available substitutes count for today
      query(`
        SELECT COUNT(*) as count
        FROM substitutes s
        WHERE s.authority_id = $1
          AND s.status = 'active'
          AND s.work_permit_valid = true
          AND s.id NOT IN (
            SELECT substitute_id FROM assignments
            WHERE assignment_date = $2 AND status NOT IN ('cancelled')
          )
          AND s.id NOT IN (
            SELECT substitute_id FROM substitute_availability
            WHERE date = $2 AND is_available = false
          )
      `, [authorityId, today]),

      // Last 5 activities (timestamp for "last update" indicator)
      query(`
        SELECT MAX(created_at) as last_activity FROM (
          SELECT created_at FROM assignments a
          JOIN kindergartens k ON a.kindergarten_id = k.id
          WHERE k.authority_id = $1
          UNION ALL
          SELECT created_at FROM absence_reports ar
          JOIN kindergartens k ON ar.kindergarten_id = k.id
          WHERE k.authority_id = $1
        ) combined
      `, [authorityId]),
    ]);

    const assignmentsByStatus: Record<string, number> = {};
    assignmentsToday.rows.forEach(r => { assignmentsByStatus[r.status] = parseInt(r.count); });

    const absencesByStatus: Record<string, number> = {};
    absencesToday.rows.forEach(r => { absencesByStatus[r.status] = parseInt(r.count); });

    return res.json({
      assignmentsToday: assignmentsByStatus,
      absencesToday: absencesByStatus,
      availableSubstitutes: parseInt(availableSubs.rows[0].count),
      lastActivity: recentActivity.rows[0]?.last_activity || null,
    });
  } catch (error) {
    console.error('Live stats error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
