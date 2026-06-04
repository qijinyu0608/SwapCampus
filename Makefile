.PHONY: install up down logs backend-test frontend-build prisma-generate screenshots

install:
	cd backend && npm install
	cd frontend && npm install

up:
	docker compose up -d --build

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
