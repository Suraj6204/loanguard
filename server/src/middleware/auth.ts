import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { IAuthPayload, UserRole } from '../types';
import { sendError } from '../utils/response';
import { auditService } from '../services/auditService';
import { AuditAction, EntityType } from '../types';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401, 'UNAUTHENTICATED');
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as IAuthPayload;
    req.user = decoded;
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHENTICATED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Audit the authorization failure
      try {
        await auditService.log({
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: AuditAction.AUTHORIZATION_DENIED,
          entityType: EntityType.USER,
          metadata: {
            attemptedRoute: req.originalUrl,
            method: req.method,
            requiredRoles: allowedRoles,
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      } catch {
        // Don't block the response if audit logging fails
      }

      sendError(
        res,
        'You do not have permission to perform this action',
        403,
        'FORBIDDEN',
        { requiredRoles: allowedRoles, userRole: req.user.role }
      );
      return;
    }

    next();
  };
}
