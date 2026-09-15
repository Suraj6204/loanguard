import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';
import { UserRole, AuditAction, EntityType, IAuthPayload } from '../types';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './auditService';

class AuthService {
  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }, ipAddress?: string, userAgent?: string) {
    const { name, email, password, role = UserRole.BORROWER } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
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
    const token = this.generateToken(user._id.toString(), user.role);

    // Audit
    await auditService.log({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: AuditAction.REGISTER,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      newState: { name: user.name, email: user.email, role: user.role },
      ipAddress,
      userAgent,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async login(data: { email: string; password: string }, ipAddress?: string, userAgent?: string) {
    const { email, password } = data;

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Generate token
    const token = this.generateToken(user._id.toString(), user.role);

    // Audit
    await auditService.log({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      ipAddress,
      userAgent,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        pan: user.pan,
        dateOfBirth: user.dateOfBirth,
        monthlySalary: user.monthlySalary,
        employmentMode: user.employmentMode,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  private generateToken(userId: string, role: UserRole): string {
    const payload: IAuthPayload = { userId, role };
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
