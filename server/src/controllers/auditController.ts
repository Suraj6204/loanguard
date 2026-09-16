import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';

// ------------------------------------------------------------------
// ROUTE HANDLERS
// ------------------------------------------------------------------

export const getAll = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filters: any = {};
    if (req.query.action) filters.action = req.query.action as any;
    if (req.query.entityType) filters.entityType = req.query.entityType as any;
    if (req.query.actorId) filters.actorId = new Types.ObjectId(req.query.actorId as any);

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      AuditLog.countDocuments(filters),
    ]);

    res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get all audits error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};
