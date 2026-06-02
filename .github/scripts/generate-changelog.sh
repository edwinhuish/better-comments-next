#!/bin/bash
set -e

# 检查参数
if [ $# -ne 2 ]; then
  echo "Usage: $0 <current_tag> <previous_tag>"
  exit 1
fi

current_tag="$1"
previous_tag="$2"

# 提取提交消息
if [ -z "$previous_tag" ]; then
  commit_messages=$(git log --pretty=format:"%s - by @%an (%h)" "$current_tag" | grep -E 'feat|fix|docs|perf|refactor' || true)
else
  commit_messages=$(git log --pretty=format:"%s - by @%an (%h)" "$previous_tag".."$current_tag" | grep -E 'feat|fix|docs|perf|refactor' || true)
fi

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