#!/usr/bin/env python3
"""
Health check script for BookReader AI backend in production
"""

import sys
import requests
import os
from urllib.parse import urljoin


def check_health():
    """Check if the application is healthy"""
    try:
        # Check main health endpoint
        response = requests.get(
            "http://localhost:8000/health",
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"Health check failed: HTTP {response.status_code}")
            return False
            
        # Check database connectivity
        db_response = requests.get(
            "http://localhost:8000/health/db",
            timeout=15
        )
        
        if db_response.status_code != 200:
            print(f"Database health check failed: HTTP {db_response.status_code}")
            return False
            
        print("Health check passed")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Health check failed with exception: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error during health check: {e}")
        return False


if __name__ == "__main__":
    if check_health():
        sys.exit(0)
    else:
        sys.exit(1)