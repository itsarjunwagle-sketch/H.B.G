H.B.G. SALES MANAGER — STANDALONE STARTER PACKAGE
================================================

This is a NEW, independent project. It does not depend on the China wholesale app.

FILES
-----
index.html       Main app screen
style.css        H.B.G. visual design
app.js           App logic; configure Apps Script URL and PIN here
Code.gs          Google Apps Script backend for your HBG_DATABASE spreadsheet
manifest.json    Installable web-app settings
sw.js            Offline cache for app files
icon.svg         App icon

IMPORTANT NOTES
---------------
1. All staff must use the same published GitHub Pages URL. Do not send each person
   a separate downloaded HTML file.
2. Offline orders are stored on the device that entered them. They sync when online.
3. For now this starter uses one shared team PIN. It is lightweight access control,
   not individual secure staff authentication. Anyone who knows the URL and PIN can
   access the data. Do not use a public spreadsheet or publish the PIN in a public
   repository if the repository is visible to everyone.
4. Orders can be edited later from the Orders list. Edits are queued on the device
   when offline and synchronized when internet returns.
5. Order date is optional. Type it manually as YYYY-MM-DD, or leave it blank.
6. Test with dummy orders before entering real customer addresses or sales data.

A. PREPARE GOOGLE SHEETS
-----------------------
Your spreadsheet must have these exact tab names and row-1 headings:

Orders:
Order ID | Order Date | Sales Page | Customer ID | Customer Name | Address |
Quantity | Total Amount | Payment Status | Shipping Status | Staff Name |
Created At | Updated At

Customers:
Customer ID | Customer Name | Address | Total Orders | Total Clothes |
Lifetime Spending | Last Order Date

Staff and Settings tabs are not used by this version. You can leave those tabs in
place if you already created them; no staff names or settings need to be entered.
The Staff Name column remains in the Orders sheet only for compatibility and is left blank.

B. CONFIGURE GOOGLE APPS SCRIPT
--------------------------------
1. Open the spreadsheet.
2. Extensions > Apps Script.
3. Replace the contents of Code.gs with the supplied Code.gs.
4. In Apps Script, open Project Settings (gear icon).
5. Under Script Properties, add:
   SPREADSHEET_ID = the long ID between /d/ and /edit in the sheet URL
   HBG_TEAM_PIN = choose a private PIN for your staff
6. Save the project.
7. Deploy > New deployment > select Web app.
8. Execute as: Me.
9. Who has access: Anyone.
10. Deploy and authorize the requested permissions.
11. Copy the Web App URL ending in /exec.

C. CONFIGURE THE FRONTEND
-------------------------
1. Open app.js in a text editor.
2. Replace:
   PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE
   with the copied /exec URL.
3. Replace CHANGE_THIS_PIN with the same HBG_TEAM_PIN value.
4. Save app.js.

CAUTION: If you use a public GitHub repository, the PIN will be visible in app.js.
For a trusted small team only, consider a private GitHub repository with Pages access
supported by your GitHub plan. The PIN is not a substitute for real user authentication.

D. PUBLISH ON GITHUB PAGES
--------------------------
1. Create a new repository, e.g. hbg-sales-manager.
2. Upload all files in this folder to the repository root (not the ZIP itself).
3. Repository Settings > Pages.
4. Choose Deploy from a branch.
5. Select main and /(root), then Save.
6. Wait for GitHub Pages to publish the site.
7. Open the published URL on iPhone Safari.
8. Share that URL with staff. On iPhone: Share > Add to Home Screen.

E. OFFLINE USE
--------------
Open the app once while online so the service worker can cache its files.
Orders entered offline are held in IndexedDB on that device. Keep the browser data
and app installation intact until the pending queue shows zero. Then tap Sync now.
Each device has its own offline queue; staff must reconnect to send their queued orders.

F. TEST CHECKLIST
-----------------
[ ] Configure Script Properties
[ ] Deploy Apps Script
[ ] Paste URL and PIN into app.js
[ ] Publish to GitHub Pages
[ ] Open app and confirm the dashboard loads
[ ] Create one dummy order online
[ ] Confirm it appears in Orders sheet
[ ] Try one dummy offline order and sync it later
[ ] Confirm report totals

TROUBLESHOOTING
----------------
- "Incorrect team PIN": app.js TEAM_PIN must match HBG_TEAM_PIN in Script Properties.
- Orders not appearing or edits not saving: verify Apps Script deployment URL ends /exec
  and the latest deployment uses the current code. After editing Code.gs, deploy a new version.
- "Apps Script URL is not configured": edit app.js and replace the placeholder.
- Do not delete browser site data while pending orders remain.
