#!/usr/bin/env python3
"""
Fix common whitespace and formatting issues in Python files.
"""
import os
import re
from pathlib import Path


def fix_file(filepath: Path) -> tuple[bool, str]:
    """Fix whitespace issues in a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        lines = content.split('\n')
        fixed_lines = []

        for line in lines:
            # Remove trailing whitespace (W291, W293)
            line = line.rstrip()
            fixed_lines.append(line)

        # Ensure file ends with newline (W292)
        if fixed_lines and fixed_lines[-1]:
            fixed_lines.append('')

        new_content = '\n'.join(fixed_lines)

        if new_content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True, "Fixed"
        return False, "No changes"

    except Exception as e:
        return False, f"Error: {e}"


def main():
    """Fix all Python files in app/ directory."""
    app_dir = Path(__file__).parent / 'app'
    fixed_count = 0
    error_count = 0

    for py_file in app_dir.rglob('*.py'):
        changed, msg = fix_file(py_file)
        if changed:
            fixed_count += 1
            print(f"✓ {py_file.relative_to(app_dir)}: {msg}")
        elif "Error" in msg:
            error_count += 1
            print(f"✗ {py_file.relative_to(app_dir)}: {msg}")

    print(f"\n✅ Fixed {fixed_count} files")
    if error_count:
        print(f"❌ {error_count} errors")


if __name__ == '__main__':
    main()
