# SwapCampus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript-based campus second-hand trading web platform with complete course-design markdown docs and Docker Compose local deployment.

**Architecture:** Use a monorepo-style structure with separate `frontend` and `backend` apps, backed by MySQL and MinIO in Docker Compose. Start with the core trading flow and matching docs so the repository remains runnable and auditable throughout development.

**Tech Stack:** React 18, TypeScript, Vite, NestJS, Prisma, MySQL 8, MinIO, Socket.IO, Docker Compose, Jest, Vitest

---

### Task 1: Repository Baseline

**Files:**
- Create: `frontend/package.json`
- Create: `backend/package.json`
- Create: `.gitignore`
- Modify: `docker-compose.yml`
- Modify: `Makefile`
- Modify: `README.md`

- [ ] **Step 1: Replace template compose setup with MySQL + MinIO + frontend + backend service definitions**
- [ ] **Step 2: Add root ignore rules for Node, build outputs, env files, and database volumes**
- [ ] **Step 3: Rewrite Makefile targets for install, up, down, logs, and test commands**
- [ ] **Step 4: Rewrite README with project intro, stack, startup steps, and verification commands**

### Task 2: Backend Skeleton

**Files:**
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/modules/health/health.controller.ts`
- Create: `backend/src/modules/auth/*`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Scaffold NestJS app entry and health endpoint**
- [ ] **Step 2: Define Prisma schema for core tables**
- [ ] **Step 3: Add auth module skeleton with JWT-based login/register placeholders**
- [ ] **Step 4: Add backend test baseline and verify health route**

### Task 3: Frontend Skeleton

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/pages/*`
- Create: `frontend/src/router/*`
- Create: `frontend/src/components/*`

- [ ] **Step 1: Scaffold Vite React app entry and router**
- [ ] **Step 2: Add layout with homepage, login, publish, messages, profile, admin routes**
- [ ] **Step 3: Add API client and mock-ready page shells for each core module**
- [ ] **Step 4: Verify frontend build passes**

### Task 4: Course Design Markdown Docs

**Files:**
- Create: `docs/01-项目开题报告.md`
- Create: `docs/02-需求规格说明书.md`
- Create: `docs/03-概要设计说明书.md`
- Create: `docs/04-详细设计说明书.md`
- Create: `docs/05-数据库设计说明书.md`
- Create: `docs/06-测试计划与测试报告.md`
- Create: `docs/07-用户手册.md`
- Create: `docs/08-部署与运维手册.md`
- Create: `docs/09-课程设计总结报告.md`
- Create: `docs/10-项目计划.md`
- Create: `docs/11-团队分工与贡献说明.md`
- Create: `docs/12-答辩材料提纲.md`
- Create: `docs/T-01-选题申报表.md`
- Create: `docs/T-02-团队组建申报表.md`
- Create: `docs/T-03-周进度汇报表.md`
- Create: `docs/T-04-团队互评表.md`
- Create: `docs/T-05-个人贡献度评定表.md`

- [ ] **Step 1: Write the 12 required deliverable markdown documents with course-aligned sections**
- [ ] **Step 2: Add the 5 management-form markdown files in flat structure**
- [ ] **Step 3: Cross-check terminology, architecture, and module names against the spec**

### Task 5: First End-to-End Verification

**Files:**
- Modify: `backend/*`
- Modify: `frontend/*`
- Modify: `docs/08-部署与运维手册.md`

- [ ] **Step 1: Install dependencies and run backend tests**
- [ ] **Step 2: Run frontend build**
- [ ] **Step 3: Start Docker Compose and verify service health endpoints**
- [ ] **Step 4: Record verified startup steps into deployment documentation**
