import { readFileSync } from 'fs';
import { join } from 'path';

export class HtmlTemplateService {
    constructor() {
        // Path to templates directory - handle both dev and production
    }

    getAuthSuccessHtml(): string {
        try {
            // Try to read the template file
            const templatePath = join(__dirname, '..', '..', 'templates', 'auth-success.html');
            return readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error('Error reading auth success template:', error);
            // Fallback to inline HTML
            return this.getInlineSuccessHtml();
        }
    }

    getAuthErrorHtml(error: string): string {
        try {
            // Try to read the template file
            const templatePath = join(__dirname, '..', '..', 'templates', 'auth-error.html');
            let template = readFileSync(templatePath, 'utf8');
            return template.replace('{{ERROR_MESSAGE}}', error);
        } catch (readError) {
            console.error('Error reading auth error template:', readError);
            // Fallback to inline HTML
            return this.getInlineErrorHtml(error);
        }
    }

    getAuthCancelledHtml(): string {
        try {
            // Try to read the template file
            const templatePath = join(__dirname, '..', '..', 'templates', 'auth-cancelled.html');
            return readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error('Error reading auth cancelled template:', error);
            // Fallback to inline HTML
            return this.getInlineCancelledHtml();
        }
    }

    private getInlineSuccessHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Successful</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0f0f23, #1a1a2e);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                
                .info-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 1.5rem;
                    background: #2ecc71;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                }
                
                h1 {
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                    color: #ecf0f1;
                    font-weight: 600;
                }
                
                p {
                    font-size: 1rem;
                    color: rgba(236, 240, 241, 0.8);
                    line-height: 1.6;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="info-icon">✓</div>
                <h1>Login Successful!</h1>
                <p>You have been successfully logged in. You may now close this window.</p>
            </div>
            
            <script>
                // Auto-close after 3 seconds
                setTimeout(() => {
                    window.close();
                }, 3000);
            </script>
        </body>
        </html>
        `;
    }

    private getInlineErrorHtml(error: string): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Error</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0f0f23, #1a1a2e);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                
                .error-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 1.5rem;
                    background: #e74c3c;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                }
                
                h1 {
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                    color: #ecf0f1;
                    font-weight: 600;
                }
                
                p {
                    font-size: 1rem;
                    color: rgba(236, 240, 241, 0.8);
                    line-height: 1.6;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">✗</div>
                <h1>Login Error</h1>
                <p>An error occurred during login: ${error}</p>
                <p>Please close this window and try again.</p>
            </div>
        </body>
        </html>
        `;
    }

    private getInlineCancelledHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Cancelled</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0f0f23, #1a1a2e);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                
                .warning-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 1.5rem;
                    background: #f39c12;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                }
                
                h1 {
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                    color: #ecf0f1;
                    font-weight: 600;
                }
                
                p {
                    font-size: 1rem;
                    color: rgba(236, 240, 241, 0.8);
                    line-height: 1.6;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="warning-icon">!</div>
                <h1>Login Cancelled</h1>
                <p>Login was cancelled. You may close this window.</p>
            </div>
        </body>
        </html>
        `;
    }
}
