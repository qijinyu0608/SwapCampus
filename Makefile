.PHONY: install init init-reset up start auth-clean-legacy restart-backend restart-search-indexer restart-commerce-sync restart-auth status health down logs backend-test frontend-build prisma-generate backfill-search-outbox screenshots http-integration e2e docs-docx

install:
	cd backend && npm install
	cd frontend && npm install

init:
	docker compose --profile init up -d --build db-init

init-reset:
	docker compose --profile init run --rm db-init sh -c "npm run db:push -- --force-reset && npm run db:init"

up: init start

start: auth-clean-legacy
	docker compose up -d --build mysql minio meilisearch supertokens-db supertokens vendure backend search-indexer commerce-sync frontend

auth-clean-legacy:
	-docker rm -f swapcampus-supertokens-local

restart-backend:
	docker compose restart backend

restart-search-indexer:
	docker compose restart search-indexer

restart-commerce-sync:
	docker compose restart commerce-sync

restart-auth: auth-clean-legacy
	docker compose up -d supertokens
	docker compose restart backend

status:
	docker compose ps

health:
	curl -fsS http://127.0.0.1:3001/api/health

# 保留兼容，语义等同于 start
dev-up: start

down:
	docker compose down -v

logs:
	docker compose logs -f

backend-test:
	cd backend && npm test

frontend-build:
	cd frontend && npm run build

prisma-generate:
	cd backend && npm run prisma:generate

backfill-search-outbox:
	docker compose exec -T search-indexer node /app/backend/dist/prisma/backfill-search-outbox.js

screenshots:
	node infra/generate-screenshots.mjs

http-integration:
	node scripts/test-http-integration.mjs

e2e:
	node scripts/e2e-playwright.mjs

docs-docx:
	python3 -m pip install --target .docs-py -r requirements-docs.txt
	PYTHONPATH=.docs-py python3 scripts/generate_course_docx.py
