uglifyjs:
	for n in `ls -1 *.js | grep -v ".min."`; do uglifyjs.terser -m -c -o `echo $$n | sed -e "s/\.js$$/.min.js/"` $$n; done

deploy-bleeding:
	aws s3 sync --exclude "*" --include "*.css" --include "*.html" --include "*.js" . s3://${WIDGETS_BLEEDING_S3_BUCKET}/
	aws cloudfront create-invalidation --distribution-id ${WIDGETS_BLEEDING_DISTRIBUTION_ID} --paths "/*"

deploy-prod:
	aws s3 sync --exclude "*" --include "*.css" --include "*.html" --include "*.js" . s3://${WIDGETS_PROD_S3_BUCKET}/
	aws cloudfront create-invalidation --distribution-id ${WIDGETS_PROD_DISTRIBUTION_ID} --paths "/*"

# vim: noet
