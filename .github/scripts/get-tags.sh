#!/bin/bash
set -e

if [ -f "$(git rev-parse --git-dir)/shallow" ]; then
  git fetch --prune --unshallow
else
  git fetch --prune
fi

# Get current tag from the triggering event
current_tag="${GITHUB_REF_NAME}"
echo "current_tag=$current_tag" >> "$GITHUB_OUTPUT"
echo "✅ Current tag: $current_tag"

# Extract version numbers from current tag (e.g., v1.3.5-beta.5 -> 1 3 5)
current_version=$(echo "$current_tag" | sed 's/^v//' | sed 's/-.*//')
current_major=$(echo "$current_version" | cut -d. -f1)
current_minor=$(echo "$current_version" | cut -d. -f2)
current_patch=$(echo "$current_version" | cut -d. -f3)

echo "📊 Version breakdown: major=$current_major, minor=$current_minor, patch=$current_patch"

# Get all stable tags sorted by version using git's built-in version sort
all_tags=$(git tag --sort=version:refname | grep -vE -- '-(beta|rc|alpha|dev)')
echo "📋 All stable tags found: $(echo $all_tags | tr '\n' ' ')"

if [ -z "$all_tags" ]; then
  echo "❌ Error: No stable tags found in repository"
  exit 1
fi

previous_tag=""

if echo "$current_tag" | grep -qE -- '-(beta|rc|alpha|dev)'; then
  # Pre-release tag: find the latest stable tag of the same major.minor version
  previous_tag=$(echo "$all_tags" | grep -E "^v${current_major}\.${current_minor}\." | tail -1)

  # If no stable tag of same major.minor, find the latest stable tag before this version
  if [ -z "$previous_tag" ]; then
    while IFS= read -r tag; do
      tag_version=$(echo "$tag" | sed 's/^v//')
      tag_major=$(echo "$tag_version" | cut -d. -f1)
      tag_minor=$(echo "$tag_version" | cut -d. -f2)

      if [ "$tag_major" -lt "$current_major" ] || { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -lt "$current_minor" ]; }; then
        previous_tag="$tag"
      fi
    done <<< "$all_tags"
  fi
else
  # Stable tag: iterate through sorted list to find the tag immediately before current
  # The current tag may not exist in the list yet (new release), so also compare versions
  prev=""
  while IFS= read -r tag; do
    if [ "$tag" = "$current_tag" ]; then
      previous_tag="$prev"
      break
    fi
    tag_version=$(echo "$tag" | sed 's/^v//')
    tag_major=$(echo "$tag_version" | cut -d. -f1)
    tag_minor=$(echo "$tag_version" | cut -d. -f2)
    tag_patch=$(echo "$tag_version" | cut -d. -f3)

    # Check if this tag is semantically before the current version
    if [ "$tag_major" -lt "$current_major" ] || \
       { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -lt "$current_minor" ]; } || \
       { [ "$tag_major" -eq "$current_major" ] && [ "$tag_minor" -eq "$current_minor" ] && [ "$tag_patch" -lt "$current_patch" ]; }; then
      prev="$tag"
    fi
  done <<< "$all_tags"

  # If current tag wasn't in the list, prev holds the latest tag before current version
  if [ -z "$previous_tag" ] && [ -n "$prev" ]; then
    previous_tag="$prev"
  fi
fi

if [ -z "$previous_tag" ]; then
  echo "❌ Error: Could not determine previous tag for '$current_tag'. No earlier stable tag exists."
  exit 1
fi

echo "previous_tag=$previous_tag" >> "$GITHUB_OUTPUT"
echo "✅ Previous tag: $previous_tag"
