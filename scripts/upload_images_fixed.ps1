# PowerShell script to upload images to R2 via admin API
$BASE_URL = "http://localhost:6005/api/v1"

# Login as admin
$loginBody = @{
    username = "admin@aarya.com"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.access_token
if (!$token -and $loginResponse.tokens) {
    $token = $loginResponse.tokens.access_token
}

Write-Host "Logged in successfully. Token: $($token.Substring(0,20))..."

$headers = @{
    "Authorization" = "Bearer $token"
}

# Upload hero images
$heroPath = "frontend_new\public\hero"
if (Test-Path $heroPath) {
    Write-Host "`nUploading Hero images..."
    Get-ChildItem $heroPath -File | ForEach-Object {
        $filename = $_.Name
        $filepath = $_.FullName
        
        Write-Host "  Processing $filename..."
        
        # Get presigned URL
        try {
            $presignedUrl = "$BASE_URL/admin/upload/presigned-url?filename=$filename" + '&' + "folder=landing" + '&' + "content_type=image/png"
            $presignedResponse = Invoke-RestMethod -Uri $presignedUrl -Method Post -Headers $headers
            
            $uploadUrl = $presignedResponse.upload_url
            $finalUrl = $presignedResponse.final_url
            
            # Upload file to R2
            $fileBytes = [System.IO.File]::ReadAllBytes($filepath)
            Invoke-RestMethod -Uri $uploadUrl -Method Put -Body $fileBytes -ContentType "image/png" | Out-Null
            
            Write-Host "    Success - Uploaded to: $finalUrl"
        } catch {
            Write-Host "    Failed: $_"
        }
    }
}

# Upload collection images
$collectionsPath = "frontend_new\public\collections"
if (Test-Path $collectionsPath) {
    Write-Host "`nUploading Collection images..."
    Get-ChildItem $collectionsPath -File | ForEach-Object {
        $filename = $_.Name
        $filepath = $_.FullName
        
        Write-Host "  Processing $filename..."
        
        try {
            $presignedUrl = "$BASE_URL/admin/upload/presigned-url?filename=$filename" + '&' + "folder=categories" + '&' + "content_type=image/jpeg"
            $presignedResponse = Invoke-RestMethod -Uri $presignedUrl -Method Post -Headers $headers
            
            $uploadUrl = $presignedResponse.upload_url
            $finalUrl = $presignedResponse.final_url
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filepath)
            Invoke-RestMethod -Uri $uploadUrl -Method Put -Body $fileBytes -ContentType "image/jpeg" | Out-Null
            
            Write-Host "    Success - Uploaded to: $finalUrl"
        } catch {
            Write-Host "    Failed: $_"
        }
    }
}

# Upload product images
$productsPath = "frontend_new\public\products"
if (Test-Path $productsPath) {
    Write-Host "`nUploading Product images..."
    Get-ChildItem $productsPath -File | ForEach-Object {
        $filename = $_.Name
        $filepath = $_.FullName
        
        Write-Host "  Processing $filename..."
        
        try {
            $presignedUrl = "$BASE_URL/admin/upload/presigned-url?filename=$filename" + '&' + "folder=products" + '&' + "content_type=image/jpeg"
            $presignedResponse = Invoke-RestMethod -Uri $presignedUrl -Method Post -Headers $headers
            
            $uploadUrl = $presignedResponse.upload_url
            $finalUrl = $presignedResponse.final_url
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filepath)
            Invoke-RestMethod -Uri $uploadUrl -Method Put -Body $fileBytes -ContentType "image/jpeg" | Out-Null
            
            Write-Host "    Success - Uploaded to: $finalUrl"
        } catch {
            Write-Host "    Failed: $_"
        }
    }
}

# Upload about images
$aboutPath = "frontend_new\public\about"
if (Test-Path $aboutPath) {
    Write-Host "`nUploading About images..."
    Get-ChildItem $aboutPath -File | ForEach-Object {
        $filename = $_.Name
        $filepath = $_.FullName
        
        Write-Host "  Processing $filename..."
        
        try {
            $presignedUrl = "$BASE_URL/admin/upload/presigned-url?filename=$filename" + '&' + "folder=landing" + '&' + "content_type=image/jpeg"
            $presignedResponse = Invoke-RestMethod -Uri $presignedUrl -Method Post -Headers $headers
            
            $uploadUrl = $presignedResponse.upload_url
            $finalUrl = $presignedResponse.final_url
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filepath)
            Invoke-RestMethod -Uri $uploadUrl -Method Put -Body $fileBytes -ContentType "image/jpeg" | Out-Null
            
            Write-Host "    Success - Uploaded to: $finalUrl"
        } catch {
            Write-Host "    Failed: $_"
        }
    }
}

Write-Host "`nUpload process complete!"
