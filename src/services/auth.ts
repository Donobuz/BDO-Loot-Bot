import axios from 'axios';
import { shell } from 'electron';
import Store from 'electron-store';
import { DISCORD_CONFIG } from '../config/config';
import { databaseService, User } from './db';
import { HtmlTemplateService } from './htmlTemplateService';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
}

interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

interface AuthData {
  accessToken: string;
  tokenType: string;
  user: User;
  loginTime: string;
}

class AuthService {
  private authServer: any;
  private readonly AUTH_KEY = 'loot_ledger_auth';
  private store: Store;
  private htmlTemplateService: HtmlTemplateService;

  constructor() {
    this.store = new Store();
    this.htmlTemplateService = new HtmlTemplateService();
    // Initialize any needed setup
  }

  generateAuthURL(): string {
    const params = new URLSearchParams({
      client_id: DISCORD_CONFIG.CLIENT_ID,
      redirect_uri: DISCORD_CONFIG.REDIRECT_URI,
      response_type: 'code',
      scope: DISCORD_CONFIG.SCOPE,
    });

    return `${DISCORD_CONFIG.OAUTH_URL}?${params.toString()}`;
  }

  async startAuthFlow(): Promise<AuthResult> {
    return new Promise((resolve) => {
      let resolved = false; // Flag to prevent multiple resolutions

      const resolveOnce = (result: AuthResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Generate auth URL and open in browser
      const authURL = this.generateAuthURL();
      shell.openExternal(authURL);

      // Create a simple HTTP server to handle the callback
      this.authServer = require('http').createServer(async (req: any, res: any) => {
        const parsedUrl = require('url').parse(req.url, true);
        
        if (parsedUrl.pathname === '/auth/discord/callback') {
          const { code, error } = parsedUrl.query;

          if (error) {
            // Handle different error types with user-friendly messages
            let userFriendlyError: string;
            let htmlMessage: string;
            
            switch (error) {
              case 'access_denied':
                userFriendlyError = 'Login was cancelled. Please try again if you want to sign in.';
                htmlMessage = this.htmlTemplateService.getAuthCancelledHtml();
                break;
              case 'invalid_request':
                userFriendlyError = 'Invalid login request. Please try again.';
                htmlMessage = this.htmlTemplateService.getAuthCancelledHtml();
                break;
              case 'unauthorized_client':
                userFriendlyError = 'App is not authorized. Please contact support.';
                htmlMessage = this.htmlTemplateService.getAuthCancelledHtml();
                break;
              case 'unsupported_response_type':
              case 'invalid_scope':
                userFriendlyError = 'Configuration error. Please contact support.';
                htmlMessage = this.htmlTemplateService.getAuthCancelledHtml();
                break;
              default:
                userFriendlyError = `Authentication failed: ${error}`;
                htmlMessage = this.htmlTemplateService.getAuthCancelledHtml();
            }

            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(htmlMessage);
            this.authServer.close();
            resolveOnce({ success: false, error: userFriendlyError });
            return;
          }

          if (code) {
            try {
              const result = await this.exchangeCodeForToken(code as string);
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(this.htmlTemplateService.getAuthSuccessHtml());
              this.authServer.close();
              resolveOnce(result);
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(this.htmlTemplateService.getAuthErrorHtml('Token exchange failed'));
              this.authServer.close();
              resolveOnce({ success: false, error: 'Token exchange failed' });
            }
          }
        }
      });

      this.authServer.listen(3000, () => {
        // Auth server started
      });

      // Shorter timeout - 2 minutes instead of 5
      const timeout = setTimeout(() => {
        if (this.authServer && this.authServer.listening) {
          this.authServer.close();
          resolveOnce({ 
            success: false, 
            error: 'Authentication timeout. Please try again.' 
          });
        }
      }, 120000); // 2 minutes

      // Clean up timeout if auth completes successfully
      this.authServer.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  private async exchangeCodeForToken(code: string): Promise<AuthResult> {
    try {
      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        DISCORD_CONFIG.TOKEN_URL,
        new URLSearchParams({
          client_id: DISCORD_CONFIG.CLIENT_ID,
          client_secret: DISCORD_CONFIG.CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: DISCORD_CONFIG.REDIRECT_URI,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, token_type } = tokenResponse.data;

      // Get user information from Discord
      const userResponse = await axios.get(DISCORD_CONFIG.USER_URL, {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      });

      const discordUser: DiscordUser = userResponse.data;

      // Store user in database
      const user = await databaseService.users.createOrUpdateUser(discordUser);

      // Store auth data locally
      const authData: AuthData = {
        accessToken: access_token,
        tokenType: token_type,
        user: user,
        loginTime: new Date().toISOString(),
      };
      (this.store as any).set(this.AUTH_KEY, authData);

      return { success: true, user };
    } catch (error) {
      console.error('Error during token exchange:', error);
      return { success: false, error: 'Failed to authenticate with Discord' };
    }
  }

  getCurrentUser(): User | null {
    const authData = this.getAuthData();
    return authData?.user || null;
  }

  async getCurrentUserWithPermissions(): Promise<User | null> {
    const authData = this.getAuthData();
    if (!authData?.user) {
      return null;
    }

    try {
      // Get user permissions from ACL
      const acl = await databaseService.acls.getAclByDiscordId(authData.user.discord_id);
      
      return {
        ...authData.user,
        permissions: acl?.permissions || ['user']
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      // Return user without permissions on error
      return {
        ...authData.user,
        permissions: ['user']
      };
    }
  }

  isLoggedIn(): boolean {
    const authData = this.getAuthData();
    return !!(authData?.accessToken && authData?.user);
  }

  logout(): void {
    (this.store as any).delete(this.AUTH_KEY);
  }

  cancelAuthFlow(): void {
    if (this.authServer && this.authServer.listening) {
      this.authServer.close();
    }
  }

  getAccessToken(): string | null {
    const authData = this.getAuthData();
    return authData?.accessToken || null;
  }

  private getAuthData(): AuthData | null {
    try {
      const stored = (this.store as any).get(this.AUTH_KEY);
      return stored || null;
    } catch (error) {
      console.error('Error parsing auth data:', error);
      return null;
    }
  }
}

const authService = new AuthService();

// Export both interface types and service
export { DiscordUser, AuthResult, AuthData, AuthService, authService };
