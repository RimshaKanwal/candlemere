// Stable server values stay unchanged; these are the short names players see.
export const DISPLAY_NAMES = {
  "Miss Ruby": "Ruby", "Captain Gold": "Gold", "Lady Pearl": "Pearl", "Mr Jade": "Jade",
  "Mrs Blue": "Blue", "Professor Violet": "Violet", "Doctor Rose": "Rose", "Baron Bronze": "Bronze",
  Candlestick: "Candle", "Fire Poker": "Poker", "Silk Scarf": "Scarf", "Stone Statue": "Statue",
  "Music Room": "Ballroom", Greenhouse: "Garden", "Sitting Room": "Lounge", "Entrance Hall": "Hall",
  Office: "Study", "Wine Cellar": "Cellar",
};

export const displayName = (value) => DISPLAY_NAMES[value] || value;
