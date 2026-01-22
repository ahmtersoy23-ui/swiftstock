#!/bin/bash
# ============================================
# SwiftStock Resource Monitor
# ============================================
# Usage: ./monitor-resources.sh
# or for continuous: watch -n 5 ./monitor-resources.sh

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         SwiftStock WMS - Resource Monitor               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# System Overview
echo "📊 SYSTEM OVERVIEW:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
free -h | grep -E "Mem|Swap"
echo ""

# Docker Containers Status
echo "🐳 DOCKER CONTAINERS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --filter "name=wms-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Resource Usage
echo "💾 RESOURCE USAGE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" \
  wms-postgres wms-redis wms-backend wms-frontend 2>/dev/null || echo "⚠️  Containers not running"
echo ""

# Calculate Total
echo "📈 SWIFTSTOCK TOTAL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get memory usage for each container
POSTGRES_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" wms-postgres 2>/dev/null | awk '{print $1}' | sed 's/MiB//g')
REDIS_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" wms-redis 2>/dev/null | awk '{print $1}' | sed 's/MiB//g')
BACKEND_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" wms-backend 2>/dev/null | awk '{print $1}' | sed 's/MiB//g')
FRONTEND_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" wms-frontend 2>/dev/null | awk '{print $1}' | sed 's/MiB//g')

if [ ! -z "$POSTGRES_MEM" ]; then
  TOTAL=$(echo "$POSTGRES_MEM + $REDIS_MEM + $BACKEND_MEM + $FRONTEND_MEM" | bc)
  echo "Total RAM Used: ~${TOTAL} MB"

  # Warning thresholds
  if (( $(echo "$TOTAL > 1000" | bc -l) )); then
    echo "⚠️  WARNING: High memory usage (>1GB)"
  elif (( $(echo "$TOTAL > 800" | bc -l) )); then
    echo "🟡 CAUTION: Approaching limit (>800MB)"
  else
    echo "✅ OK: Memory usage within limits"
  fi
else
  echo "⚠️  Cannot calculate total (containers not running)"
fi

echo ""

# Disk Usage
echo "💿 DISK USAGE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
df -h | grep -E "Filesystem|/$" | head -2
echo ""

# Volume Usage
echo "📦 DOCKER VOLUMES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker system df -v 2>/dev/null | grep -A 10 "Local Volumes" | tail -5 | grep -E "wms-|VOLUME"
echo ""

# Health Check
echo "🏥 HEALTH STATUS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend health
HEALTH=$(curl -s http://localhost:3001/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "Backend API: ✅ Online"
  echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
  echo "Backend API: ❌ Offline or unreachable"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
