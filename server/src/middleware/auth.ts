import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { IAuthPayload } from '../types';
import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';
import { AuditAction, EntityType } from '../types';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as IAuthPayload;

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      try {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        await AuditLog.create({
          actorId: new Types.ObjectId(req.user.userId),
          actorRole: req.user.role,
          action: AuditAction.AUTHORIZATION_DENIED,
          entityType: EntityType.USER,
          entityId: new Types.ObjectId(req.user.userId),
          metadata: {
            requiredRoles: roles,
            attemptedPath: req.originalUrl,
            method: req.method,
          },
          ipAddress,
          userAgent,
        });
      } catch (err) {
        console.error('Failed to log authorization denial:', err);
      }

      res.status(403).json({ success: false, message: `Access denied. Requires one of: ${roles.join(', ')}`, code: 'FORBIDDEN', details: { requiredRoles: roles, userRole: req.user.role } });
      return;
    }

    next();
  };
};
