# Moderation Wordlists

`blocked-terms.txt` 是给内容审核直接读取的主词表。

约定：

- UTF-8 编码
- 一行一个词条
- 无注释、无逗号尾巴，适合直接做子串命中
- 已合并公开中文敏感词库与项目本地扩展词

相关文件：

- `blocked-terms.txt`：主词表
- `blocked-terms.local.txt`：项目本地补充词，偏校园交易场景
- `blocked-terms.sources.txt`：本次合并时使用的来源文件清单与主词表总量

来源基线：

- `konsheng/Sensitive-lexicon`
- `fwwdn/sensitive-stop-words`
- `lining0806/TextFilter`

说明：

- 这份词表是“非常全”的口径，适合先做高召回命中。
- 词表中包含政治、暴恐、色情、广告、灰产、非法网址、账号交易、票据证件、校园贷等多类词条。
- 由于采用高召回口径，直接上线时建议结合白名单、类目规则、人工复核和命中分级，不要只靠单一词表决定封禁。
