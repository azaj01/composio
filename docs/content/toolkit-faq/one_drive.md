## OneDrive Toolkit — FAQ

## Why am I getting 404 on `ONE_DRIVE_DOWNLOAD_FILE` for my shared file?
Cause: items shown in "Shared" may be references to files that live in a SharePoint site (not actual files in the user's OneDrive). Those referenced items cannot be downloaded via the OneDrive item endpoints.

Fix:
- Open the file's location in OneDrive/SharePoint and choose **Copy to → My files** to create a real copy in the user's OneDrive.  
- After the copy completes, download the copied file with `ONE_DRIVE_DOWNLOAD_FILE`.

Note: if you need programmatic access to files stored in SharePoint sites, use the SharePoint APIs or ensure the file is copied into the user's OneDrive first.

