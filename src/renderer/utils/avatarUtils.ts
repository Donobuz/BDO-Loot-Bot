// Avatar utility functions

const getDefaultAvatarSvg = (): string => {
  const svgContent = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill="url(#bg)"/>
      <circle cx="64" cy="50" r="20" fill="rgba(255,255,255,0.8)"/>
      <path d="M 30 90 Q 30 75 45 75 L 83 75 Q 98 75 98 90 L 98 105 Q 98 120 83 120 L 45 120 Q 30 120 30 105 Z" fill="rgba(255,255,255,0.8)"/>
      <text x="64" y="105" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#667eea" font-weight="bold">BDO</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svgContent.trim())}`;
};

/**
 * Determines the best format for a Discord avatar with browser compatibility
 * @param avatarHash Discord avatar hash
 * @param preferCompatibility Whether to prefer older browser compatibility over file size
 * @returns Object with format and whether it's animated
 */
const getAvatarFormat = (avatarHash: string, preferCompatibility: boolean = false) => {
  const isAnimated = avatarHash.startsWith('a_');
  
  if (isAnimated) {
    // Animated avatars must be GIF
    return {
      format: 'gif',
      isAnimated: true,
      fallbackFormat: 'gif' // No fallback needed for GIF
    };
  }
  
  // For static avatars, choose based on compatibility preference
  return {
    format: preferCompatibility ? 'png' : 'webp',
    isAnimated: false,
    fallbackFormat: 'png' // PNG is universally supported
  };
};

/**
 * Generates a Discord avatar URL with browser compatibility
 * @param discordId Discord user ID
 * @param avatar Avatar hash (optional)
 * @param size Avatar size (default: 128)
 * @param preferCompatibility Use PNG instead of WebP for older browser support
 * @returns Avatar URL or default SVG
 */
const getDiscordAvatarUrl = (discordId: string, avatar?: string, size: number = 128, preferCompatibility: boolean = false): string => {
  if (!avatar) {
    return getDefaultAvatarSvg();
  }

  const { format } = getAvatarFormat(avatar, preferCompatibility);
  
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${format}?size=${size}`;
};

/**
 * Enhanced avatar URL with automatic fallback handling
 * Returns both primary and fallback URLs for maximum compatibility
 */
const getDiscordAvatarUrlWithFallback = (discordId: string, avatar?: string, size: number = 128): { primary: string; fallback: string } => {
  if (!avatar) {
    const defaultAvatar = getDefaultAvatarSvg();
    return { primary: defaultAvatar, fallback: defaultAvatar };
  }

  const { format, fallbackFormat } = getAvatarFormat(avatar, false);
  
  return {
    primary: `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${format}?size=${size}`,
    fallback: `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${fallbackFormat}?size=${size}`
  };
};

/**
 * Browser-safe avatar URL that always uses PNG for maximum compatibility
 * Use this for older browsers or when WebP support is uncertain
 */
const getCompatibleDiscordAvatarUrl = (discordId: string, avatar?: string, size: number = 128): string => {
  return getDiscordAvatarUrl(discordId, avatar, size, true);
};

// Export all functions
export {
  getDefaultAvatarSvg,
  getDiscordAvatarUrl,
  getDiscordAvatarUrlWithFallback,
  getCompatibleDiscordAvatarUrl
};
