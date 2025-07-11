// Avatar utility functions

export const getDefaultAvatarSvg = (): string => {
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

export const getDiscordAvatarUrl = (discordId: string, avatar?: string): string => {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
  } else {
    return getDefaultAvatarSvg();
  }
};
