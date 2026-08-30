# iPad 免费保留文件夹结构：用 GitHub Codespaces

当 iPad 的 GitHub 上传页面只能选文件、不能选文件夹时，不要逐层上传。那样会把 `docs/`、`examples/server/` 和 `examples/web/` 的结构打散。

这个方法只上传一个 ZIP，再在 GitHub 自己的网页开发环境里解压。个人 GitHub 账号每月包含一部分免费的 Codespaces 用量；完成后删除 Codespace，就不会继续占用它的存储。

## 1. 让空仓库先拥有 main 分支

如果仓库还是完全空白：

1. 在仓库首页点 `creating a new file`。
2. 文件名填 `placeholder.md`。
3. 内容随便填一句：`Preparing the Gallery tutorial.`
4. 点 `Commit changes`，提交到 `main`。

这只是为了让仓库拥有 `main` 分支，之后会被正式内容替代。

## 2. 创建 Codespace

1. 回到仓库首页。
2. 点绿色 `Code` 按钮。
3. 切换到 `Codespaces`。
4. 点 `Create codespace on main`。
5. 等网页里的 VS Code 打开。

## 3. 只上传一个 ZIP

把专用文件 `elliott-gallery-github-root-2026-08-30.zip` 上传到 Codespaces 的文件区域。可以点左侧 Explorer 顶部的 `…` 寻找 `Upload...`，也可以把 ZIP 从 iPad“文件”App 拖进左侧文件列表。

上传完成后，ZIP 应与 `placeholder.md` 位于同一层。

## 4. 在网页终端粘贴命令

打开下方 Terminal。若没有显示，点左上角菜单 `☰` → `Terminal` → `New Terminal`。

依次粘贴，每行执行一次：

```bash
unzip -o elliott-gallery-github-root-2026-08-30.zip
rm elliott-gallery-github-root-2026-08-30.zip placeholder.md
git add .
git commit -m "Publish Elliott Gallery tutorial"
git push
```

这些命令只会：解压准备好的仓库文件、删除上传用 ZIP 和临时占位文件、创建你的 commit、推送到 GitHub。

如果 `git commit` 提示需要姓名或邮箱，先执行下面两行，把内容替换成你的 GitHub 显示名和账号邮箱，再重新执行 commit：

```bash
git config user.name "你的 GitHub 显示名"
git config user.email "你的 GitHub 邮箱"
```

如果不想在公开 commit 里显示真实邮箱，可以在 GitHub `Settings → Emails` 找到 GitHub 提供的 `noreply` 邮箱并使用它。

## 5. 检查并关闭 Codespace

刷新 GitHub 仓库页面，最外层应该直接看到：

```text
README.md
LICENSE
SECURITY.md
docs/
examples/
package.json
package-lock.json
```

确认后打开 [github.com/codespaces](https://github.com/codespaces)，找到刚才的 Codespace，点 `…` → `Delete`。仓库和 commit 不会被删除，只是关闭临时网页开发环境。

