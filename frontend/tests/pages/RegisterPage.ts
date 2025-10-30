/**
 * Register Page Object Model
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { TestUser } from '../fixtures';

export class RegisterPage extends BasePage {
  // Selectors
  private readonly emailInput = '[data-testid="register-email"]';
  private readonly usernameInput = '[data-testid="register-username"]';
  private readonly passwordInput = '[data-testid="register-password"]';
  private readonly confirmPasswordInput = '[data-testid="register-confirm-password"]';
  private readonly firstNameInput = '[data-testid="register-firstname"]';
  private readonly lastNameInput = '[data-testid="register-lastname"]';
  private readonly submitButton = '[data-testid="register-submit"]';
  private readonly loginLink = '[data-testid="login-link"]';
  private readonly errorMessage = '[data-testid="register-error"]';
  private readonly successMessage = '[data-testid="registration-success"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to register page
   */
  async navigate(): Promise<void> {
    await this.goto('/register');
  }

  /**
   * Perform registration
   */
  async register(user: TestUser): Promise<void> {
    await this.fill(this.emailInput, user.email);
    await this.fill(this.usernameInput, user.username);
    await this.fill(this.passwordInput, user.password);
    await this.fill(this.confirmPasswordInput, user.password);

    if (user.firstName) {
      await this.fill(this.firstNameInput, user.firstName);
    }
    if (user.lastName) {
      await this.fill(this.lastNameInput, user.lastName);
    }

    await this.click(this.submitButton);
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    return await this.getText(this.errorMessage);
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string> {
    return await this.getText(this.successMessage);
  }

  /**
   * Click login link
   */
  async goToLogin(): Promise<void> {
    await this.click(this.loginLink);
  }

  /**
   * Check if success message is visible
   */
  async isSuccessVisible(): Promise<boolean> {
    return await this.isVisible(this.successMessage);
  }
}
