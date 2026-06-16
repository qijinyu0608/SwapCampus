# 课程设计 DOCX 生成结果

本目录保存基于 `docs/templates/` 模板和当前 Markdown 内容生成的正式 `docx` 文档。

## 本地生成

先安装 Python 依赖：

```bash
python3 -m pip install --target .docs-py -r requirements-docs.txt
```

再执行生成命令：

```bash
make docs-docx
```

也可以直接运行：

```bash
PYTHONPATH=.docs-py python3 scripts/generate_course_docx.py
```

生成结果会覆盖当前目录下的 `D-01` 到 `D-09` 文档，并刷新本说明文件。

## GitHub Actions

仓库中的 `.github/workflows/ci.yml` 会在 `push`、`pull_request` 和手动 `workflow_dispatch` 时执行：

1. 后端测试
2. 前端构建
3. 课程设计 `docx` 文档生成

文档生成 job 会上传名为 `course-docx` 的 artifact，内容即本目录下的生成结果。

## 文件清单

- `D-01_项目开题报告.docx`
- `D-02_需求规格说明书_SRS.docx`
- `D-03_概要设计说明书.docx`
- `D-04_详细设计说明书.docx`
- `D-05_数据库设计说明书.docx`
- `D-06_软件测试计划与测试报告.docx`
- `D-07_用户手册.docx`
- `D-08_部署与运维手册.docx`
- `D-09_课程设计总结报告.docx`

## 待补图示清单

- D-01 第 6.1 节：建议补 1 张甘特图或项目计划截图。
- D-02 第 3.1 节：建议补 1 张总用例图与 1-2 张子用例图。
- D-03 第 2.2、3.2、4.1、4.2、5、6 节：建议补架构图、模块依赖图、时序图、状态机图、部署图、ER 图。
- D-04 第 5.1、5.2 节：建议补核心类图与关键时序图。
- D-05 第 2 节：建议补全局 ER 图与交易/消息/校园服务子图。
- D-06 第 5、6、7、8 节：建议补覆盖率截图、性能曲线、安全扫描输出和缺陷统计图。
- D-08 第 1 节：建议补正式部署拓扑图；第 3 节建议补命令执行截图。
- D-09 第 8、13 节：建议补部署架构图、演示视频链接以及附录图示材料。
