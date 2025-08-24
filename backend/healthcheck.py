#!/usr/bin/env python3
"""
Health check script for BookReader AI backend in production
"""

import sys
import urllib.request
import urllib.error
import json


def check_health():
    """Check if the application is healthy"""
    try:
        # Check main health endpoint  
        req = urllib.request.Request("http://localhost:8000/health")
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.getcode() != 200:
                print(f"Health check failed: HTTP {response.getcode()}")
                return False
                
            data = response.read().decode('utf-8')
            try:
                health_data = json.loads(data)
                if health_data.get('status') == 'healthy':
                    print("✅ Backend is healthy")
                    return True
                else:
                    print(f"❌ Backend unhealthy: {health_data}")
                    return False
            except json.JSONDecodeError:
                print("✅ Backend is responding")
                return True
        
    except urllib.error.HTTPError as e:
        print(f"❌ Health check failed: HTTP {e.code}")
        return False
    except urllib.error.URLError as e:
        print(f"❌ Health check failed: {e.reason}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during health check: {e}")
        return False


if __name__ == "__main__":
    if check_health():
        sys.exit(0)
    else:
        sys.exit(1)