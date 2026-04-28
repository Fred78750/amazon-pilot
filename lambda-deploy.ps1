# ════════════════════════════════════════════════════════════
# Amazon Pilot — Deploy Lambda + API Gateway + S3 imports
# À exécuter depuis C:\AmazonPilot\ dans PowerShell
# Durée estimée : 5-10 minutes
# ════════════════════════════════════════════════════════════

$REGION        = "eu-west-3"
$ACCOUNT_ID    = (aws sts get-caller-identity --query Account --output text)
$LAMBDA_NAME   = "amazon-pilot-imports"
$BUCKET_IMPORTS= "amazon-pilot-imports-foliow"
$BUCKET_APP    = "amazon-pilot-foliow"
$DISTRIB_ID    = "E3ERL241475BJI"
$ROLE_NAME     = "amazon-pilot-lambda-role"

Write-Host "Account ID : $ACCOUNT_ID"
Write-Host "Region     : $REGION"
Write-Host ""

# ── ÉTAPE 1 : Bucket S3 imports ─────────────────────────────
Write-Host "1/7 Création bucket S3 imports..."
aws s3api create-bucket `
  --bucket $BUCKET_IMPORTS `
  --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION 2>$null

# Bloquer l'accès public (sécurité)
aws s3api put-public-access-block `
  --bucket $BUCKET_IMPORTS `
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Lifecycle : supprimer les fichiers après 7 jours
aws s3api put-bucket-lifecycle-configuration `
  --bucket $BUCKET_IMPORTS `
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "delete-after-7-days",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "Expiration": {"Days": 7}
    }]
  }'

Write-Host "   ✓ Bucket $BUCKET_IMPORTS créé"

# ── ÉTAPE 2 : Rôle IAM pour Lambda ──────────────────────────
Write-Host "2/7 Création rôle IAM Lambda..."
$TRUST_POLICY = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
$ROLE_ARN = (aws iam create-role `
  --role-name $ROLE_NAME `
  --assume-role-policy-document $TRUST_POLICY `
  --query 'Role.Arn' --output text 2>$null)

if (-not $ROLE_ARN) {
  $ROLE_ARN = (aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
  Write-Host "   Role existant, réutilisation."
}

# Politique S3 pour la Lambda
$S3_POLICY = "{
  `"Version`": `"2012-10-17`",
  `"Statement`": [{
    `"Effect`": `"Allow`",
    `"Action`": [`"s3:GetObject`",`"s3:PutObject`",`"s3:ListBucket`",`"s3:DeleteObject`"],
    `"Resource`": [`"arn:aws:s3:::$BUCKET_IMPORTS`",`"arn:aws:s3:::$BUCKET_IMPORTS/*`"]
  },{
    `"Effect`": `"Allow`",
    `"Action`": [`"logs:CreateLogGroup`",`"logs:CreateLogStream`",`"logs:PutLogEvents`"],
    `"Resource`": `"arn:aws:logs:*:*:*`"
  }]
}"

aws iam put-role-policy `
  --role-name $ROLE_NAME `
  --policy-name "amazon-pilot-s3-policy" `
  --policy-document $S3_POLICY

# Attendre propagation IAM
Write-Host "   En attente propagation IAM (15s)..."
Start-Sleep -Seconds 15
Write-Host "   ✓ Rôle $ROLE_ARN"

# ── ÉTAPE 3 : Package Lambda ─────────────────────────────────
Write-Host "3/7 Packaging Lambda..."
Set-Location C:\AmazonPilot\lambda
if (-not (Test-Path "C:\AmazonPilot\lambda")) { New-Item -ItemType Directory -Path "C:\AmazonPilot\lambda" }
Copy-Item "C:\AmazonPilot\lambda-src\index.mjs" "C:\AmazonPilot\lambda\index.mjs"

# Installer @aws-sdk/s3-request-presigner (non inclus dans le runtime Lambda)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --prefix C:\AmazonPilot\lambda --save 2>$null

# Zipper
Compress-Archive -Path "C:\AmazonPilot\lambda\*" -DestinationPath "C:\AmazonPilot\lambda.zip" -Force
Write-Host "   ✓ lambda.zip créé"

# ── ÉTAPE 4 : Déployer Lambda ────────────────────────────────
Write-Host "4/7 Déploiement Lambda..."
$LAMBDA_ARN = (aws lambda create-function `
  --function-name $LAMBDA_NAME `
  --runtime nodejs22.x `
  --role $ROLE_ARN `
  --handler index.handler `
  --zip-file fileb://C:\AmazonPilot\lambda.zip `
  --environment "Variables={IMPORTS_BUCKET=$BUCKET_IMPORTS}" `
  --timeout 30 `
  --memory-size 256 `
  --query 'FunctionArn' --output text 2>$null)

if (-not $LAMBDA_ARN) {
  # Mise à jour si existe
  aws lambda update-function-code `
    --function-name $LAMBDA_NAME `
    --zip-file fileb://C:\AmazonPilot\lambda.zip
  $LAMBDA_ARN = (aws lambda get-function --function-name $LAMBDA_NAME --query 'Configuration.FunctionArn' --output text)
  Write-Host "   Lambda mise à jour."
}
Write-Host "   ✓ Lambda : $LAMBDA_ARN"

# ── ÉTAPE 5 : URL Lambda (Function URL) ─────────────────────
Write-Host "5/7 Création Function URL..."
$FUNC_URL = (aws lambda create-function-url-config `
  --function-name $LAMBDA_NAME `
  --auth-type NONE `
  --cors '{
    "AllowOrigins":["https://amazon.foliow.app"],
    "AllowMethods":["GET","POST","OPTIONS"],
    "AllowHeaders":["Content-Type"]
  }' `
  --query 'FunctionUrl' --output text 2>$null)

if (-not $FUNC_URL) {
  $FUNC_URL = (aws lambda get-function-url-config --function-name $LAMBDA_NAME --query 'FunctionUrl' --output text)
}

# Permission accès public Function URL
aws lambda add-permission `
  --function-name $LAMBDA_NAME `
  --statement-id FunctionURLPublicAccess `
  --action lambda:InvokeFunctionUrl `
  --principal "*" `
  --function-url-auth-type NONE 2>$null

Write-Host "   ✓ Function URL : $FUNC_URL"

# ── ÉTAPE 6 : CloudFront — ajouter /api/* → Lambda ──────────
Write-Host "6/7 Configuration CloudFront /api/*..."

# Récupérer la config actuelle
$CF_ETAG = (aws cloudfront get-distribution-config --id $DISTRIB_ID --query 'ETag' --output text)
aws cloudfront get-distribution-config --id $DISTRIB_ID --query 'DistributionConfig' > C:\AmazonPilot\cf-config.json

# NOTE : l'ajout de l'origine Lambda à CloudFront nécessite une modification manuelle
# de cf-config.json — voir instructions ci-dessous
Write-Host "   ⚠ Voir étape 6 manuelle ci-dessous"
Write-Host "   ETag actuel : $CF_ETAG"

# ── ÉTAPE 7 : Résumé ────────────────────────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════"
Write-Host "✅ Déploiement terminé !"
Write-Host ""
Write-Host "Bucket imports : s3://$BUCKET_IMPORTS"
Write-Host "Lambda ARN     : $LAMBDA_ARN"
Write-Host "Function URL   : $FUNC_URL"
Write-Host ""
Write-Host "ÉTAPE 6 MANUELLE — CloudFront /api/* :"
Write-Host "Dans Amazon Pilot → Agent Import, entrez cette URL API :"
Write-Host $FUNC_URL
Write-Host "(Le sous-domaine /api viendra dans un second temps via CloudFront)"
Write-Host "════════════════════════════════════════"
