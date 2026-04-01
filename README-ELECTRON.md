# Curriculum Checker & Payables System - Desktop App

This is an Electron desktop application for managing curriculum checking and student payables.

## Development

### Prerequisites
- Node.js (v20.15.1 or higher)
- npm

### Running in Development Mode

1. **Start the development server and Electron app:**
   ```bash
   npm run electron-dev
   ```

   This will:
   - Start the Vite development server
   - Wait for the server to be ready
   - Launch the Electron app

2. **Or run them separately:**
   ```bash
   # Terminal 1: Start Vite dev server
   npm run dev
   
   # Terminal 2: Start Electron (after Vite is ready)
   npm run electron
   ```

## Building for Production

### Build for Current Platform
```bash
npm run dist
```

### Build for Specific Platforms

**Windows:**
```bash
npm run dist-win
```

**macOS:**
```bash
npm run dist-mac
```

**Linux:**
```bash
npm run dist-linux
```

## Available Scripts

- `npm run electron-dev` - Start development with hot reload
- `npm run electron` - Start Electron app (requires dev server running)
- `npm run dist` - Build for current platform
- `npm run dist-win` - Build for Windows
- `npm run dist-mac` - Build for macOS
- `npm run dist-linux` - Build for Linux

## App Features

- **Curriculum Checker**: Manage and track student curriculum progress
- **Student Management**: Add, edit, and manage student information
- **Payables System**: Track student payments and fees by year level
- **Offline Support**: Works offline with Firestore sync when online
- **Cross-Platform**: Works on Windows, macOS, and Linux

## File Structure

```
my-app/
├── public/
│   ├── electron.js      # Main Electron process
│   ├── preload.js       # Preload script for security
│   └── icon.png         # App icon (add your own)
├── src/                 # React app source code
├── dist/                # Built React app (generated)
└── dist-electron/       # Built Electron app (generated)
```

## Adding App Icons

To add custom app icons:

1. **Windows**: Add `icon.ico` to `public/` folder
2. **macOS**: Add `icon.icns` to `public/` folder  
3. **Linux**: Add `icon.png` (256x256 or larger) to `public/` folder

## Firebase Configuration

The app uses Firebase Firestore for data storage. Make sure your Firebase configuration is properly set up in `src/firebase.js`.

## Security

- Node integration is disabled for security
- Context isolation is enabled
- Preload script provides secure API access
- External links open in default browser

## Troubleshooting

### Common Issues

1. **Port 5173 already in use**: Kill the process using that port or change the port in vite.config.js

2. **Electron won't start**: Make sure the Vite dev server is running first

3. **Build fails**: Check that all dependencies are installed and Node.js version is compatible

### Development Tips

- Use `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) to open DevTools
- The app will automatically reload when you make changes to the React code
- Electron will restart when you make changes to `electron.js` or `preload.js` 