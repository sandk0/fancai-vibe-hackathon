#!/usr/bin/env python3
"""
Emergency NLP Rollback Utility для fancai.

Управление canary deployment новой Multi-NLP архитектуры через CLI.

Usage:
    # Emergency rollback to 0% (disable new architecture completely)
    python scripts/nlp_rollback.py --stage 0

    # Rollback to 25%
    python scripts/nlp_rollback.py --stage 2

    # Advance to next stage
    python scripts/nlp_rollback.py --advance

    # Check current status
    python scripts/nlp_rollback.py --status

    # Show rollout history
    python scripts/nlp_rollback.py --history

    # Clear user cohort cache
    python scripts/nlp_rollback.py --clear-cache

Examples:
    # Emergency full rollback (all users to old architecture)
    python scripts/nlp_rollback.py --stage 0 --admin "admin@example.com"

    # Gradual rollout: advance from 5% to 25%
    python scripts/nlp_rollback.py --advance --admin "admin@example.com"

    # Check current deployment status
    python scripts/nlp_rollback.py --status

Exit codes:
    0 - Success
    1 - General error
    2 - Invalid arguments
    3 - Database error
"""

import asyncio
import sys
import argparse
import logging
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_database_session
from app.services.nlp_canary import NLPCanaryDeployment, STAGE_PERCENTAGES, RolloutStage
from app.services.feature_flag_manager import FeatureFlagManager


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Color codes for terminal output
class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


def print_colored(text: str, color: str = Colors.RESET, bold: bool = False):
    """Print colored text to terminal."""
    if bold:
        print(f"{Colors.BOLD}{color}{text}{Colors.RESET}")
    else:
        print(f"{color}{text}{Colors.RESET}")


async def rollback_to_stage(
    stage: int,
    admin_email: Optional[str] = None
) -> int:
    """
    Rollback to specified stage.

    Args:
        stage: Target stage (0-4)
        admin_email: Email of admin performing rollback

    Returns:
        Exit code (0 for success, 3 for error)
    """
    try:
        async for db in get_database_session():
            flag_manager = FeatureFlagManager(db)
            await flag_manager.initialize()

            canary = NLPCanaryDeployment(flag_manager, db)
            await canary.initialize()

            print_colored(f"\n🔄 Rolling back to stage {stage}...", Colors.YELLOW, bold=True)

            result = await canary.rollback_to_stage(stage, admin_email=admin_email)

            print_colored("\n✅ Rollback complete!", Colors.GREEN, bold=True)
            print_colored(f"  Old stage: {result['old_stage']} ({result['old_percentage']}%)", Colors.CYAN)
            print_colored(f"  New stage: {result['new_stage']} ({result['new_percentage']}%)", Colors.CYAN)
            print_colored(f"  Admin: {result['admin'] or 'unknown'}", Colors.CYAN)
            print_colored(f"  Timestamp: {result['timestamp']}", Colors.CYAN)

            return 0

    except ValueError as e:
        print_colored(f"\n❌ Invalid stage: {e}", Colors.RED, bold=True)
        return 2
    except Exception as e:
        print_colored(f"\n❌ Rollback failed: {e}", Colors.RED, bold=True)
        logger.exception("Rollback failed")
        return 3


async def advance_stage(admin_email: Optional[str] = None) -> int:
    """
    Advance to next stage.

    Args:
        admin_email: Email of admin performing advance

    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        async for db in get_database_session():
            flag_manager = FeatureFlagManager(db)
            await flag_manager.initialize()

            canary = NLPCanaryDeployment(flag_manager, db)
            await canary.initialize()

            print_colored(f"\n⬆️  Advancing to next stage...", Colors.YELLOW, bold=True)

            result = await canary.advance_stage(admin_email=admin_email)

            print_colored("\n✅ Advanced successfully!", Colors.GREEN, bold=True)
            print_colored(f"  Old stage: {result['old_stage']} ({result['old_percentage']}%)", Colors.CYAN)
            print_colored(f"  New stage: {result['new_stage']} ({result['new_percentage']}%)", Colors.CYAN)
            print_colored(f"  Admin: {result['admin'] or 'unknown'}", Colors.CYAN)
            print_colored(f"  Timestamp: {result['timestamp']}", Colors.CYAN)

            return 0

    except ValueError as e:
        print_colored(f"\n❌ Cannot advance: {e}", Colors.RED, bold=True)
        return 1
    except Exception as e:
        print_colored(f"\n❌ Advance failed: {e}", Colors.RED, bold=True)
        logger.exception("Advance failed")
        return 3


async def show_status() -> int:
    """
    Show current canary status.

    Returns:
        Exit code (0 for success, 3 for error)
    """
    try:
        async for db in get_database_session():
            flag_manager = FeatureFlagManager(db)
            await flag_manager.initialize()

            canary = NLPCanaryDeployment(flag_manager, db)
            await canary.initialize()

            status = await canary.get_status()
            metrics = await canary.get_cohort_metrics()

            print_colored("\n📊 NLP Canary Deployment Status", Colors.BLUE, bold=True)
            print_colored("=" * 60, Colors.BLUE)

            # Current stage
            print_colored("\n🎯 Current Stage:", Colors.MAGENTA, bold=True)
            print_colored(f"  Stage: {status['stage']} ({status['stage_name']})", Colors.CYAN)
            print_colored(f"  Rollout: {status['percentage']}%", Colors.CYAN)

            # User distribution
            print_colored("\n👥 User Distribution:", Colors.MAGENTA, bold=True)
            print_colored(f"  Total users: {status['total_users']}", Colors.CYAN)
            print_colored(
                f"  New architecture: {status['estimated_users_new_arch']} "
                f"({status['percentage']}%)",
                Colors.GREEN
            )
            print_colored(
                f"  Old architecture: {status['estimated_users_old_arch']} "
                f"({100 - status['percentage']}%)",
                Colors.YELLOW
            )

            # Cache
            print_colored("\n💾 Cache:", Colors.MAGENTA, bold=True)
            print_colored(f"  Cached cohort assignments: {status['cache_size']}", Colors.CYAN)

            # Last update
            print_colored("\n🕐 Last Update:", Colors.MAGENTA, bold=True)
            print_colored(f"  Timestamp: {status['last_updated']}", Colors.CYAN)
            print_colored(f"  Updated by: {status['updated_by'] or 'unknown'}", Colors.CYAN)
            if status['notes']:
                print_colored(f"  Notes: {status['notes']}", Colors.CYAN)

            # Feature flag status
            print_colored("\n🚩 Feature Flag:", Colors.MAGENTA, bold=True)
            flag_status = "ENABLED" if status['feature_flag_enabled'] else "DISABLED"
            flag_color = Colors.GREEN if status['feature_flag_enabled'] else Colors.RED
            print_colored(f"  USE_NEW_NLP_ARCHITECTURE: {flag_status}", flag_color)

            # Quality metrics
            print_colored("\n📈 Quality Metrics:", Colors.MAGENTA, bold=True)

            old_metrics = metrics['old_architecture']
            print_colored("\n  Old Architecture (Legacy):", Colors.YELLOW)
            print_colored(f"    F1 Score: {old_metrics['f1_score']:.2f}", Colors.CYAN)
            print_colored(f"    Precision: {old_metrics['precision']:.2f}", Colors.CYAN)
            print_colored(f"    Recall: {old_metrics['recall']:.2f}", Colors.CYAN)
            print_colored(f"    Avg Quality: {old_metrics['avg_quality_score']:.1f}/10", Colors.CYAN)
            print_colored(f"    Avg Time: {old_metrics['avg_processing_time_ms']}ms", Colors.CYAN)
            print_colored(f"    Error Rate: {old_metrics['error_rate']:.1%}", Colors.CYAN)

            new_metrics = metrics['new_architecture']
            print_colored("\n  New Architecture (Multi-NLP v2.0):", Colors.GREEN)
            print_colored(f"    F1 Score: {new_metrics['f1_score']:.2f}", Colors.CYAN)
            print_colored(f"    Precision: {new_metrics['precision']:.2f}", Colors.CYAN)
            print_colored(f"    Recall: {new_metrics['recall']:.2f}", Colors.CYAN)
            print_colored(f"    Avg Quality: {new_metrics['avg_quality_score']:.1f}/10", Colors.CYAN)
            print_colored(f"    Avg Time: {new_metrics['avg_processing_time_ms']}ms", Colors.CYAN)
            print_colored(f"    Error Rate: {new_metrics['error_rate']:.1%}", Colors.CYAN)

            # Recommendations
            print_colored("\n💡 Recommendations:", Colors.MAGENTA, bold=True)
            if status['percentage'] < 100:
                improvement = (
                    (new_metrics['f1_score'] - old_metrics['f1_score'])
                    / old_metrics['f1_score'] * 100
                )
                if improvement > 5:
                    print_colored(
                        f"  ✅ New architecture shows {improvement:.1f}% improvement in F1 score",
                        Colors.GREEN
                    )
                    print_colored(
                        "  ✅ Safe to advance to next stage",
                        Colors.GREEN
                    )
                else:
                    print_colored(
                        f"  ⚠️  Improvement is only {improvement:.1f}%. Monitor closely.",
                        Colors.YELLOW
                    )
            else:
                print_colored(
                    "  ✅ Full rollout (100%) - new architecture in production",
                    Colors.GREEN
                )

            print_colored("\n" + "=" * 60, Colors.BLUE)

            return 0

    except Exception as e:
        print_colored(f"\n❌ Failed to get status: {e}", Colors.RED, bold=True)
        logger.exception("Status check failed")
        return 3


async def show_history(limit: int = 10) -> int:
    """
    Show rollout history.

    Args:
        limit: Maximum number of records to show

    Returns:
        Exit code (0 for success, 3 for error)
    """
    try:
        async for db in get_database_session():
            flag_manager = FeatureFlagManager(db)
            await flag_manager.initialize()

            canary = NLPCanaryDeployment(flag_manager, db)
            await canary.initialize()

            history = await canary.get_rollout_history(limit=limit)

            print_colored(f"\n📜 NLP Canary Rollout History (last {len(history)} changes)", Colors.BLUE, bold=True)
            print_colored("=" * 80, Colors.BLUE)

            for i, entry in enumerate(history, 1):
                is_rollback = "ROLLBACK" in (entry['notes'] or "").upper()
                color = Colors.RED if is_rollback else Colors.GREEN

                print_colored(f"\n{i}. Stage {entry['stage']} ({entry['percentage']}%)", color, bold=True)
                print_colored(f"   Timestamp: {entry['updated_at']}", Colors.CYAN)
                print_colored(f"   Updated by: {entry['updated_by'] or 'unknown'}", Colors.CYAN)
                if entry['notes']:
                    print_colored(f"   Notes: {entry['notes']}", Colors.CYAN)

            print_colored("\n" + "=" * 80, Colors.BLUE)

            return 0

    except Exception as e:
        print_colored(f"\n❌ Failed to get history: {e}", Colors.RED, bold=True)
        logger.exception("History retrieval failed")
        return 3


async def clear_cache() -> int:
    """
    Clear canary cohort cache.

    Returns:
        Exit code (0 for success, 3 for error)
    """
    try:
        async for db in get_database_session():
            flag_manager = FeatureFlagManager(db)
            await flag_manager.initialize()

            canary = NLPCanaryDeployment(flag_manager, db)
            await canary.initialize()

            cache_size = len(canary.user_cohorts)
            canary.clear_cache()

            print_colored("\n🧹 Cache cleared successfully!", Colors.GREEN, bold=True)
            print_colored(f"  Removed {cache_size} cached cohort assignments", Colors.CYAN)

            return 0

    except Exception as e:
        print_colored(f"\n❌ Failed to clear cache: {e}", Colors.RED, bold=True)
        logger.exception("Cache clear failed")
        return 3


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Emergency NLP Rollback Utility for fancai",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Emergency rollback to 0% (disable new architecture)
  python scripts/nlp_rollback.py --stage 0 --admin admin@example.com

  # Rollback to 25%
  python scripts/nlp_rollback.py --stage 2

  # Advance to next stage
  python scripts/nlp_rollback.py --advance --admin admin@example.com

  # Check current status
  python scripts/nlp_rollback.py --status

  # Show rollout history
  python scripts/nlp_rollback.py --history

  # Clear user cohort cache
  python scripts/nlp_rollback.py --clear-cache

Stage mapping:
  0: 0%   - Disabled
  1: 5%   - Early testing
  2: 25%  - Expanded testing
  3: 50%  - Half rollout
  4: 100% - Full rollout
        """
    )

    # Action arguments (mutually exclusive)
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument(
        '--stage',
        type=int,
        choices=[0, 1, 2, 3, 4],
        help='Rollback to specified stage (0-4)'
    )
    action_group.add_argument(
        '--advance',
        action='store_true',
        help='Advance to next stage'
    )
    action_group.add_argument(
        '--status',
        action='store_true',
        help='Show current canary status'
    )
    action_group.add_argument(
        '--history',
        action='store_true',
        help='Show rollout history'
    )
    action_group.add_argument(
        '--clear-cache',
        action='store_true',
        help='Clear user cohort cache'
    )

    # Optional arguments
    parser.add_argument(
        '--admin',
        type=str,
        help='Email of admin performing operation'
    )
    parser.add_argument(
        '--history-limit',
        type=int,
        default=10,
        help='Number of history records to show (default: 10)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Execute action
    try:
        if args.stage is not None:
            exit_code = asyncio.run(rollback_to_stage(args.stage, args.admin))
        elif args.advance:
            exit_code = asyncio.run(advance_stage(args.admin))
        elif args.status:
            exit_code = asyncio.run(show_status())
        elif args.history:
            exit_code = asyncio.run(show_history(args.history_limit))
        elif args.clear_cache:
            exit_code = asyncio.run(clear_cache())
        else:
            parser.print_help()
            exit_code = 2

        sys.exit(exit_code)

    except KeyboardInterrupt:
        print_colored("\n\n⚠️  Operation cancelled by user", Colors.YELLOW, bold=True)
        sys.exit(130)
    except Exception as e:
        print_colored(f"\n❌ Unexpected error: {e}", Colors.RED, bold=True)
        logger.exception("Unexpected error")
        sys.exit(1)


if __name__ == "__main__":
    main()
