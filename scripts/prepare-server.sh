#!/bin/bash
# ============================================
# Server Preparation Script
# ============================================
# Run this script ON THE SERVER as root user
# Usage: bash prepare-server.sh

set -e

echo "🚀 Starting server preparation for BookReader AI..."
echo "Server: $(hostname) - $(hostname -I)"
echo "User: $(whoami)"
echo ""

# ============================================
# 1. System Update
# ============================================
echo "📦 Updating system packages..."
apt update
apt upgrade -y
echo "✅ System updated"
echo ""

# ============================================
# 2. Install Basic Utilities
# ============================================
echo "🔧 Installing basic utilities..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    ufw \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
echo "✅ Basic utilities installed"
echo ""

# ============================================
# 3. Install Docker
# ============================================
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl enable docker
    systemctl start docker

    echo "✅ Docker installed: $(docker --version)"
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# Install Docker Compose (standalone) as fallback
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose standalone..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed: $(docker-compose --version)"
fi
echo ""

# ============================================
# 4. Configure Firewall (UFW)
# ============================================
echo "🔥 Configuring firewall..."

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL - don't lock yourself out!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
ufw --force enable

echo "✅ Firewall configured:"
ufw status verbose
echo ""

# ============================================
# 5. Configure Swap (для 4GB RAM server)
# ============================================
if [ ! -f /swapfile ]; then
    echo "💾 Creating 2GB swap file..."

    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Add to fstab for persistence
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Optimize swap usage
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf

    echo "✅ Swap configured:"
    swapon --show
    free -h
else
    echo "✅ Swap already exists:"
    swapon --show
fi
echo ""

# ============================================
# 6. Set Timezone
# ============================================
echo "🕐 Setting timezone to Europe/Moscow..."
timedatectl set-timezone Europe/Moscow
echo "✅ Timezone: $(timedatectl | grep 'Time zone')"
echo ""

# ============================================
# 7. Set Hostname
# ============================================
echo "🖥️  Setting hostname to fancai-staging..."
hostnamectl set-hostname fancai-staging
echo "✅ Hostname: $(hostname)"
echo ""

# ============================================
# 8. Create Non-Root User (deployer)
# ============================================
if ! id "deployer" &>/dev/null; then
    echo "👤 Creating deployer user..."

    useradd -m -s /bin/bash deployer
    usermod -aG sudo deployer
    usermod -aG docker deployer

    # Copy SSH keys from root
    if [ -d /root/.ssh ]; then
        mkdir -p /home/deployer/.ssh
        cp /root/.ssh/authorized_keys /home/deployer/.ssh/ 2>/dev/null || true
        chown -R deployer:deployer /home/deployer/.ssh
        chmod 700 /home/deployer/.ssh
        chmod 600 /home/deployer/.ssh/authorized_keys 2>/dev/null || true
    fi

    # Allow sudo without password (for automation)
    echo "deployer ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deployer
    chmod 440 /etc/sudoers.d/deployer

    echo "✅ Deployer user created"
else
    echo "✅ Deployer user already exists"
fi
echo ""

# ============================================
# 9. Create Application Directory
# ============================================
echo "📁 Creating application directory..."
mkdir -p /opt/bookreader
chown deployer:deployer /opt/bookreader
echo "✅ Directory created: /opt/bookreader"
echo ""

# ============================================
# 10. Install fail2ban (Security)
# ============================================
if ! command -v fail2ban-client &> /dev/null; then
    echo "🔒 Installing fail2ban..."
    apt install -y fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban
    echo "✅ fail2ban installed and running"
else
    echo "✅ fail2ban already installed"
fi
echo ""

# ============================================
# 11. Setup Automatic Security Updates
# ============================================
echo "🔄 Configuring automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
echo "✅ Automatic updates configured"
echo ""

# ============================================
# Summary
# ============================================
echo "================================================"
echo "✅ Server preparation complete!"
echo "================================================"
echo ""
echo "Server Information:"
echo "  Hostname: $(hostname)"
echo "  IP: $(hostname -I)"
echo "  OS: $(lsb_release -d | cut -f2)"
echo "  Kernel: $(uname -r)"
echo ""
echo "Installed Software:"
echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)"
echo ""
echo "Resources:"
echo "  Memory:"
free -h | grep -E "Mem|Swap"
echo ""
echo "  Disk:"
df -h / | grep -v Filesystem
echo ""
echo "Next Steps:"
echo "  1. Clone repository: cd /opt/bookreader && git clone <repo-url> ."
echo "  2. Configure environment: cp .env.staging.example .env.staging"
echo "  3. Run deployment: ./scripts/deploy-staging.sh"
echo ""
echo "================================================"
