npm run build
if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi
echo "Build successful. Deploying to gh-pages..."
aws s3 sync ./out s3://stefan-tars
if [ $? -ne 0 ]; then
    echo "Deployment failed. Exiting."
    exit 1
fi
echo "Deployment successful."
aws cloudfront create-invalidation --distribution-id E12UJGPNOTUYN2 --paths "/*"
if [ $? -ne 0 ]; then
    echo "CloudFront invalidation failed. Exiting."
    exit 1
fi
echo "CloudFront invalidation successful. Deployment complete."
echo "You can now access the site at https://dwr4zchmi6x24.cloudfront.net/"