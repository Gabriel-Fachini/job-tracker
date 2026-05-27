#!/bin/bash
# Kill orphan dev servers Claude may have spawned during session.
# User manages port 3000 manually; only cleanup if leftover.
pkill -f "next dev" 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
exit 0
