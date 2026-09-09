# Google Cloud Run Deployment Script
# Run this script using Google Cloud SDK (gcloud CLI)

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="us-central1"
SERVICE_NAME="git-kpi-dashboard"
BUCKET_NAME="${PROJECT_ID}-git-kpi-data"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No active GCP project found. Please run 'gcloud config set project YOUR_PROJECT_ID' first."
  exit 1
fi

echo "🚀 Starting Google Cloud Run deployment for Project: $PROJECT_ID ($REGION)..."

# 1. Enable required Google Cloud APIs
echo "📦 Enabling required APIs (Cloud Run, Cloud Build, Storage FUSE)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com storage.googleapis.com

# 2. Create GCS Bucket if it doesn't exist
echo "🪣 Checking Google Cloud Storage bucket: gs://$BUCKET_NAME ..."
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" >/dev/null 2>&1; then
  echo "Creating GCS bucket..."
  gcloud storage buckets create "gs://$BUCKET_NAME" --location="$REGION"
fi

# 3. Upload initial ai_usage_data.csv if not present in bucket
echo "📄 Syncing ai_usage_data.csv to GCS bucket..."
gcloud storage cp ai_usage_data.csv "gs://$BUCKET_NAME/ai_usage_data.csv" --no-clobber

# 4. Build image using Cloud Build
echo "🏗️ Building container image via Google Cloud Build..."
gcloud builds submit --tag "$IMAGE_NAME"

# 5. Deploy to Cloud Run with GCS volume mount
echo "☁️ Deploying to Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_NAME" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --execution-environment=gen2 \
  --add-volume=name=kpi-data,type=cloud-storage,bucket="$BUCKET_NAME" \
  --add-volume-mount=volume=kpi-data,mount-path=/app/data \
  --set-env-vars="CSV_FILE_PATH=/app/data/ai_usage_data.csv"

echo "✅ Deployment completed successfully!"
