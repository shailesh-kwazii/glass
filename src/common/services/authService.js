const { BrowserWindow } = require('electron');
const userRepository = require('../repositories/user');

class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local'; // Always local now
        this.currentUser = null;
        this.hasApiKey = false;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        // Initialize with local mode only
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local';
        this.currentUser = null;
        
        // Check for initial API key state
        this.updateApiKeyStatus();
        
        this.isInitialized = true;
        console.log('[AuthService] Initialized in local-only mode.');
    }
    
    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state change:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    /**
     * Updates the internal API key status from the repository and broadcasts if changed.
     */
    async updateApiKeyStatus() {
        try {
            const user = await userRepository.getById(this.currentUserId);
            const newStatus = !!(user && user.api_key);
            if (this.hasApiKey !== newStatus) {
                console.log(`[AuthService] API key status changed to: ${newStatus}`);
                this.hasApiKey = newStatus;
                this.broadcastUserState();
            }
        } catch (error) {
            console.error('[AuthService] Error checking API key status:', error);
            this.hasApiKey = false;
        }
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        // Always return local user info since we removed Firebase
        return {
            uid: this.currentUserId, // returns 'default_user'
            email: 'contact@pickle.com',
            displayName: 'Default User',
            mode: 'local',
            isLoggedIn: false,
            hasApiKey: this.hasApiKey
        };
    }
}

const authService = new AuthService();
module.exports = authService; 