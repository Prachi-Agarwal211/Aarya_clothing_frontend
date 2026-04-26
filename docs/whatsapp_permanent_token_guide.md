# Guide: Obtaining a Permanent WhatsApp Cloud API Token

Meta Cloud API access tokens usually expire in 24 hours. For a production backend, you must generate a **System User Access Token**, which can be set to **Never Expire**.

## Step 1: Create a System User
1.  Go to the [Meta Business Settings](https://business.facebook.com/settings/).
2.  Ensure you have selected the correct **Business Portfolio**.
3.  In the left sidebar, navigate to **Users** > **System Users**.
4.  Click **Add**.
5.  Enter a name (e.g., `Aarya_Backend_User`) and select **Admin** as the System User Role.
6.  Click **Create System User**.

## Step 2: Assign Assets to the System User
The system user needs permission to manage your App and your WhatsApp Business Account.
1.  Select the system user you just created.
2.  Click **Assign Assets**.
3.  **Assign App**:
    *   Select **Apps** in the left column.
    *   Select your WhatsApp-enabled Meta App.
    *   Toggle on **Full Control** (Manage App).
    *   Click **Save Changes**.
4.  **Assign WhatsApp Business Account (WABA)**:
    *   Click **Assign Assets** again.
    *   Select **WhatsApp Accounts** in the left column.
    *   Select your WhatsApp Business Account.
    *   Toggle on **Full Control** (Manage WhatsApp Business Account).
    *   Click **Save Changes**.

## Step 3: Generate the Permanent Token
1.  While still on the **System Users** page with your user selected, click **Generate New Token**.
2.  Select your **App** from the dropdown.
3.  **Token Expiration**: Select **Never** (Critical!).
4.  **Permissions**: You must check at least these two:
    *   `whatsapp_business_messaging`
    *   `whatsapp_business_management`
5.  Click **Generate Token**.
6.  **Copy and save this token immediately.** Meta will only show it once.

## Step 4: Update Environment Variables
Paste the token into your `.env` file:
```env
WHATSAPP_ACCESS_TOKEN=your_new_permanent_token_here
```

## Step 5: Verify the Token
Run the provided verification script to ensure everything is connected:
```bash
python scripts/verify_whatsapp_token.py
```
