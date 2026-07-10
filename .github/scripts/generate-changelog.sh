#!/bin/bash
set -e

# 检查参数
if [ $# -ne 2 ]; then
  echo "Usage: $0 <current_tag> <previous_tag>"
  exit 1
fi

current_tag="$1"
previous_tag="$2"

# 解析仓库 owner/repo（优先使用 Actions 环境变量，否则从 git remote 推断）
repo_slug="${GITHUB_REPOSITORY:-}"
if [ -z "$repo_slug" ]; then
  repo_slug=$(git config --get remote.origin.url | sed -E 's#^.*github\.com[:/]([^/]+/[^/]+?)(\.git)?$#\1#')
fi

# 用 commit SHA 反查对应的 GitHub 登录用户名，失败时回退到 git 作者名
gh_token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
resolve_login() {
  sha="$1"
  fallback="$2"
  login=""
  if [ -n "$repo_slug" ] && [ -n "$gh_token" ]; then
    login=$(curl -sf \
      -H "Authorization: Bearer $gh_token" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$repo_slug/commits/$sha" \
      | grep -o '"login"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"login"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
  fi
  if [ -n "$login" ]; then
    echo "$login"
  else
    echo "$fallback"
  fi
}

# 提取提交（制表符分隔：完整SHA \t 主题 \t 作者名 \t 短SHA）
if [ -z "$previous_tag" ]; then
  raw_commits=$(git log --pretty=format:"%H%x09%s%x09%an%x09%h" "$current_tag")
else
  raw_commits=$(git log --pretty=format:"%H%x09%s%x09%an%x09%h" "$previous_tag".."$current_tag")
fi

# 逐条解析 GitHub 用户名并组装成 changelog 行
commit_messages=""
while IFS=$'\t' read -r full_sha subject author_name short_sha; do
  [ -z "$full_sha" ] && continue
  case "$subject" in
    *feat*|*fix*|*docs*|*perf*|*refactor*) ;;
    *) continue ;;
  esac
  user=$(resolve_login "$full_sha" "$author_name")
  commit_messages="${commit_messages}${subject} - by @${user} (${short_sha})"$'\n'
done <<< "$raw_commits"

# 转义 ` 字符
commit_messages=$(echo "$commit_messages" | sed 's/`/\\`/g')

# 分类提交消息
feat_messages=$(echo "$commit_messages" | grep 'feat' || true)
fix_messages=$(echo "$commit_messages" | grep 'fix' || true)
docs_messages=$(echo "$commit_messages" | grep 'docs' || true)
perf_messages=$(echo "$commit_messages" | grep 'perf' || true)
refactor_messages=$(echo "$commit_messages" | grep 'refactor' || true)

# 生成 changelog
release_notes=""

if [[ -n "$feat_messages" ]]; then
  release_notes="${release_notes}\n### 🚀 Features 新功能：  \n"
  while IFS= read -r message; do
    [[ -n "$message" ]] && release_notes="${release_notes}\n- $message"
  done <<< "$feat_messages"
fi

if [[ -n "$fix_messages" ]]; then
  release_notes="${release_notes}\n### 🩹 Fixes 缺陷修复：  \n"
  while IFS= read -r message; do
    [[ -n "$message" ]] && release_notes="${release_notes}\n- $message"
  done <<< "$fix_messages"
fi

if [[ -n "$docs_messages" ]]; then
  release_notes="${release_notes}\n### 📖 Documentation 文档：  \n"
  while IFS= read -r message; do
    [[ -n "$message" ]] && release_notes="${release_notes}\n- $message"
  done <<< "$docs_messages"
fi

if [[ -n "$perf_messages" ]]; then
  release_notes="${release_notes}\n### 🔥 Performance 性能优化：  \n"
  while IFS= read -r message; do
    [[ -n "$message" ]] && release_notes="${release_notes}\n- $message"
  done <<< "$perf_messages"
fi

if [[ -n "$refactor_messages" ]]; then
  release_notes="${release_notes}\n### 🔨 Refactor 代码重构：  \n"
  while IFS= read -r message; do
    [[ -n "$message" ]] && release_notes="${release_notes}\n- $message"
  done <<< "$refactor_messages"
fi

# 写入 changelog.md 文件
echo -e "$release_notes" > changelog.md
cat changelog.md