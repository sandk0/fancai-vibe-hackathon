/**
 * Login Page Object Model
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Selectors
  private readonly emailInput = '[data-testid="login-email"]';
  private readonly passwordInput = '[data-testid="login-password"]';
  private readonly submitButton = '[data-testid="login-submit"]';
  private readonly registerLink = '[data-testid="register-link"]';
  private readonly errorMessage = '[data-testid="login-error"]';
  private readonly forgotPasswordLink = '[data-testid="forgot-password-link"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  /**
   * Perform login
   */
  async login(email: string, password: string): Promise<void> {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
    await this.click(this.submitButton);
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    return await this.getText(this.errorMessage);
  }

  /**
   * Click register link
   */
  async goToRegister(): Promise<void> {
    await this.click(this.registerLink);
  }

  /**
   * Click forgot password link
   */
  async goToForgotPassword(): Promise<void> {
    await this.click(this.forgotPasswordLink);
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible(): Promise<boolean> {
    return await this.isVisible(this.emailInput);
  }
}
