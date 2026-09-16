import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { LoanApplication } from '../models/LoanApplication';
import { Payment } from '../models/Payment';
import { LoanStatus } from '../types';

export const getSalesLeads = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as any) || 1;
    const limit = parseInt(req.query.limit as any) || 20;
    const skip = (page - 1) * limit;

    // Get borrowers who registered
    const [users, total] = await Promise.all([
      User.find({ role: 'Borrower' })
        .select('name email profileCompleted createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ role: 'Borrower' }),
    ]);

    // Enrich with application status
    const userIds = users.map((u) => u._id);
    const applications = await LoanApplication.find({
      borrowerId: { $in: userIds },
    })
      .select('borrowerId status')
      .lean();

    const appMap = new Map<string, string>();
    applications.forEach((app) => {
      appMap.set(app.borrowerId.toString(), app.status);
    });

    // Get document uploads for these users
    const documents = await mongoose.model('Document').find({
      uploadedBy: { $in: userIds },
    }).select('uploadedBy').lean() as unknown as { uploadedBy: any }[];
    const docSet = new Set(documents.map((d) => d.uploadedBy.toString()));

    const enrichedUsers = users.map((user) => {
      const appStatus = appMap.get(user._id.toString());
      let finalStatus = 'NOT_STARTED';
      if (appStatus) {
        finalStatus = appStatus;
      } else if (user.profileCompleted) {
        if (docSet.has(user._id.toString())) {
          finalStatus = 'DOCUMENT_UPLOADED';
        } else {
          finalStatus = 'PENDING_DOCUMENT';
        }
      }
      return {
        ...user,
        applicationStatus: finalStatus,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Success',
      data: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get sales leads error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    // 1. Get dashboard stats
    const [
      totalApplications,
      applied,
      sanctioned,
      rejected,
      disbursed,
      closed,
    ] = await Promise.all([
      LoanApplication.countDocuments(),
      LoanApplication.countDocuments({ status: LoanStatus.APPLIED }),
      LoanApplication.countDocuments({ status: LoanStatus.SANCTIONED }),
      LoanApplication.countDocuments({ status: LoanStatus.REJECTED }),
      LoanApplication.countDocuments({ status: LoanStatus.DISBURSED }),
      LoanApplication.countDocuments({ status: LoanStatus.CLOSED }),
    ]);

    const outstandingAgg = await LoanApplication.aggregate([
      { $match: { status: LoanStatus.DISBURSED } },
      { $group: { _id: null, totalOutstanding: { $sum: '$outstandingAmount' } } },
    ]);

    const stats = {
      totalApplications,
      applied,
      sanctioned,
      rejected,
      disbursed,
      closed,
      totalOutstanding: outstandingAgg[0]?.totalOutstanding || 0,
    };

    // 2. Get recent payments
    const recentPayments = await Payment.find()
      .populate('recordedBy', 'name email role')
      .populate('loanId', 'principal totalRepayment status borrowerId')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 3. User stats
    const totalBorrowers = await User.countDocuments({ role: 'Borrower' });
    const profileCompletedBorrowers = await User.countDocuments({
      role: 'Borrower',
      profileCompleted: true,
    });

    res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        stats,
        recentPayments,
        totalBorrowers,
        profileCompletedBorrowers,
      },
    });
  } catch (error: any) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};
