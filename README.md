# 📚 Tahli's Library

A beautiful, mobile-first web application for tracking your book collection and which covers you own.

## Features

- 📱 **Mobile-first design** - Perfect for adding books on the go
- 🔍 **Smart book search** - Powered by Open Library API
- 📊 **Collection stats** - Track total books and cover ownership
- 🎨 **Beautiful UI** - Library-inspired color scheme
- 💾 **Persistent storage** - All data saved to JSON database
- 🌐 **Cross-device sync** - Access from phone, tablet, or desktop

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser to `http://localhost:3000`

## Deployment Options

### Option 1: Render (Recommended - Free & Easy)

1. Create a free account at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: tahlis-library
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click "Create Web Service"
6. Done! Your app will be live at `https://tahlis-library.onrender.com`

**Note**: The free tier sleeps after inactivity, so first load may take 30 seconds.

### Option 2: Railway

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway auto-detects Node.js and deploys
6. Get your URL from the deployment

### Option 3: Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create tahlis-library`
4. Deploy: `git push heroku main`
5. Open: `heroku open`

### Option 4: DigitalOcean App Platform

1. Create account at [digitalocean.com](https://www.digitalocean.com)
2. Go to Apps → Create App
3. Connect GitHub repository
4. Configure build settings (auto-detected)
5. Deploy!

## How It Works

### Database
- Uses a simple `library.json` file for storage
- Perfect for single-user applications
- Data persists between restarts
- Easy to backup (just copy the file!)

### API Integration
- Searches books using Open Library API
- Fetches book covers automatically
- No API key required

### File Structure
```
tahlis-library/
├── server.js           # Express backend
├── library.json        # Database (created automatically)
├── package.json        # Dependencies
└── public/
    ├── index.html      # Frontend HTML
    └── app.js          # Frontend JavaScript
```

## Usage

### Adding Books
1. **Search**: Type a book title in the search box, select from results
2. **Manual**: Fill out the form manually if the book isn't found

### Tracking Covers
- Toggle "Have Cover" / "Need Cover" for each book
- See stats at a glance
- Filter by cover status

### Deleting Books
- Click "Delete" on any book card
- Confirmation required to prevent accidents

## Customization

### Colors
Edit the CSS variables in `public/index.html`:
```css
:root {
    --primary: #8B4513;        /* Main brown */
    --background: #FFF8DC;     /* Cream background */
    --surface: #FFFFFF;        /* Card background */
    /* etc... */
}
```

### Port
Change the port in `server.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

## Backup Your Data

Your entire library is stored in `library.json`. To backup:

```bash
# Make a backup
cp library.json library-backup.json

# Or download via your hosting provider's dashboard
```

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: JSON file storage
- **Frontend**: Vanilla JavaScript (no frameworks!)
- **API**: Open Library
- **Styling**: Pure CSS with CSS Variables

## Support

If you run into issues:
1. Check the console for errors (`F12` in browser)
2. Verify `library.json` has proper permissions
3. Ensure port 3000 is available (or change it)

## License

MIT - This is your gift! Customize it however you want.

---

Made with ❤️ for Tahli's Christmas 2024
