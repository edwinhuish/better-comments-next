#!/bin/bash
# get-tags.sh - Git 标签版本比较工具
#
# 功能说明:
#   本脚本用于查找当前 Git 标签的前一个版本标签，支持标准版本和预发布版本。
#   主要用于 CI/CD 流程中生成版本变更日志时确定版本范围。
#
# 使用方法:
#   ./get-tags.sh [OPTIONS] [TARGET_TAG]
#
# 参数:
#   TARGET_TAG    可选。指定要分析的目标标签，默认为当前最新的 Git 标签
#
# 选项:
#   --minor, minor  启用 minor 模式。在 minor 模式下，当当前版本是 X.Y.0 时，
#                   会查找前一个 minor 版本的最新标签，而不是紧邻的前一个标签
#
# 环境变量:
#   GITHUB_REF_NAME    如果未指定 TARGET_TAG，且此变量存在，则使用此值作为当前标签
#   GITHUB_OUTPUT      如果设置，会将结果写入此文件（GitHub Actions 输出格式）
#
# 输出:
#   - current_tag:  当前分析的标签
#   - previous_tag: 前一个版本标签（如果没有则为空）
#
# 版本格式支持:
#   - 标准版本: v1.0.0, v2.3.4
#   - 预发布版本: v1.0.0-beta.1, v2.0.0-rc.1, v1.0.0-alpha.1, v1.0.0-dev.1
#
# 示例:
#   ./get-tags.sh                    # 使用最新标签，标准模式
#   ./get-tags.sh v1.2.0             # 分析指定标签
#   ./get-tags.sh --minor v2.0.0     # 使用 minor 模式
#
# 返回值:
#   0 - 成功
#   1 - 错误（无标签、格式错误等）

set -e

# ============================================================================
# 参数解析
# ============================================================================

# MINOR_MODE: 是否启用 minor 模式
#   - false (默认): 标准模式，查找紧邻的前一个标签
#   - true: minor 模式，跨 minor 版本比较
MINOR_MODE=false

# TARGET_TAG: 目标标签（命令行参数传入）
TARGET_TAG=""

# 解析命令行参数
for arg in "$@"; do
  case "$arg" in
    --minor|-minor)
      MINOR_MODE=true
      ;;
    -*)
      echo "❌ Error: Unknown option: $arg"
      exit 1
      ;;
    *)
      # 第一个非选项参数作为目标标签
      if [ -z "$TARGET_TAG" ]; then
        TARGET_TAG="$arg"
      fi
      ;;
  esac
done

# ============================================================================
# Git 仓库准备
# ============================================================================

# 检查是否为浅克隆仓库，如果是则获取完整历史
# 这对于获取所有标签是必要的
if [ -f "$(git rev-parse --git-dir)/shallow" ]; then
  git fetch --prune --unshallow
else
  git fetch --prune
fi

# ============================================================================
# 获取所有稳定标签
# ============================================================================

# 获取所有标签并按版本号排序，排除预发布版本（beta/rc/alpha/dev）
# 这些稳定标签将用于后续的前一个版本查找
all_tags=$(git tag --sort=version:refname | grep -vE -- '-(beta|rc|alpha|dev)')
echo "📋 All stable tags found: $(echo $all_tags | tr '\n' ' ')"

# 验证是否找到稳定标签
# 注意：脚本要求至少有一个稳定标签存在
if [ -z "$all_tags" ]; then
  echo "❌ Error: No stable tags found in repository"
  exit 1
fi

# ============================================================================
# 确定当前标签
# ============================================================================

# 优先级: 命令行参数 > INPUT_VERSION 环境变量 > GITHUB_REF 环境变量 > 最新 Git 标签
if [ -n "$TARGET_TAG" ]; then
  # 使用命令行传入的标签
  current_tag="$TARGET_TAG"
elif [ -n "${INPUT_VERSION:-}" ]; then
  # 使用 workflow_dispatch 手动输入的版本（GitHub Actions 自动转换）
  current_tag="${INPUT_VERSION}"
elif [ -n "${GITHUB_REF:-}" ]; then
  # 从 GITHUB_REF 提取标签名 (refs/tags/v1.0.0 -> v1.0.0)
  # 注意: 使用 GITHUB_REF 而不是 GITHUB_REF_NAME，因为后者可能是分支名
  current_tag="${GITHUB_REF#refs/tags/}"
  # 如果提取后还是原样（说明不是 refs/tags/ 开头），则清空使用 git 获取
  if [ "$current_tag" = "$GITHUB_REF" ]; then
    current_tag=""
  fi
fi

# 如果上述方式都未获取到标签，则使用 git 获取最新的标签
if [ -z "${current_tag:-}" ]; then
  # 获取最新的标签（按版本降序）
  current_tag=$(git tag --sort=-version:refname | head -1)
  if [ -z "$current_tag" ]; then
    echo "❌ Error: No tags found in repository"
    exit 1
  fi
fi

# 输出当前标签到 GitHub Actions（如果设置了 GITHUB_OUTPUT）
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "current_tag=$current_tag" >> "$GITHUB_OUTPUT"
fi
echo "✅ Current tag: $current_tag"

# ============================================================================
# 解析版本号
# ============================================================================

# 从当前标签提取版本号组件
# 示例: v1.3.5-beta.5 -> major=1, minor=3, patch=5
current_version=$(echo "$current_tag" | sed 's/^v//' | sed 's/-.*//')
current_major=$(echo "$current_version" | cut -d. -f1)
current_minor=$(echo "$current_version" | cut -d. -f2)
current_patch=$(echo "$current_version" | cut -d. -f3)

echo "📊 Version breakdown: major=$current_major, minor=$current_minor, patch=$current_patch"

# 验证版本号格式是否为数字
if ! [[ "$current_major" =~ ^[0-9]+$ ]] || ! [[ "$current_minor" =~ ^[0-9]+$ ]] || ! [[ "$current_patch" =~ ^[0-9]+$ ]]; then
  echo "❌ Error: Invalid version format in tag '$current_tag'. Expected format: vX.Y.Z"
  exit 1
fi

# 初始化前一个标签变量
previous_tag=""

# ============================================================================
# 辅助函数
# ============================================================================

# 比较两个语义化版本号
# 参数: v1_major v1_minor v1_patch v2_major v2_minor v2_patch
# 返回值:
#   0 - 版本相等
#   1 - v1 < v2
#   2 - v1 > v2
version_compare() {
  local v1_major=$1 v1_minor=$2 v1_patch=$3
  local v2_major=$4 v2_minor=$5 v2_patch=$6

  if [ "$v1_major" -lt "$v2_major" ]; then return 1; fi
  if [ "$v1_major" -gt "$v2_major" ]; then return 2; fi
  if [ "$v1_minor" -lt "$v2_minor" ]; then return 1; fi
  if [ "$v1_minor" -gt "$v2_minor" ]; then return 2; fi
  if [ "$v1_patch" -lt "$v2_patch" ]; then return 1; fi
  if [ "$v1_patch" -gt "$v2_patch" ]; then return 2; fi
  return 0
}

# 查找指定 major.minor 版本系列中的最新标签
# 参数: target_major target_minor
# 输出: 匹配的最新标签（如果有）
find_latest_in_minor() {
  local target_major=$1
  local target_minor=$2
  local result=""

  # 遍历所有稳定标签，找到匹配 major.minor 的最新标签
  while IFS= read -r tag; do
    local tag_version=$(echo "$tag" | sed 's/^v//' | sed 's/-.*//')
    local tag_major=$(echo "$tag_version" | cut -d. -f1)
    local tag_minor=$(echo "$tag_version" | cut -d. -f2)

    if [ "$tag_major" -eq "$target_major" ] && [ "$tag_minor" -eq "$target_minor" ]; then
      result="$tag"
    fi
  done <<< "$all_tags"

  echo "$result"
}

# ============================================================================
# 主逻辑：查找前一个标签
# ============================================================================

# 检查当前标签是否为预发布版本（包含 beta/rc/alpha/dev）
if echo "$current_tag" | grep -qE -- '-(beta|rc|alpha|dev)'; then
  # --------------------------------------------------------------------------
  # 预发布版本处理逻辑
  # --------------------------------------------------------------------------
  # 策略：
  # 1. 首先尝试找同 major.minor 的最新稳定版本
  # 2. 如果没有，则找版本号小于当前版本的最新稳定版本

  # 步骤 1: 查找同 major.minor 的最新稳定标签
  # 示例: v1.1.0-beta.1 会尝试找 v1.1.x 的最新稳定版本
  previous_tag=$(echo "$all_tags" | grep -E "^v${current_major}\.${current_minor}\." | tail -1)

  # 步骤 2: 如果找不到同 minor 的稳定版本，找前一个稳定版本
  if [ -z "$previous_tag" ]; then
    while IFS= read -r tag; do
      tag_version=$(echo "$tag" | sed 's/^v//' | sed 's/-.*//')
      tag_major=$(echo "$tag_version" | cut -d. -f1)
      tag_minor=$(echo "$tag_version" | cut -d. -f2)

      # 检查标签版本是否小于当前版本
      if [ "$tag_major" -lt "$current_major" ] || { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -lt "$current_minor" ]; }; then
        previous_tag="$tag"
      fi
    done <<< "$all_tags"
  fi
else
  # --------------------------------------------------------------------------
  # 稳定版本处理逻辑
  # --------------------------------------------------------------------------

  if [ "$MINOR_MODE" = true ]; then
    # ------------------------------------------------------------------------
    # Minor 模式：用于跨 minor 版本比较
    # ------------------------------------------------------------------------
    echo "🔧 Minor mode enabled: Finding previous minor version"

    if [ "$current_patch" -eq 0 ]; then
      # 情况 A: 当前是 X.Y.0 版本（minor 或 major 更新）

      if [ "$current_minor" -eq 0 ]; then
        # 情况 A1: 当前是 X.0.0 版本（major 更新）
        # 策略：查找前一个 major 版本的最新标签
        echo "📌 Cross-major update detected: v${current_major}.0.0"
        prev_major=$((current_major - 1))

        if [ "$prev_major" -lt 0 ]; then
          echo "⚠️ This appears to be the first major version (v0.x.x)"
        else
          # 遍历查找前一个 major 版本的最新标签
          while IFS= read -r tag; do
            tag_version=$(echo "$tag" | sed 's/^v//' | sed 's/-.*//')
            tag_major=$(echo "$tag_version" | cut -d. -f1)

            if [ "$tag_major" -eq "$prev_major" ]; then
              previous_tag="$tag"
            fi
          done <<< "$all_tags"

          if [ -z "$previous_tag" ]; then
            echo "⚠️ No tags found in previous major version v${prev_major}.x.x"
          fi
        fi
      else
        # 情况 A2: 当前是 X.Y.0 版本且 Y > 0（minor 更新）
        # 策略：查找前一个 minor 版本的最新标签
        echo "📌 Cross-minor update detected: v${current_major}.${current_minor}.0"
        prev_minor=$((current_minor - 1))
        previous_tag=$(find_latest_in_minor "$current_major" "$prev_minor")

        if [ -z "$previous_tag" ]; then
          echo "⚠️ No tags found in previous minor version v${current_major}.${prev_minor}.x"
        fi
      fi
    else
      # 情况 B: 当前是 X.Y.Z 版本且 Z > 0（同 minor 系列的补丁更新）
      # 策略：查找同 minor 系列中紧邻的前一个版本
      echo "📌 Same minor series update: v${current_major}.${current_minor}.${current_patch}"

      # 遍历标签列表，找到当前标签前的最后一个同 minor 版本
      prev=""
      while IFS= read -r tag; do
        if [ "$tag" = "$current_tag" ]; then
          previous_tag="$prev"
          break
        fi

        tag_version=$(echo "$tag" | sed 's/^v//' | sed 's/-.*//')
        tag_major=$(echo "$tag_version" | cut -d. -f1)
        tag_minor=$(echo "$tag_version" | cut -d. -f2)
        tag_patch=$(echo "$tag_version" | cut -d. -f3)

        # 只考虑同 minor 系列且 patch 小于当前的标签
        if [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -eq "$current_minor" ]; then
          if [ "$tag_patch" -lt "$current_patch" ]; then
            prev="$tag"
          fi
        fi
      done <<< "$all_tags"

      # 如果在列表中没找到，尝试查找同 minor 系列的最新标签
      if [ -z "$previous_tag" ]; then
        previous_tag=$(find_latest_in_minor "$current_major" "$current_minor")
        # 确保结果不是当前标签本身
        if [ "$previous_tag" = "$current_tag" ]; then
          previous_tag=""
        fi
      fi
    fi
  else
    # ------------------------------------------------------------------------
    # 标准模式：查找紧邻的前一个版本
    # ------------------------------------------------------------------------
    echo "🔧 Standard mode: Finding immediate previous version"

    # 遍历排序后的标签列表，找到当前标签的前一个标签
    prev=""
    while IFS= read -r tag; do
      if [ "$tag" = "$current_tag" ]; then
        previous_tag="$prev"
        break
      fi

      # 解析标签版本号
      tag_version=$(echo "$tag" | sed 's/^v//' | sed 's/-.*//')
      tag_major=$(echo "$tag_version" | cut -d. -f1)
      tag_minor=$(echo "$tag_version" | cut -d. -f2)
      tag_patch=$(echo "$tag_version" | cut -d. -f3)

      # 检查此标签是否在语义化版本上小于当前版本
      if [ "$tag_major" -lt "$current_major" ] || \
         { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -lt "$current_minor" ]; } || \
         { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -eq "$current_minor" ] && [ "$tag_patch" -lt "$current_patch" ]; }; then
        prev="$tag"
      fi
    done <<< "$all_tags"

    # 如果当前标签不在列表中，prev 保存的就是前一个版本
    if [ -z "$previous_tag" ] && [ -n "$prev" ]; then
      previous_tag="$prev"
    fi
  fi
fi

# ============================================================================
# 输出结果
# ============================================================================

# 如果没有找到前一个标签，给出提示
if [ -z "$previous_tag" ]; then
  echo "⚠️ No previous stable tag found for '$current_tag'. This appears to be the first release."
fi

# 输出到 GitHub Actions（如果设置了 GITHUB_OUTPUT）
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "previous_tag=$previous_tag" >> "$GITHUB_OUTPUT"
fi
echo "✅ Previous tag: ${previous_tag:-<none>}"
