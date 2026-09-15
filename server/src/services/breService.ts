import { IRuleResult, EmploymentMode } from '../types';
import { BRE_THRESHOLDS } from '../constants';
import { calculateAge } from '../utils/helpers';

// ============================================================
// BRE RULE INTERFACE
// ============================================================

interface BRERule {
  ruleName: string;
  evaluate(data: BREInput): IRuleResult;
}

interface BREInput {
  dateOfBirth: Date;
  monthlySalary: number;
  pan: string;
  employmentMode: EmploymentMode;
}

// ============================================================
// INDIVIDUAL RULES
// ============================================================

class AgeRule implements BRERule {
  ruleName = 'AGE_CHECK';

  evaluate(data: BREInput): IRuleResult {
    const age = calculateAge(data.dateOfBirth);
    const passed = age >= BRE_THRESHOLDS.MIN_AGE && age <= BRE_THRESHOLDS.MAX_AGE;
    return {
      rule: this.ruleName,
      passed,
      message: passed
        ? `Age ${age} is within eligible range (${BRE_THRESHOLDS.MIN_AGE}–${BRE_THRESHOLDS.MAX_AGE})`
        : `Age must be between ${BRE_THRESHOLDS.MIN_AGE} and ${BRE_THRESHOLDS.MAX_AGE} years. Current age: ${age}`,
    };
  }
}

class SalaryRule implements BRERule {
  ruleName = 'MIN_SALARY';

  evaluate(data: BREInput): IRuleResult {
    const passed = data.monthlySalary >= BRE_THRESHOLDS.MIN_SALARY;
    return {
      rule: this.ruleName,
      passed,
      message: passed
        ? `Monthly salary ₹${data.monthlySalary.toLocaleString('en-IN')} meets minimum requirement`
        : `Monthly salary must be at least ₹${BRE_THRESHOLDS.MIN_SALARY.toLocaleString('en-IN')}. Current: ₹${data.monthlySalary.toLocaleString('en-IN')}`,
    };
  }
}

class PANRule implements BRERule {
  ruleName = 'PAN_VALID';

  evaluate(data: BREInput): IRuleResult {
    const passed = BRE_THRESHOLDS.PAN_REGEX.test(data.pan);
    return {
      rule: this.ruleName,
      passed,
      message: passed
        ? 'PAN format is valid'
        : 'PAN must match format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)',
    };
  }
}

class EmploymentRule implements BRERule {
  ruleName = 'EMPLOYMENT_MODE';

  evaluate(data: BREInput): IRuleResult {
    const passed = data.employmentMode !== EmploymentMode.UNEMPLOYED;
    return {
      rule: this.ruleName,
      passed,
      message: passed
        ? `Employment mode "${data.employmentMode}" is eligible`
        : 'Unemployed applicants are not eligible for loans',
    };
  }
}

// ============================================================
// BRE SERVICE
// ============================================================

class BREService {
  private rules: BRERule[] = [
    new AgeRule(),
    new SalaryRule(),
    new PANRule(),
    new EmploymentRule(),
  ];

  evaluate(data: BREInput) {
    const results = this.rules.map((rule) => rule.evaluate(data));
    const eligible = results.every((r) => r.passed);

    return {
      eligible,
      reasons: results,
    };
  }
}

export const breService = new BREService();
