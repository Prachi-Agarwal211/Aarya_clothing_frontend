import os
import requests
import mimetypes

BASE_URL = "http://localhost:6005/api/v1"
# Assuming default admin credentials from init.sql or we might need to check database
# If login fails, we'll need to figure out the admin credentials

def upload_images():
    print("Logging in...")
    # Let's try the default admin login
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@aaryaclothing.com",
        "password": "adminpassword"
    })
    
    # If the above fails, let's try another common default
    if login_res.status_code != 200:
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@example.com",
            "password": "password"
        })
        
    if login_res.status_code != 200:
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@test.com",
            "password": "password123"
        })

    if login_res.status_code != 200:
        print(f"Failed to login: {login_res.text}")
        return

    token = login_res.json().get("access_token")
    if not token and "tokens" in login_res.json():
        token = login_res.json()["tokens"]["access_token"]
        
    headers = {"Authorization": f"Bearer {token}"}

    dirs = {
        "landing": [
            "frontend_new/public/hero",
            "frontend_new/public/about"
        ],
        "categories": ["frontend_new/public/collections"],
        "products": ["frontend_new/public/products"]
    }

    # API uses these folders: "landing", "banners", "categories", "products", "inventory"
    folder_mapping = {
        "hero": "landing",
        "about": "landing",
        "collections": "categories",
        "products": "products"
    }

    for base_folder in ["hero", "collections", "about", "products"]:
        path = f"frontend_new/public/{base_folder}"
        api_folder = folder_mapping[base_folder]
        
        if not os.path.exists(path):
            print(f"Path not found: {path}")
            continue
            
        print(f"\nProcessing {path} -> R2 folder: {api_folder}")
        for filename in os.listdir(path):
            filepath = os.path.join(path, filename)
            if not os.path.isfile(filepath):
                continue
                
            content_type, _ = mimetypes.guess_type(filename)
            if not content_type:
                content_type = "image/jpeg"
                
            print(f"Requesting presigned URL for {filename}...")
            # Note: the admin endpoint expects a specific folder name via regex: ^(landing|banners|categories|products|inventory)$
            # But the existing R2 URLs we saw were like `/hero/hero1.png`. 
            # If the backend is expecting them in `landing`, we should use `landing` but rename the file to include the subfolder if necessary, 
            # OR we just let it upload to `landing/` or `categories/` etc.
            # Wait, the current landing page data expects:
            # "https://pub-....r2.dev/hero/hero1.png"
            # "https://pub-....r2.dev/about/kurti1.jpg"
            # "https://pub-....r2.dev/collections/kurtis.jpg"
            # This means the R2 bucket literally has folders 'hero', 'about', 'collections'.
            # BUT the presigned URL endpoint strictly validates: Query("landing", regex="^(landing|banners|categories|products|inventory)$")
            # We'll just upload to the root of those allowed folders for now, or if the user wants us to recreate exact paths, we'll bypass the strict folder check or update the DB.
            # Actually, the user says "try uploading through admin portal". The admin portal uses `/api/v1/admin/upload/presigned-url` which forces those folders.
            
            # For this script, we'll upload to whatever folder is allowed by the regex
            # and we'll use the API to get the presigned URL.
            
            presigned_res = requests.post(
                f"{BASE_URL}/admin/upload/presigned-url",
                params={"filename": filename, "folder": api_folder, "content_type": content_type},
                headers=headers
            )
            
            if presigned_res.status_code != 200:
                print(f"  Failed presigned URL: {presigned_res.text}")
                continue
                
            upload_data = presigned_res.json()
            upload_url = upload_data["upload_url"]
            final_url = upload_data["final_url"]
            
            print(f"  Uploading {filename}...")
            with open(filepath, "rb") as f:
                put_res = requests.put(upload_url, data=f, headers={"Content-Type": content_type})
                
            if put_res.status_code == 200:
                print(f"  Success -> {final_url}")
            else:
                print(f"  Failed upload: {put_res.status_code} {put_res.text}")

if __name__ == "__main__":
    upload_images()
