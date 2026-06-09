.PHONY: install init up start auth-clean-legacy restart-backend restart-auth status health down logs backend-test frontend-build prisma-generate screenshots

install:
	cd backend && npm install
	cd frontend && npm install

init:
	docker compose --profile init up -d --build db-init

up: init start

start: auth-clean-legacy
	docker compose up -d --build mysql minio meilisearch supertokens backend frontend

auth-clean-legacy:
	-docker rm -f swapcampus-supertokens-local

restart-backend:
	docker compose restart backend

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

screenshots:
	node infra/generate-screenshots.mjs
