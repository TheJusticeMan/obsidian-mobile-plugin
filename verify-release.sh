# remove node_modules if it exists
if [ -d "node_modules" ]; then
  rm -rf node_modules
fi

# install dependencies
npm run init
