import { createLogger } from '../logger';

const logger = createLogger('merchant-onboarding');

export interface MerchantApplication {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  averageTransactions: number;
  currentPOS: string;
  integrationType: 'api' | 'plugin' | 'manual';
  status: 'pending' | 'approved' | 'rejected' | 'active';
  submittedAt: string;
  approvedAt?: string;
  apiKey?: string;
  webhookUrl?: string;
  settings: {
    customBranding: boolean;
    rewardMultiplier: number;
    specialItems: string[];
    notificationPreferences: {
      customerEngagement: boolean;
      analytics: boolean;
      systemUpdates: boolean;
    };
  };
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  estimatedTime: string;
}

class MerchantOnboardingService {
  private applications = new Map<string, MerchantApplication>();
  private onboardingSteps: OnboardingStep[] = [
    {
      id: 'business-info',
      title: 'Business Information',
      description: 'Provide basic business details and contact information',
      completed: false,
      required: true,
      estimatedTime: '3 minutes'
    },
    {
      id: 'pos-integration',
      title: 'POS Integration',
      description: 'Choose your integration method and configure settings',
      completed: false,
      required: true,
      estimatedTime: '10 minutes'
    },
    {
      id: 'testing',
      title: 'Test Transaction',
      description: 'Process a test receipt to verify integration',
      completed: false,
      required: true,
      estimatedTime: '5 minutes'
    },
    {
      id: 'branding',
      title: 'Custom Branding',
      description: 'Upload logos and customize receipt appearance',
      completed: false,
      required: false,
      estimatedTime: '5 minutes'
    },
    {
      id: 'rewards-setup',
      title: 'Rewards Configuration',
      description: 'Set up special items and bonus point rules',
      completed: false,
      required: false,
      estimatedTime: '10 minutes'
    },
    {
      id: 'go-live',
      title: 'Go Live',
      description: 'Activate your account and start accepting BlockReceipts',
      completed: false,
      required: true,
      estimatedTime: '2 minutes'
    }
  ];

  constructor() {
    this.initializeSampleApplications();
  }

  private initializeSampleApplications() {
    const sampleApplication: MerchantApplication = {
      id: 'merchant_001',
      businessName: 'Downtown Coffee Co.',
      contactName: 'Sarah Johnson',
      email: 'sarah@downtowncoffee.com',
      phone: '+1-555-0123',
      businessType: 'cafe',
      averageTransactions: 150,
      currentPOS: 'Square',
      integrationType: 'api',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      settings: {
        customBranding: true,
        rewardMultiplier: 1.2,
        specialItems: ['Specialty Latte', 'Breakfast Sandwich'],
        notificationPreferences: {
          customerEngagement: true,
          analytics: true,
          systemUpdates: false
        }
      }
    };

    this.applications.set(sampleApplication.id, sampleApplication);
    logger.info('[onboarding] Sample merchant application initialized');
  }

  /**
   * Submit a new merchant application
   */
  async submitApplication(applicationData: Omit<MerchantApplication, 'id' | 'submittedAt' | 'status'>): Promise<MerchantApplication> {
    const application: MerchantApplication = {
      ...applicationData,
      id: `merchant_${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    this.applications.set(application.id, application);
    
    logger.info(`[onboarding] New application submitted: ${application.businessName} (${application.id})`);
    
    // Auto-approve for demo purposes
    setTimeout(() => {
      this.approveApplication(application.id);
    }, 2000);

    return application;
  }

  /**
   * Get all applications with optional status filter
   */
  getApplications(status?: MerchantApplication['status']): MerchantApplication[] {
    const applications = Array.from(this.applications.values());
    
    if (status) {
      return applications.filter(app => app.status === status);
    }
    
    return applications.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  /**
   * Get specific application
   */
  getApplication(merchantId: string): MerchantApplication | undefined {
    return this.applications.get(merchantId);
  }

  /**
   * Approve merchant application
   */
  async approveApplication(merchantId: string): Promise<boolean> {
    const application = this.applications.get(merchantId);
    
    if (!application) {
      logger.warn(`[onboarding] Application not found: ${merchantId}`);
      return false;
    }

    application.status = 'approved';
    application.approvedAt = new Date().toISOString();
    application.apiKey = this.generateApiKey();
    application.webhookUrl = `https://api.blockreceipt.ai/webhook/${merchantId}`;

    logger.info(`[onboarding] Application approved: ${application.businessName} (${merchantId})`);
    
    return true;
  }

  /**
   * Activate merchant account after onboarding completion
   */
  async activateMerchant(merchantId: string): Promise<boolean> {
    const application = this.applications.get(merchantId);
    
    if (!application || application.status !== 'approved') {
      logger.warn(`[onboarding] Cannot activate merchant: ${merchantId}`);
      return false;
    }

    // Check if required onboarding steps are completed
    const requiredSteps = this.onboardingSteps.filter(step => step.required);
    const completedRequiredSteps = requiredSteps.filter(step => step.completed);
    
    if (completedRequiredSteps.length < requiredSteps.length) {
      logger.warn(`[onboarding] Onboarding incomplete for merchant: ${merchantId}`);
      return false;
    }

    application.status = 'active';
    
    logger.info(`[onboarding] Merchant activated: ${application.businessName} (${merchantId})`);
    
    return true;
  }

  /**
   * Get onboarding progress for merchant
   */
  getOnboardingProgress(merchantId: string): {
    steps: OnboardingStep[];
    completedSteps: number;
    totalSteps: number;
    requiredSteps: number;
    completedRequiredSteps: number;
    canActivate: boolean;
  } {
    const totalSteps = this.onboardingSteps.length;
    const completedSteps = this.onboardingSteps.filter(step => step.completed).length;
    const requiredSteps = this.onboardingSteps.filter(step => step.required).length;
    const completedRequiredSteps = this.onboardingSteps.filter(step => step.required && step.completed).length;
    
    return {
      steps: this.onboardingSteps,
      completedSteps,
      totalSteps,
      requiredSteps,
      completedRequiredSteps,
      canActivate: completedRequiredSteps === requiredSteps
    };
  }

  /**
   * Complete an onboarding step
   */
  completeOnboardingStep(merchantId: string, stepId: string): boolean {
    const application = this.applications.get(merchantId);
    
    if (!application) {
      logger.warn(`[onboarding] Merchant not found: ${merchantId}`);
      return false;
    }

    const step = this.onboardingSteps.find(s => s.id === stepId);
    
    if (!step) {
      logger.warn(`[onboarding] Step not found: ${stepId}`);
      return false;
    }

    step.completed = true;
    
    logger.info(`[onboarding] Step completed: ${stepId} for ${merchantId}`);
    
    return true;
  }

  /**
   * Generate API key for merchant
   */
  private generateApiKey(): string {
    const prefix = 'br_live_';
    const randomPart = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
    return prefix + randomPart;
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): MerchantApplication | null {
    for (const application of this.applications.values()) {
      if (application.apiKey === apiKey && application.status === 'active') {
        return application;
      }
    }
    return null;
  }

  /**
   * Get merchant analytics data
   */
  getMerchantAnalytics(merchantId: string): {
    totalReceipts: number;
    totalCustomers: number;
    averageTransactionValue: number;
    rewardPointsIssued: number;
    customerEngagementRate: number;
    topProducts: Array<{ name: string; count: number }>;
    monthlyGrowth: number;
  } {
    // Mock analytics data for demo
    return {
      totalReceipts: Math.floor(Math.random() * 1000) + 500,
      totalCustomers: Math.floor(Math.random() * 500) + 200,
      averageTransactionValue: Math.random() * 50 + 15,
      rewardPointsIssued: Math.floor(Math.random() * 10000) + 5000,
      customerEngagementRate: Math.random() * 0.4 + 0.3, // 30-70%
      topProducts: [
        { name: 'Specialty Latte', count: Math.floor(Math.random() * 100) + 50 },
        { name: 'Breakfast Sandwich', count: Math.floor(Math.random() * 80) + 30 },
        { name: 'Chocolate Donut', count: Math.floor(Math.random() * 60) + 20 }
      ],
      monthlyGrowth: Math.random() * 0.3 + 0.05 // 5-35% growth
    };
  }
}

export const merchantOnboardingService = new MerchantOnboardingService();