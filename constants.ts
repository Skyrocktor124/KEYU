export const DEFAULT_THEME = {
  name: 'Neon Genesis',
  colors: ['#00ffcc', '#ff00ff', '#1a0b2e', '#4d0099'],
  speedMultiplier: 1.0,
  description: 'The default neon vibe.',
};

export const GEMINI_SYSTEM_INSTRUCTION = `
You are a game designer for a futuristic rhythm game. 
The user will give you a "Vibe" or "Mood".
You must return a JSON object defining the visual theme.
The JSON schema is:
{
  "name": "Creative Name",
  "colors": ["HexPrimary (Bright)", "HexSecondary (Bright)", "HexBackground (Dark)", "HexGrid (Medium)"],
  "speedMultiplier": number (0.8 for calm, up to 2.5 for intense),
  "description": "Short flavor text."
}
Return ONLY the raw JSON.
`;

export const GAME_CONFIG = {
  SPAWN_Z: -20,
  HIT_Z: 0,
  DESPAWN_Z: 5,
  HIT_RADIUS: 2.5, // Increased from 1.5 to 2.5 for easier hits
  LANE_WIDTH: 3,
};