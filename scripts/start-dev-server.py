#!/usr/bin/env python3
"""Start the NetQuest dev server (port 3015) as a detached daemon.

The double-fork + setsid detaches the process from the launching shell so it
keeps running after the terminal/agent exits. Logs go to /tmp/netquest-dev.log.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

pid = os.fork()
if pid > 0:
    sys.exit(0)
os.setsid()
pid = os.fork()
if pid > 0:
    sys.exit(0)

os.chdir(ROOT)
# Next.js does not let .env files override vars already exported in the shell.
# Purge any stale/empty SUPABASE vars so the values in .env.local always win.
for name in [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]:
    os.environ.pop(name, None)
fd = os.open("/tmp/netquest-dev.log", os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
os.dup2(fd, 1)
os.dup2(fd, 2)
os.execvp("npx", ["npx", "next", "dev", "--port", "3015"])
