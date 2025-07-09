# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Installation
```bash
npm run setup                 # Full setup: installs dependencies, builds web frontend, and starts the app
npm install                   # Install main dependencies
cd pickleglass_web && npm install  # Install web frontend dependencies
```

### Development Workflow
```bash
npm start                     # Start development with hot reload
npm run build:renderer        # Build renderer process (header & content)
npm run build:web            # Build web frontend (Next.js)
npm run build:all            # Build both renderer and web frontend
npm run watch:renderer       # Watch renderer files for changes
```

### Production Build
```bash
npm run build                # Full production build
npm run build:win            # Windows-specific build
npm run package              # Package for distribution
npm run make                 # Create distributable packages
```

### Development Tools
```bash
npm run lint                 # Run ESLint (fix errors before committing)
node build.js --watch       # Watch mode for renderer builds
```

## Architecture Overview

Glass is an Electron-based desktop application that provides AI-powered screen capture and audio transcription capabilities. The architecture consists of:

### Core Components
- **Main Process** (`src/index.js`): Electron main process, handles window management, system integrations, and service coordination
- **Renderer Process**: Two main renderer entry points:
  - `src/app/HeaderController.js` → `public/build/header.js` (main window UI)
  - `src/app/PickleGlassApp.js` → `public/build/content.js` (content window)
- **Web Frontend** (`pickleglass_web/`): Next.js application for settings, session management, and user interface
- **Backend API** (`pickleglass_web/backend_node/`): Express.js API for data management and authentication

### Service Architecture
- **AI Services** (`src/common/ai/`): Factory pattern for AI providers (OpenAI, Gemini)
- **Audio Services** (`src/features/listen/`): Real-time audio capture and speech-to-text
- **Ask Service** (`src/features/ask/`): AI question-answering with context from screen and audio
- **Settings Service** (`src/features/settings/`): User preferences and configuration
- **Database Layer** (`src/common/repositories/`): SQLite-based data persistence

### Key Features
- **Continuous Listening**: Real-time audio capture and transcription
- **Screen Context**: Captures screen content for AI context
- **Session Management**: Tracks user sessions with transcripts and AI interactions
- **Multi-LLM Support**: OpenAI and Gemini API integration
- **Protocol Handler**: `pickleglass://` deep linking support

## Database Schema

The application uses SQLite with repositories for:
- **Users**: User profiles and API keys
- **Sessions**: Recording sessions with metadata
- **Transcripts**: Speech-to-text results
- **AI Messages**: AI responses and conversations  
- **Presets**: User-defined AI prompt templates
- **System Settings**: Application configuration

## Development Notes

### Environment Requirements
- Node.js 20.x.x (required for native dependencies)
- Python (for native module compilation)
- Build Tools for Visual Studio (Windows only)

### Key Development Patterns
- Repository pattern for data access
- Service layer for business logic
- Event-driven architecture with IPC communication
- Factory pattern for AI provider abstraction

### Build Process
- Uses esbuild for renderer process bundling
- Next.js for web frontend compilation
- Electron Builder for packaging and distribution
- Auto-updater integration for GitHub releases

### Testing Approach
Run `npm run lint` before committing to ensure code quality. The project uses ESLint for code linting.

## File Structure Context

- `src/app/`: Main application UI components
- `src/common/`: Shared services, repositories, and utilities
- `src/features/`: Feature-specific modules (ask, listen, settings)
- `src/electron/`: Electron-specific utilities (window management)
- `pickleglass_web/`: Next.js web application
- `pickleglass_web/backend_node/`: Express.js API server
- `public/`: Static assets and build output
- `dist/`: Electron build output

The application follows a modular architecture with clear separation between main process, renderer process, and web frontend concerns.