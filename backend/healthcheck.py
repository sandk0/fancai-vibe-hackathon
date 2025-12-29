#!/usr/bin/env python3
"""
Health check script for fancai backend in production.

Optimized for fast checks (5-10 seconds timeout).
Used by Docker, Kubernetes, monitoring systems.
"""

import sys
import urllib.request
import urllib.error
import json


def check_health():
    """
    Check if the application is healthy.

    Performs a quick check of the /health endpoint.
    Does NOT check:
    - Database connectivity (too slow for healthcheck)
    - Redis connectivity (non-critical)
    - NLP models (too slow for healthcheck)

    Returns:
        bool: True if healthy, False otherwise
    """
    try:
        # Check main health endpoint with short timeout (5 seconds)
        req = urllib.request.Request("http://localhost:8000/health")
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.getcode() != 200:
                print(f"Health check failed: HTTP {response.getcode()}", file=sys.stderr)
                return False

            data = response.read().decode('utf-8')
            try:
                health_data = json.loads(data)
                if health_data.get('status') == 'healthy':
                    # Silent success (no output for successful checks)
                    return True
                else:
                    print(f"Backend unhealthy: {health_data.get('status')}", file=sys.stderr)
                    return False
            except json.JSONDecodeError:
                # If response is not JSON, but we got 200 - consider it healthy
                return True

    except urllib.error.HTTPError as e:
        print(f"Health check failed: HTTP {e.code}", file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"Health check failed: {e.reason}", file=sys.stderr)
        return False
    except TimeoutError:
        print("Health check failed: timeout (>5s)", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Health check failed: {type(e).__name__}: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    if check_health():
        sys.exit(0)
    else:
        sys.exit(1)