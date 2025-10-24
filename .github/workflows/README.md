# GitHub Actions CI/CD Workflows

This directory contains automated workflows for continuous integration and deployment.

## Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

**Jobs:**

#### Backend Jobs
- **backend-lint**: Code quality checks (Ruff, Black, MyPy)
- **backend-tests**: Run pytest with coverage, upload to Codecov

#### Frontend Jobs
- **frontend-lint**: ESLint and TypeScript type checking
- **frontend-tests**: Run Vitest tests and build

#### Security Jobs
- **security-scan**: Trivy vulnerability scanner + TruffleHog secret detection

#### Build Jobs
- **docker-build**: Test Docker image builds (PR only)

#### Summary
- **all-checks-passed**: Final status check (required for merge)

**Status Badge:**
```markdown
![CI Status](https://github.com/YOUR-USERNAME/fancai-vibe-hackathon/workflows/CI%2FCD%20Pipeline/badge.svg)
```

### 2. Deployment Pipeline (`deploy.yml`)

**Triggers:**
- Git tags matching `v*.*.*` (e.g., v1.0.0)
- Manual workflow dispatch

**Jobs:**

1. **build-and-push**: Build and push Docker images to GitHub Container Registry
2. **deploy-staging**: Deploy to staging environment (manual trigger)
3. **deploy-production**: Deploy to production (tag trigger or manual)

**Features:**
- Automated database backup before production deployment
- Health checks after deployment
- Automatic rollback on failure
- Zero-downtime deployment strategy

## Setup Instructions

### 1. Required GitHub Secrets

Navigate to: **Settings → Secrets and variables → Actions → New repository secret**

#### Production Secrets
```
PROD_SSH_KEY          # SSH private key for deployment
PROD_HOST             # Production server IP/hostname
PROD_USER             # SSH username (e.g., deploy)
```

#### Staging Secrets (Optional)
```
STAGING_SSH_KEY       # SSH private key for staging
STAGING_HOST          # Staging server IP/hostname
STAGING_USER          # SSH username
```

#### Optional Secrets
```
CODECOV_TOKEN         # For code coverage uploads (get from codecov.io)
SLACK_WEBHOOK_URL     # For deployment notifications
```

### 2. Generate SSH Key for Deployment

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -f github-actions-deploy -C "github-actions@bookreader"

# Copy private key to GitHub secret PROD_SSH_KEY
cat github-actions-deploy

# Add public key to production server
ssh user@prod-server
echo "PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Prepare Production Server

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repository
git clone https://github.com/YOUR-USERNAME/fancai-vibe-hackathon.git /opt/bookreader
cd /opt/bookreader

# Setup environment
cp .env.example .env.production
nano .env.production  # Configure production settings

# Ensure backup script is executable
chmod +x scripts/backup.sh
```

### 4. Enable GitHub Container Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Images will be pushed to:
# ghcr.io/YOUR-USERNAME/fancai-vibe-hackathon-backend:latest
# ghcr.io/YOUR-USERNAME/fancai-vibe-hackathon-frontend:latest
```

## Usage

### Running Tests Locally

Before pushing, run tests locally:

```bash
# Backend tests
cd backend
pytest -v --cov=app

# Frontend tests
cd frontend
npm test

# Linting
cd backend && ruff check . && black --check .
cd frontend && npm run lint
```

### Triggering Deployments

#### Production Deployment (via tag)
```bash
# Create and push a version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# This will trigger:
# 1. Build Docker images
# 2. Push to registry
# 3. Deploy to production
# 4. Run health checks
```

#### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Select environment (staging/production)
5. Click **Run workflow** button

### Monitoring Workflow Status

#### Via GitHub UI
- Navigate to **Actions** tab
- Click on workflow run to see details
- Expand jobs to see logs

#### Via GitHub CLI
```bash
# Install GitHub CLI
brew install gh  # macOS
# or: https://cli.github.com/

# List workflow runs
gh run list --workflow=ci.yml

# Watch specific run
gh run watch RUN_ID

# View logs
gh run view RUN_ID --log
```

## Workflow Customization

### Adjusting Test Timeouts

Edit `ci.yml`:
```yaml
- name: Run tests with coverage
  timeout-minutes: 30  # Increase if tests take longer
```

### Adding Notification Steps

Example Slack notification:
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Changing Docker Registry

To use Docker Hub instead of GitHub Container Registry:

```yaml
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    tags: username/bookreader-backend:latest
```

## Troubleshooting

### Common Issues

#### 1. Tests Failing in CI but Passing Locally

**Cause:** Environment differences (Python/Node versions, dependencies)

**Solution:**
- Check workflow Python/Node versions match local
- Ensure all test dependencies in requirements.txt/package.json
- Run tests in clean environment: `docker-compose run --rm backend pytest`

#### 2. SSH Connection Failed

**Cause:** Incorrect SSH key or server configuration

**Solution:**
```bash
# Test SSH connection manually
ssh -i github-actions-deploy user@server

# Check authorized_keys on server
cat ~/.ssh/authorized_keys

# Verify SSH key in GitHub secrets matches
```

#### 3. Docker Build Timeout

**Cause:** Large dependencies or slow build steps

**Solution:**
- Increase timeout in workflow
- Optimize Dockerfile (better layer caching)
- Use `cache-from` and `cache-to` options

#### 4. Health Check Failing After Deployment

**Cause:** Application not starting correctly

**Solution:**
```bash
# SSH to server and check logs
ssh user@prod-server
cd /opt/bookreader
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps
```

### Viewing Detailed Logs

```bash
# Enable debug logging in workflow
# Add to workflow file:
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Security Best Practices

1. **Never commit secrets** to workflow files
2. **Use environment protection rules** for production
3. **Require approvals** for production deployments
4. **Limit secret access** to specific workflows
5. **Rotate SSH keys** regularly
6. **Review workflow changes** in pull requests

### Setting Up Environment Protection

1. Go to **Settings → Environments**
2. Create `production` environment
3. Add protection rules:
   - Required reviewers (1-6 people)
   - Wait timer (e.g., 5 minutes)
   - Deployment branches (only `main`)

## Performance Tips

### Speed Up CI

1. **Cache dependencies:**
   - Python: `cache: 'pip'`
   - Node: `cache: 'npm'`

2. **Run jobs in parallel** (already configured)

3. **Use matrix builds** for multiple Python/Node versions:
```yaml
strategy:
  matrix:
    python-version: ['3.10', '3.11']
```

4. **Skip CI for docs-only changes:**
```bash
git commit -m "docs: update README [skip ci]"
```

### Speed Up Builds

1. **Docker layer caching** (already enabled)
2. **Multi-stage builds** (use in Dockerfile.prod)
3. **Smaller base images** (alpine variants)

## Monitoring & Alerts

### Codecov Integration

1. Sign up at [codecov.io](https://codecov.io)
2. Add repository
3. Get token and add to GitHub secrets as `CODECOV_TOKEN`
4. Coverage reports uploaded automatically

### Status Checks

GitHub status checks prevent merging if:
- ❌ Tests fail
- ❌ Linting errors
- ❌ Security vulnerabilities found
- ❌ Build fails

Configure in **Settings → Branches → main → Require status checks**

## Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Codecov GitHub Action](https://github.com/codecov/codecov-action)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy-action)

---

**Questions or Issues?**
Open an issue or contact the DevOps team.
