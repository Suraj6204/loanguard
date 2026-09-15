import { breService } from './services/breService';
import { calculateSimpleInterest, calculateTotalRepayment, calculateAge } from './utils/helpers';
import { isValidTransition } from './constants';
import { EmploymentMode, LoanStatus, UserRole } from './types';

describe('1. Business Rule Engine (BRE) Tests', () => {
  const validApplicant = {
    dateOfBirth: new Date(Date.now() - 30 * 365.25 * 24 * 60 * 60 * 1000),
    monthlySalary: 50000,
    pan: 'ABCDE1234F',
    employmentMode: EmploymentMode.SALARIED,
  };

  test('should pass eligible applicant', () => {
    const result = breService.evaluate(validApplicant);
    expect(result.eligible).toBe(true);
    expect(result.reasons.every((r) => r.passed)).toBe(true);
  });

  test('should fail when age < 23', () => {
    const youngApplicant = {
      ...validApplicant,
      dateOfBirth: new Date(Date.now() - 20 * 365.25 * 24 * 60 * 60 * 1000),
    };
    const result = breService.evaluate(youngApplicant);
    expect(result.eligible).toBe(false);
    const ageReason = result.reasons.find((r) => r.rule === 'AGE_CHECK');
    expect(ageReason?.passed).toBe(false);
  });

  test('should fail when age > 50', () => {
    const oldApplicant = {
      ...validApplicant,
      dateOfBirth: new Date(Date.now() - 55 * 365.25 * 24 * 60 * 60 * 1000),
    };
    const result = breService.evaluate(oldApplicant);
    expect(result.eligible).toBe(false);
    const ageReason = result.reasons.find((r) => r.rule === 'AGE_CHECK');
    expect(ageReason?.passed).toBe(false);
  });

  test('should fail when salary < ₹25,000', () => {
    const lowSalaryApplicant = {
      ...validApplicant,
      monthlySalary: 20000,
    };
    const result = breService.evaluate(lowSalaryApplicant);
    expect(result.eligible).toBe(false);
    const salaryReason = result.reasons.find((r) => r.rule === 'MIN_SALARY');
    expect(salaryReason?.passed).toBe(false);
  });

  test('should fail when PAN format is invalid', () => {
    const invalidPanApplicant = {
      ...validApplicant,
      pan: 'INVALID123',
    };
    const result = breService.evaluate(invalidPanApplicant);
    expect(result.eligible).toBe(false);
    const panReason = result.reasons.find((r) => r.rule === 'PAN_VALID');
    expect(panReason?.passed).toBe(false);
  });

  test('should fail when applicant is UNEMPLOYED', () => {
    const unemployedApplicant = {
      ...validApplicant,
      employmentMode: EmploymentMode.UNEMPLOYED,
    };
    const result = breService.evaluate(unemployedApplicant);
    expect(result.eligible).toBe(false);
    const empReason = result.reasons.find((r) => r.rule === 'EMPLOYMENT_MODE');
    expect(empReason?.passed).toBe(false);
  });
});

describe('2. Loan Financial Math & Helpers Tests', () => {
  test('should calculate simple interest correctly (SI = P * R * T / 36500)', () => {
    const principal = 100000;
    const rate = 12;
    const tenureDays = 365;
    const interest = calculateSimpleInterest(principal, rate, tenureDays);
    expect(interest).toBe(12000);
  });

  test('should calculate total repayment correctly', () => {
    const total = calculateTotalRepayment(100000, 12000);
    expect(total).toBe(112000);
  });

  test('should calculate age correctly from date of birth', () => {
    const dob = new Date('1995-05-15');
    const age = calculateAge(dob);
    expect(age).toBeGreaterThanOrEqual(30);
  });
});

describe('3. Loan State Machine Invariant Tests', () => {
  test('should allow APPLIED -> SANCTIONED by SANCTION or ADMIN role', () => {
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.SANCTIONED, UserRole.SANCTION)).toBe(true);
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.SANCTIONED, UserRole.ADMIN)).toBe(true);
  });

  test('should reject APPLIED -> SANCTIONED by BORROWER or COLLECTION role', () => {
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.SANCTIONED, UserRole.BORROWER)).toBe(false);
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.SANCTIONED, UserRole.COLLECTION)).toBe(false);
  });

  test('should reject invalid illegal lifecycle jumps (e.g. APPLIED -> DISBURSED)', () => {
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.DISBURSED, UserRole.ADMIN)).toBe(false);
    expect(isValidTransition(LoanStatus.APPLIED, LoanStatus.CLOSED, UserRole.ADMIN)).toBe(false);
    expect(isValidTransition(LoanStatus.REJECTED, LoanStatus.DISBURSED, UserRole.ADMIN)).toBe(false);
    expect(isValidTransition(LoanStatus.CLOSED, LoanStatus.DISBURSED, UserRole.ADMIN)).toBe(false);
  });

  test('should allow SANCTIONED -> DISBURSED by DISBURSEMENT or ADMIN role', () => {
    expect(isValidTransition(LoanStatus.SANCTIONED, LoanStatus.DISBURSED, UserRole.DISBURSEMENT)).toBe(true);
    expect(isValidTransition(LoanStatus.SANCTIONED, LoanStatus.DISBURSED, UserRole.SANCTION)).toBe(false);
  });

  test('should allow DISBURSED -> CLOSED by COLLECTION or ADMIN role', () => {
    expect(isValidTransition(LoanStatus.DISBURSED, LoanStatus.CLOSED, UserRole.COLLECTION)).toBe(true);
    expect(isValidTransition(LoanStatus.DISBURSED, LoanStatus.CLOSED, UserRole.BORROWER)).toBe(false);
  });
});
