#!/bin/bash
set -e

echo "Retrieving the current version..."
version=$(npm pkg get version | tr -d '"')

echo "Updating all npm packages..."
npm update

echo "Executing the npm version script..."
npm run version

echo "Staging all modified files..."
git add .

if ! git diff --cached --quiet; then
  echo "Committing your changes..."
  git commit -m "Release $version"
else
  echo "No changes to commit."
fi

echo "Creating a tag for version $version..."
git tag -a "$version" -m "$version"

echo "Pushing the tag $version to the remote repository..."
git push origin "$version"

echo "Release process has finished."
