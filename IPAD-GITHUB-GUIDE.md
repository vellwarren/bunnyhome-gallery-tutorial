# 用 iPad 发布这个仓库

别紧张。第一次看起来按钮很多，真正需要你决定的只有三件事：仓库名字、公开还是私密、第一条 commit 写什么。

## 开始前

你需要：

- 一个已经登录的 GitHub 账号。
- Safari 和 iPad 自带的“文件”App。
- 解压后的 `elliott-gallery-tutorial` 文件夹。

压缩包已经排除了 `node_modules`、前端构建产物、`.env` 和本地 Git 数据。不要把自己的 API key、Supabase service-role key 或真实私人图片上传到公开仓库。

## 路线 A：Safari 免费发布（推荐第一次使用）

### 1. 创建空仓库

1. 在 Safari 打开 [github.com/new](https://github.com/new)。
2. `Repository name` 填：`elliott-gallery-tutorial`。
3. `Description` 可以填：`A private image gallery tutorial with lossy semantic memory, Supabase Storage, and runnable examples.`
4. 第一次不放心可以先选 `Private`；检查完成后再改成 `Public`。想直接公开也可以。
5. **不要勾选** Add a README、Add .gitignore 或 Choose a license——文件包里已经有这三样。
6. 点 `Create repository`。

### 2. 解压文件

1. 在“文件”App 里找到 ZIP。
2. 点一下 ZIP，iPad 会生成同名文件夹。
3. 打开文件夹，继续进入里面的 `elliott-gallery-tutorial`。
4. 你应该直接看到 `README.md`、`docs`、`examples`、`package.json` 等内容。

### 3. 上传仓库内容

1. 回到刚创建的空 GitHub 仓库。
2. 点页面里的 `uploading an existing file`；若没看到，就点 `Add file` → `Upload files`。
3. 用 iPad 分屏同时打开 Safari 和“文件”App。
4. 在“文件”App 中进入 `elliott-gallery-tutorial`，点右上角 `…` → `选择` → `全选`。
5. 长按已选择的项目，把它们拖到 Safari 的 GitHub 上传区域。

上传列表里应该直接出现 `README.md`、`docs/...` 和 `examples/...`。如果只出现一个外层 `elliott-gallery-tutorial` 文件夹，先取消，进入该文件夹后选择**里面的内容**再上传，否则 GitHub 仓库会多套一层目录。

### 4. 做你的第一次 commit

上传完成后，滚到页面下方：

- Commit message 填：`Initial release: Elliott Gallery tutorial`
- Description 可留空。
- 选择 `Commit directly to the main branch`。
- 点 `Commit changes`。

这一步完成后，那次 commit 就是你亲自提交的，GitHub 会使用你的账号记录作者。

### 5. 发布前检查

回到仓库首页，确认最外层直接包含：

```text
README.md
LICENSE
SECURITY.md
docs/
examples/
package.json
package-lock.json
```

再搜索确认仓库中没有：

```text
.env
node_modules/
dist/
真实 API key
真实私人图片
```

确认 README 可以正常展开、docs 链接能打开，就完成了。

## 路线 B：Working Copy（适合以后经常更新）

[Working Copy](https://workingcopyapp.com/) 可以直接把 ZIP 导入为新 Git 仓库，然后选择文件、写 commit message、Commit、Push。它在 iPad 上管理 Git 很舒服，但目前把 commit Push 到远程属于 Pro 功能。

大致流程：

1. 安装并打开 Working Copy，连接 GitHub。
2. 把 ZIP 从“文件”App 分享给 Working Copy，选择导入为新 repository。
3. 在仓库状态页选择所有文件。
4. 输入 `Initial release: Elliott Gallery tutorial` 并 Commit。
5. 在 GitHub 创建同名空仓库，把它设为 remote，然后 Push。

如果只是第一次发布，路线 A 足够；如果以后要在 iPad 上持续改教程，路线 B 才更值得。

## 最容易踩的三个坑

1. **GitHub 多出一层同名文件夹**：上传时选了整个外层文件夹。应该进入它，上传里面的内容。
2. **不小心又创建一份 README**：建仓库时勾了 Add a README。第一次请创建完全空的仓库。
3. **把密钥一起传了**：只上传这个准备好的文件包。以后填写 `.env` 后，不要把 `.env` 上传到 GitHub。

官方参考：[创建 GitHub 仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)、[通过网页上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)、[Working Copy 导入说明](https://workingcopyapp.com/manual/file-changes/)。

