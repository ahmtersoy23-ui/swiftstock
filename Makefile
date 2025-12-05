# ============================================
# WMS MAKEFILE
# ============================================

.PHONY: help dev prod build down logs clean test

# Default target
help:
	@echo "WMS Docker Commands:"
	@echo ""
	@echo "  make dev      - Start development environment"
	@echo "  make prod     - Start production environment"
	@echo "  make build    - Build all containers"
	@echo "  make down     - Stop all containers"
	@echo "  make logs     - View logs"
	@echo "  make clean    - Remove all containers and volumes"
	@echo "  make test     - Run backend tests"
	@echo ""

# Development environment
dev:
	docker-compose -f docker-compose.dev.yml up --build

# Development environment (detached)
dev-d:
	docker-compose -f docker-compose.dev.yml up --build -d

# Production environment
prod:
	docker-compose up --build -d

# Build containers
build:
	docker-compose build

# Stop containers
down:
	docker-compose -f docker-compose.dev.yml down
	docker-compose down

# View logs
logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-backend:
	docker-compose -f docker-compose.dev.yml logs -f backend

logs-frontend:
	docker-compose -f docker-compose.dev.yml logs -f frontend

# Clean up
clean:
	docker-compose -f docker-compose.dev.yml down -v --rmi local
	docker-compose down -v --rmi local
	docker system prune -f

# Run tests
test:
	cd wms-backend && npm test

test-coverage:
	cd wms-backend && npm run test:coverage

# Database
db-shell:
	docker-compose -f docker-compose.dev.yml exec postgres psql -U wms_user -d wms_db

# Redis CLI
redis-cli:
	docker-compose -f docker-compose.dev.yml exec redis redis-cli

# Backend shell
backend-shell:
	docker-compose -f docker-compose.dev.yml exec backend sh
