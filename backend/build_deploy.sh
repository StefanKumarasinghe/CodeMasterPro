#!/bin/bash

set -e

# Use the first parameter as tag, default to 'latest'
TAG="${1:-latest}"

if [ "$TAG" == "all" ]; then
    for TAG in "amd64" "arm64"
    do
        IMAGE="stefankumarasinghe/codemasterpro:${TAG}"
        echo "🚀 Building image for tag: $TAG"
        # Build and push Docker image
        docker buildx build --platform "linux/$TAG" -t "$IMAGE" . --push
        if [ $? -ne 0 ]; then
            echo "❌ Docker build failed. Exiting."
                exit 1
        fi
    done
    echo "🚀 Building image for tag: latest"
    IMAGE="stefankumarasinghe/codemasterpro:latest"
    docker buildx build --platform "linux/amd64,linux/arm64" -t "$IMAGE" . --push
    if [ $? -ne 0 ]; then
        echo "❌ Docker build failed. Exiting."
        exit 1
    fi
else
    IMAGE="stefankumarasinghe/codemasterpro:${TAG}"
    echo "🚀 Building image for tag: $TAG"
    docker buildx build --platform "linux/$TAG" -t "$IMAGE" . --push
    if [ $? -ne 0 ]; then
        echo "❌ Docker build failed. Exiting."
        exit 1
    fi
fi

echo "✅ Docker build and push successful: $IMAGE"


if [ "$TAG" != "amd64" ] && [ "$TAG" != "latest" ]; then
  echo "Invalid arch: $TAG (allowed: amd64, latest) for lightsail so will be skipped"
  exit 0
fi


# Fetch current container config
aws lightsail get-container-services \
  --region ap-southeast-2 \
  --output json | jq -r '
    .containerServices[0].currentDeployment.containers
  ' > containers.json

echo "📦 Containers config fetched."

aws lightsail get-container-services \
  --region ap-southeast-2 \
  --output json | jq -r '
    .containerServices[0].currentDeployment.publicEndpoint
  ' > public-endpoint.json

echo "🌐 Public endpoint config fetched."

# Deploy new container image
echo "🚀 Updating Lightsail container service with tag: $TAG"
aws lightsail create-container-service-deployment \
  --region ap-southeast-2 \
  --service-name codemasterpro \
  --containers file://containers.json \
  --public-endpoint file://public-endpoint.json

if [ $? -ne 0 ]; then
    echo "❌ Container service update failed. Exiting."
    rm -f containers.json public-endpoint.json
    exit 1
fi

rm -f containers.json public-endpoint.json

echo "✅ Container service updated successfully with image: $IMAGE"
