# Publishing MedArena

How the site gets to GitHub Pages, and what the admin panel can and cannot do.

---

## The short version

You edit on your laptop. You publish by pushing. GitHub serves the result.

```
  your laptop                          GitHub Pages
  -----------                          ------------
  admin panel (localhost:8600/admin)   index.html
  admin-server.py                      surgery-practice.html
        |                              auth.js, auth.css
        |  edits the HTML files        cee-img/
        v
  index.html, surgery-practice.html
        |
        |  publish.bat  (commit + push)
        v
  GitHub repo  --------------------->  yoursite.github.io
```

The admin panel writes to the HTML files on your disk. It never talks to GitHub.
`publish.bat` takes whatever is on disk and pushes it. That is the whole link
between the two.

---

## One-time setup

You need a GitHub repo. If you do not have one yet:

1. Go to <https://github.com/new>
2. Name it, for example `medarena`
3. Keep it **Public** (Pages is free for public repos)
4. Do **not** add a README, .gitignore or licence; you already have files
5. Create it

Then, in this folder, run these once. Replace `YOURNAME` and `medarena`:

```
git init
git add -A
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOURNAME/medarena.git
git push -u origin main
```

Git will ask you to sign in the first time. Use a Personal Access Token as the
password: <https://github.com/settings/tokens> -> Generate new token (classic)
-> tick `repo` -> copy it. Paste it when git asks for a password.

Then turn Pages on:

1. Repo -> **Settings** -> **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. **Save**

Your site appears at `https://YOURNAME.github.io/medarena/` in about a minute.

---

## Everyday use

1. Start the server: `start-admin.bat` (or `python admin-server.py`)
2. Open <http://localhost:8600/admin>, sign in
3. Edit. Save. The files on disk change.
4. Close the admin panel
5. Double-click **`publish.bat`**
6. Wait ~1 minute, then Ctrl+F5 on your live site

That is it. `publish.bat` shows you exactly which files changed before it
commits, and refuses to push if the commit fails.

---

## What is published and what is not

`.gitignore` controls this. These never leave your laptop:

| File | Why |
| --- | --- |
| `medarena-users.json` | Real e-mails, password hashes, live session tokens |
| `admin-auth.json` | Your admin password hash |
| `auth-config.json` | Google OAuth client id |
| `backups/` | Every pre-edit copy, hundreds of MB |
| `admin.html` | The editor; useless without the server |
| `admin-server.py` | Python; Pages cannot run it |
| `surgery-practice.html.bak` | Old snapshot |
| `ortho-bank.json`, `ent-bank.json`, `forensic-bank.json`, `surgery-part2.js` | Leftovers; questions are embedded in the HTML |

Published: `index.html`, `surgery-practice.html`, `auth.js`, `auth.css`,
`pdf.min.js`, `pdf.worker.min.js`, `daily-concept.json`, `cee-img/`, and the
four `CEE Model Exam Set *.md` documents.

Total is about 49 MB. GitHub Pages allows 1 GB, so there is plenty of room.

---

## What works on the live site

| Feature | On GitHub Pages |
| --- | --- |
| Homepage, all 18 bank cards | Works |
| Practice page, all 12,077 questions | Works |
| Grading, explanations, figures | Works |
| Progress saved in the browser | Works |
| Sign in / sign up / progress sync | **Does not work** |
| Concept of the Day editing | Local only (the card itself shows) |
| Admin panel | **Local only** |

The homepage cards are now written into `index.html` itself, so they render
even though there is no `/api/banks` on Pages. If you add a bank in the admin
panel, re-run the card generator or edit the cards by hand, otherwise the new
bank will be in the practice page but not on the homepage.

---

## The honest limit: accounts need a server

Sign-in, sign-up and progress sync all need `admin-server.py`. GitHub Pages
serves files and runs nothing, so on the live site:

- the sign-in dialog opens and says **"Server not detected"**
- progress is kept in the visitor's browser only
- nothing is lost, but nothing is shared between devices either

This is not a bug to fix. It is what static hosting is.

### If you want accounts on the live site

Two real options.

**Option A - host the server somewhere.** Render, Railway or Fly.io can run
`admin-server.py`. You would get real accounts on the public site. It needs a
`requirements.txt`, a start command, and a persistent disk for
`medarena-users.json` (free tiers usually wipe the disk on redeploy). The admin
password you set already protects the panel, so this is safe to expose now.

**Option B - keep it local.** Students practise without an account, progress
stays on their device. Zero cost, zero maintenance. This is what you have today.

### Linking the live site to your local server

You asked for this. It is worth being precise about why it does not work:

- Your laptop is not reachable from the internet. It has no public address.
- A tunnel (`cloudflared`, `ngrok`) could give it one, but then **your laptop
  must stay on, awake, and running the server** for anyone to sign in.
- The live site is HTTPS. A browser will not let an HTTPS page call an HTTP
  server, so the tunnel would need HTTPS too.
- The server sends no CORS headers, so the browser would block the responses
  even with a tunnel in place.

So it is possible, but it means: laptop always on, tunnel always running, CORS
added to the server, and a URL that changes every time you restart the tunnel
(unless you pay). For a site students use at random hours, Option A is the
honest answer.

---

## If something goes wrong

**The live site did not change.** Wait another minute, then Ctrl+F5. Check
Actions on GitHub for a failed build.

**A page 404s.** Pages is case-sensitive. `Index.html` is not `index.html`.

**I published my users file by accident.** Check `git ls-files | findstr users`.
If it is there, remove it: `git rm --cached medarena-users.json`, commit, push.
Then change every password in it, because it was public.

**I want to undo a publish.** `git log --oneline` to find the commit before it,
then `git revert <sha>` and push.

**The admin panel will not let me in.** The password is in `admin-auth.json`.
Forgot it? Delete that file and restart the server; it will ask you to set a
new one.
