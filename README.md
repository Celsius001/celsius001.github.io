# Celsius-001

Celsius-001 is a static, browser-based web app. The repository contains HTML, CSS, JavaScript, a service worker, and prebuilt client bundles. There is no build command or server-side application in this repository.

## Run locally

Use a local HTTP server so the service worker can register:

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080> in a modern browser. Stop the server with `Ctrl+C`.

Do not open `index.html` directly from the filesystem. Service workers and some browser APIs require HTTP or HTTPS.

## External services

The app uses services outside this repository:

- Firebase Authentication and Firestore for accounts, chat, and saved data.
- The Mercury Workshop Epoxy Wisp endpoint for proxy transport.
- External AniList, Deezer, game-library CDN, and TMDB proxy endpoints for content.
- Vercel-hosted API endpoints used by the AI and watch features.

The Firebase web configuration is already present in the client scripts. Before deploying, verify that your Firebase project allows the deployed domain in Authentication settings and that Firestore rules are configured for your use case. Client-side Firebase configuration is not a substitute for Firestore security rules.

## Deploy

All platforms below can host this repository as a static site. In each case, deploy the repository root as-is and leave the build command empty.

### Render Static Site

1. Create a **Static Site** in the Render dashboard.
2. Connect this repository and select the branch to deploy.
3. Set **Build Command** to empty (or `true`).
4. Set **Publish Directory** to `.`.
5. Create the site.

### Vercel

1. Import the repository in Vercel.
2. Select **Other** as the framework preset.
3. Leave the build command empty.
4. Set the output directory to `.` if Vercel asks for one.
5. Deploy.

### Netlify

1. Add a new site from Git and select this repository.
2. Leave **Build command** empty.
3. Set **Publish directory** to `.`.
4. Deploy the site.

### GitHub Pages

1. Open the repository's **Settings > Pages**.
2. Choose **Deploy from a branch**.
3. Select the branch and the `/ (root)` folder.
4. Save and wait for the deployment.

For a project site hosted below a path such as `/celsius001.github.io/`, test navigation carefully because several app links and the service worker use root-relative paths. A custom domain or user-site deployment is the simplest setup.

### Cloudflare Pages

1. Create a Pages project and connect this repository.
2. Leave the build command empty.
3. Set the build output directory to `.`.
4. Deploy.

### AWS S3 and CloudFront

1. Create an S3 bucket configured for static website hosting, or use CloudFront with an S3 origin.
2. Upload the repository contents while preserving the directory structure.
3. Configure `index.html` as the default root document and `404.html` as the error document.
4. Serve the site through HTTPS. HTTPS is required for service workers outside `localhost`.
5. Ensure `sw.js` and JavaScript files are served with normal JavaScript MIME types. If using CloudFront, invalidate the cache after replacing the service worker.

### Firebase Hosting

Firebase Hosting is also suitable because the app already uses Firebase services:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

Choose the repository root as the public directory and do not enable a single-page-app rewrite. Then deploy:

```bash
firebase deploy --only hosting
```

## Deployment checklist

- Confirm the deployed site uses HTTPS.
- Confirm `/sw.js` is reachable from the site root.
- Add the deployed hostname to Firebase Authentication's authorized domains.
- Check Firebase Firestore rules before enabling account or chat features.
- Confirm external API endpoints permit requests from the deployed origin.
- Test sign-in, chat, games, watch, and the proxy transport after deployment.

## Limitations

This repository does not include the AI backend, TMDB backend, Wisp transport server, or any Firebase server credentials. Deploying the static files alone will not replace those services. A platform that only provides static hosting is supported for the frontend; a custom server is only needed if you decide to move one of those external services into this repository.
