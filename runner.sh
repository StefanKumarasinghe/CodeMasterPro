#!/bin/bash

set -e

DEPLOY_UI=false
DEPLOY_BACKEND=false
PUSH_GITHUB=false
ARCH="latest"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ui)
      DEPLOY_UI=true
      shift
      ;;
    --backend)
      DEPLOY_BACKEND=true
      shift
      ;;
    --github)
      PUSH_GITHUB=true
      shift
      ;;
    --arch)
      shift
      if [[ "$1" =~ ^(amd64|arm64|latest|all)$ ]]; then
        ARCH="$1"
      else
        echo "❌ Invalid arch: $1 (allowed: amd64, arm64, latest, all)"
        exit 1
      fi
      shift
      ;;
    *)
      echo "❌ Unknown flag: $1"
      echo "Usage: $0 [--ui] [--backend] [--github] [--arch <amd64|arm64|latest|all>]"
      exit 1
      ;;
  esac
done

if ! $DEPLOY_UI && ! $DEPLOY_BACKEND && ! $PUSH_GITHUB; then
  DEPLOY_UI=true
  DEPLOY_BACKEND=true
fi

if $PUSH_GITHUB && ! $DEPLOY_UI && ! $DEPLOY_BACKEND; then
  git pull origin main
  read -p "📥 Enter commit message, are there any changes to the application? : " commit_message
  git add .
  git commit -m "$commit_message"
  git push origin main
  exit 0
fi

function deploy_ui() {
  cd /Users/stefan.kumarasinghe/Documents/CodeMasterPro/ui
  bash build_deploy.sh
  if $PUSH_GITHUB; then
    git pull origin main
    git add .
    read -p "📥 Enter commit message, are there any changes to the ui? : " commit_message
    git commit -m "$commit_message"
    git push origin main
  fi
}

function deploy_backend() {
  echo "🔧 Deploying Backend (arch: $ARCH)..."
  cd /Users/stefan.kumarasinghe/Documents/CodeMasterPro/backend
  bash build_deploy.sh "$ARCH" || { echo "❌ Backend build failed. Exiting."; exit 1; }
  if $PUSH_GITHUB; then
    git pull origin main
    git add .
    read -p "📥 Enter commit message, are there any changes to the backend? : " commit_message
    git commit -m "$commit_message"
    git push origin main
  fi
}

$DEPLOY_UI && deploy_ui
$DEPLOY_BACKEND && deploy_backend


echo "✅ Done."
