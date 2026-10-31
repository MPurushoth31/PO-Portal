# PO Request Portal on GitHub Pages (no server, no extra tools)

Everything runs in the browser. Data is stored in a PRIVATE GitHub repo. Use SAMPLE data only.

## What you need
Two GitHub repositories under your account (examples use the names below):
* `po-portal` - PUBLIC (free GitHub Pages needs a public repo). Holds this website.
* `po-portal-data` - PRIVATE. Holds the requests and master data (created automatically on first run).

## Steps
1. github.com > **+** > New repository > name `po-portal`, **Public** > Create.
2. On that page click **uploading an existing file**. Open this folder on your computer, select EVERYTHING inside it (index.html, app.js, portal-engine.js, static-api.js, config.js, setup.html, the `seed` and `assets` folders, all .css/.js files) and drag it into the browser. Click **Commit changes**.
3. Repo > **Settings > Pages** > Source: **Deploy from a branch** > Branch **main**, folder **/(root)** > Save. After ~1 minute the address shows: `https://YOUR-USERNAME.github.io/po-portal/`
4. github.com > **+** > New repository > name `po-portal-data`, **Private**, tick **Add a README file** > Create.
5. Profile photo > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token:
   * Repository access: **Only select repositories** > `po-portal-data`
   * Permissions > Repository permissions > **Contents: Read and write**
   * Expiration: longest allowed. Copy the token (shown once).
6. Your team link is: `https://YOUR-USERNAME.github.io/po-portal/#key=PASTE_TOKEN_HERE`
   Open it once on each person's browser. The browser remembers the key and removes it from the address bar. Send the link privately (Teams chat/email), never post it publicly.
7. The first person to open it seeds `po-portal-data` automatically. Then open `.../po-portal/setup.html` and change the reviewer password (default is **TCCC**).

## If your data repo has another name
Edit `config.js` in `po-portal` and set `dataRepo: 'yourname/your-repo'`.

## Good to know
* Anyone with the team link can read and change the data. This edition is for demos / sample data.
* When the token expires, create a new one and send a new link (old browsers will ask for the new key).
* GitHub limits: normal use by 10-20 people is fine. Two people saving at the same second are handled automatically (one retry).
* Not available in this edition: OneDrive/Excel sync and opening desktop Outlook drafts (the email draft downloads as an .eml file instead).
* The `seed` folder is public. Replace its JSON files with sample data before uploading if the originals contain real company data.
