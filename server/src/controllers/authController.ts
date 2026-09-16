import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { env } from '../config/env';
import { UserRole, AuditAction, EntityType } from '../types';

const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = UserRole.BORROWER } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Check existing
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered', code: 'CONFLICT' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
    });

    // Generate token
    const token = generateToken(user._id.toString(), user.role);

    // Audit
    await AuditLog.create({
      actorId: new Types.ObjectId(user._id.toString()),
      actorRole: user.role,
      action: AuditAction.REGISTER,
      entityType: EntityType.USER,
      entityId: new Types.ObjectId(user._id.toString()),
      newState: { name: user.name, email: user.email, role: user.role },
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileCompleted: user.profileCompleted,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials', code: 'UNAUTHORIZED' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await AuditLog.create({
        actorId: new Types.ObjectId(user._id.toString()),
        actorRole: user.role,
        action: AuditAction.LOGIN,
        entityType: EntityType.USER,
        entityId: new Types.ObjectId(user._id.toString()),
        metadata: { status: 'FAILED' },
        ipAddress,
        userAgent,
      });
      res.status(401).json({ success: false, message: 'Invalid credentials', code: 'UNAUTHORIZED' });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);

    await AuditLog.create({
      actorId: new Types.ObjectId(user._id.toString()),
      actorRole: user.role,
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: new Types.ObjectId(user._id.toString()),
      metadata: { status: 'SUCCESS' },
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileCompleted: user.profileCompleted,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          pan: user.pan,
          dateOfBirth: user.dateOfBirth,
          monthlySalary: user.monthlySalary,
          employmentMode: user.employmentMode,
          role: user.role,
          profileCompleted: user.profileCompleted,
        },
      },
    });
  } catch (error: any) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};
