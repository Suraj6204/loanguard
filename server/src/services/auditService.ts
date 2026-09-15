import { AuditLog } from '../models/AuditLog';
import { AuditAction, EntityType } from '../types';
import { Types } from 'mongoose';

interface AuditLogInput {
  actorId: string;
  actorRole: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await AuditLog.create({
        actorId: new Types.ObjectId(input.actorId),
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ? new Types.ObjectId(input.entityId) : undefined,
        previousState: input.previousState,
        newState: input.newState,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    } catch (error) {
      // Audit logging should never break the primary operation
      console.error('Audit log failed:', error);
    }
  }

  async getByEntity(entityId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find({ entityId: new Types.ObjectId(entityId) })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      AuditLog.countDocuments({ entityId: new Types.ObjectId(entityId) }),
    ]);
    return { logs, total };
  }

  async getAll(
    filters: { action?: AuditAction; entityType?: EntityType; actorId?: string },
    page = 1,
    limit = 20
  ) {
    const query: Record<string, unknown> = {};
    if (filters.action) query.action = filters.action;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.actorId) query.actorId = new Types.ObjectId(filters.actorId);

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    return { logs, total };
  }

  async getTimeline(loanId: string) {
    const logs = await AuditLog.find({
      entityId: new Types.ObjectId(loanId),
      entityType: { $in: [EntityType.LOAN_APPLICATION, EntityType.PAYMENT] },
    })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email role')
      .lean();

    // Also fetch payment-related audit logs for this loan
    const paymentLogs = await AuditLog.find({
      'metadata.loanId': loanId,
      action: AuditAction.PAYMENT_RECORDED,
    })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email role')
      .lean();

    // Merge and sort by date
    const allLogs = [...logs, ...paymentLogs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return allLogs;
  }
}

export const auditService = new AuditService();
