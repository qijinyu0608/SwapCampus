# 数据备份说明

本目录中的 `swapcampus-2026-06-04.sql` 是 2026-06-04 从本地 Docker MySQL 导出的 `swapcampus` 数据库备份。

## 导入前注意事项

- 这份 SQL 包含当前项目的业务数据、演示账号数据和历史记录，不是空库结构文件。
- 导入前请先备份目标数据库，避免覆盖已有数据。
- 最稳妥的做法是先在目标环境执行一次项目初始化，确认表结构已和当前代码对应，再导入这份 SQL。
- 如果目标库里已经有旧数据，优先在空库中导入；不要直接覆盖生产数据。
- 导入完成后建议手动验证登录、商品列表、校园服务、消息和后台页面是否正常。

## 常用导入命令

本机 MySQL:

```bash
mysql -h 127.0.0.1 -u swapcampus -pswapcampus swapcampus < artifacts/swapcampus-2026-06-04.sql
```

Docker Compose MySQL:

```bash
docker compose exec -T mysql mysql -uswapcampus -pswapcampus swapcampus < artifacts/swapcampus-2026-06-04.sql
```
