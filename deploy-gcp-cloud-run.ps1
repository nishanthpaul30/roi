# Google Cloud Run PowerShell Deployment Script
$PROJECT_ID = (gcloud config get-value project 2>$null)
$REGION = "us-central1"
$SERVICE_NAME = "git-kpi-dashboard"
$BUCKET_NAME = "$PROJECT_ID-git-kpi-data"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/${SERVICE_NAME}:latest"

if (-not $PROJECT_ID) {
    Write-Error "❌ Error: No active GCP project found. Run 'gcloud config set project YOUR_PROJECT_ID' first."
    exit 1
}

Write-Host "🚀 Starting Google Cloud Run deployment for Project: $PROJECT_ID ($REGION)..." -ForegroundColor Green

Write-Host "📦 Enabling required APIs (Cloud Run, Cloud Build, Storage FUSE)..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com storage.googleapis.com

Write-Host "🪣 Checking Google Cloud Storage bucket: gs://$BUCKET_NAME ..." -ForegroundColor Yellow
$bucketExists = gcloud storage buckets describe "gs://$BUCKET_NAME" 2>$null
if (-not $bucketExists) {
    Write-Host "Creating GCS bucket..." -ForegroundColor Yellow
    gcloud storage buckets create "gs://$BUCKET_NAME" --location="$REGION"
}

Write-Host "📄 Syncing ai_usage_data.csv to GCS bucket..." -ForegroundColor Yellow
gcloud storage cp ai_usage_data.csv "gs://$BUCKET_NAME/ai_usage_data.csv" --no-clobber

Write-Host "🏗️ Building container image via Google Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --tag "$IMAGE_NAME"

Write-Host "☁️ Deploying to Google Cloud Run..." -ForegroundColor Yellow
gcloud run deploy "$SERVICE_NAME" `
  --image="$IMAGE_NAME" `
  --region="$REGION" `
  --platform=managed `
  --allow-unauthenticated `
  --execution-environment=gen2 `
  --add-volume=name=kpi-data,type=cloud-storage,bucket="$BUCKET_NAME" `
  --add-volume-mount=volume=kpi-data,mount-path=/app/data `
  --set-env-vars="CSV_FILE_PATH=/app/data/ai_usage_data.csv"

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
