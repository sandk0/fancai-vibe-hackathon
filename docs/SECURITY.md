# Security Guidelines - BookReader AI

**Last Updated:** 2025-10-30
**Security Incident:** P0-1 (Hardcoded Credentials) - **RESOLVED**

---

## 🚨 Critical Security Fixes (2025-10-30)

### Issue: P0-1 - Hardcoded Credentials

**Status:** ✅ **RESOLVED**

**Summary:**
Two critical hardcoded passwords were found in the codebase that blocked production deployment:

1. **Admin Password:** `backend/scripts/create_admin.py:23` - hardcoded "Tre21bgU"
2. **Test User Password:** `backend/create_test_user.py:24` - hardcoded "testpassword123"
3. **Weak Credentials in Git:** `.env.development` committed with postgres123, redis123

**Resolution:**
- Commit: `777d5ee` - security(critical): remove hardcoded credentials
- All scripts now use environment variables
- `.env.development` removed from git tracking
- `.gitignore` updated to prevent future incidents

---

## Environment Variable Management

### ✅ DO's

1. **Always use environment variables for secrets:**
   ```bash
   # Good
   ADMIN_PASSWORD=your_secure_password python create_admin.py

   # Bad (never hardcode!)
   password = "mypassword123"  # ❌ NEVER DO THIS
   ```

2. **Use strong passwords (minimum 12 characters):**
   ```bash
   # Generate secure passwords
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

3. **Copy `.env.example` for local development:**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your local credentials
   ```

4. **Keep `.env.*` files out of git:**
   ```bash
   # Already in .gitignore
   .env
   .env.development
   .env.production
   .env.test
   ```

### ❌ DON'Ts

1. **Never commit real credentials to git**
2. **Never hardcode passwords in source code**
3. **Never use weak passwords (password, admin, 12345678, etc.)**
4. **Never run test scripts in production environment**

---

## Script Security

### 1. Create Admin Script

**File:** `backend/scripts/create_admin.py`

**Security Features:**
- ✅ Requires `ADMIN_PASSWORD` environment variable
- ✅ Password strength validation (min 12 chars)
- ✅ Weak password detection
- ✅ No password printed in output
- ✅ Secure password generation suggestions

**Usage:**
```bash
# Secure way (recommended)
ADMIN_EMAIL=admin@yourdomain.com \
ADMIN_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))") \
python backend/scripts/create_admin.py

# Or set in .env.development
echo "ADMIN_EMAIL=admin@yourdomain.com" >> .env.development
echo "ADMIN_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" >> .env.development
python backend/scripts/create_admin.py
```

### 2. Create Test User Script

**File:** `backend/create_test_user.py`

**Security Features:**
- ✅ Blocks execution in production (`ENVIRONMENT=production`)
- ✅ Uses `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env vars
- ✅ Auto-generates secure password if not provided
- ✅ Clear security warnings

**Usage:**
```bash
# Development only (auto-generates password)
ENVIRONMENT=development python backend/create_test_user.py

# With custom credentials
ENVIRONMENT=development \
TEST_USER_EMAIL=test@example.com \
TEST_USER_PASSWORD=my_test_password \
python backend/create_test_user.py
```

**⚠️ Production Check:**
```bash
# This will FAIL (by design)
ENVIRONMENT=production python backend/create_test_user.py
# Output: 🚨 КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ!
```

---

## Password Requirements

### Minimum Requirements
- **Length:** Minimum 12 characters
- **Strength:** Use cryptographically secure random generation
- **Uniqueness:** Different passwords for different services

### Weak Password Detection
Scripts automatically detect and reject common weak passwords:
- `password`
- `admin`
- `12345678`
- `qwerty`
- `admin123`

### Password Generation

**Method 1: Python secrets module (recommended)**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: kX7mN2pQ9vR8sT3uV4wX5yZ6aB7cD8eF9gH0iJ1kL2mN3oP4
```

**Method 2: OpenSSL**
```bash
openssl rand -base64 32
```

**Method 3: Password managers**
- 1Password
- LastPass
- Bitwarden

---

## .env File Security

### .env.example
- ✅ Safe to commit to git
- ✅ Contains placeholder values
- ✅ Documents required variables

### .env.development
- ❌ Never commit to git
- ✅ Copy from .env.example
- ✅ Use for local development only
- ✅ Contains real credentials

### .env.production
- ❌ Never commit to git
- ❌ Never store in codebase
- ✅ Use secrets management (Vault, AWS Secrets Manager)
- ✅ Strong passwords only

---

## Production Deployment

### Pre-deployment Security Checklist

- [ ] No hardcoded credentials in code
- [ ] All `.env.*` files in `.gitignore`
- [ ] Strong passwords (min 32 chars for production)
- [ ] Secrets stored in secure vault (not in files)
- [ ] Test scripts disabled in production
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Database backups automated

### Environment Variables for Production

```bash
# Generate strong production secrets
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
export JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
export DB_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
export REDIS_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
export ADMIN_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
```

**Store these in:**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

**Never in:**
- Git repository
- Dockerfile
- docker-compose.yml
- CI/CD logs

---

## Incident Response

### If Credentials Are Leaked

1. **Immediate Actions:**
   ```bash
   # Rotate ALL affected credentials immediately
   # Change database passwords
   # Change API keys
   # Change admin passwords
   ```

2. **Git History Cleanup:**
   ```bash
   # Remove sensitive data from git history (use with caution!)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.development" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push (if absolutely necessary)
   git push origin --force --all
   ```

3. **Notify Team:**
   - Security team
   - DevOps team
   - Management

4. **Post-Incident:**
   - Document incident
   - Update security procedures
   - Implement additional safeguards

---

## Security Scanning

### Pre-commit Hooks
```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Scan for secrets
pre-commit run detect-secrets --all-files
```

### Manual Scanning
```bash
# Scan for hardcoded secrets
grep -r "password.*=" backend/ --include="*.py" | grep -v "password_hash"

# Check for committed .env files
git ls-files | grep "\.env"
```

---

## Contact

**Security Issues:**
- Email: security@bookreader.ai (when available)
- Create private issue in GitHub
- Contact DevOps team directly

**Non-Security Issues:**
- Use public GitHub issues
- Team Slack channel

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Python Secrets Module](https://docs.python.org/3/library/secrets.html)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Git Secrets Prevention](https://github.com/awslabs/git-secrets)

---

**Document Version:** 1.0
**Last Audit:** 2025-10-30
**Next Review:** 2025-11-30
