import { LanguageId } from './types';

export const LANGUAGE_LABELS: Array<{ id: LanguageId; label: string; native: string }> = [
  { id: 'kn', label: 'Kannada (Primary)', native: 'ಕನ್ನಡ' },
  { id: 'en', label: 'English', native: 'English' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { id: 'te', label: 'Telugu', native: 'తెలుగు' },
];

export interface UiStrings {
  welcomeToast: string;
  zonesLabel: string;
  tokensLabel: string;
  missionsLabel: string;
  phoneHint: string;
  radioOff: string;
  onFoot: string;
  swimming: string;
  sitting: string;
  crouching: string;
  blocking: string;
  studioBtn: string;
  mapBtn: string;
  garageBtn: string;
  menuBtn: string;
  phoneBtn: string;
  radioBtn: string;
  metroWelcome: (stationKn: string, stationEn: string) => string;
  metroArrival: (stationKn: string, stationEn: string) => string;
  nammaYatriArrived: (driver: string, plate: string) => string;
}

const STRINGS: Record<LanguageId, UiStrings> = {
  kn: {
    welcomeToast: 'ನಮ್ಮ ಬೆಂಗಳೂರಿಗೆ ಸ್ವಾಗತ! [Tab] ಫೋನ್ · [P] ಪಾತ್ರ ಬದಲಾವಣೆ · [U] ಸ್ಟುಡಿಯೋ',
    zonesLabel: 'ವಲಯಗಳು',
    tokensLabel: 'ಟೋಕನ್',
    missionsLabel: 'ಮಿಷನ್',
    phoneHint: 'WASD ಚಲನೆ · F ಪ್ರವೇಶ · Tab ಸ್ಮಾರ್ಟ್‌ಫೋನ್ · R ರೇಡಿಯೋ · M ನಕ್ಷೆ · ESC ಮೆನು',
    radioOff: 'ರೇಡಿಯೋ ಆಫ್ [R]',
    onFoot: 'ನಡಿಗೆ',
    swimming: 'ಈಜು',
    sitting: 'ವಿಶ್ರಾಂತಿ',
    crouching: 'ಬಾಗಿ ನಡಿಗೆ',
    blocking: 'ರಕ್ಷಣೆ',
    studioBtn: 'ಸ್ಟುಡಿಯೋ [U]',
    mapBtn: 'ನಕ್ಷೆ [M]',
    garageBtn: 'ಗ್ಯಾರೇಜ್',
    menuBtn: 'ಮೆನು',
    phoneBtn: 'ಫೋನ್ [Tab]',
    radioBtn: 'ರೇಡಿಯೋ [R]',
    metroWelcome: (kn, en) => `ನಮ್ಮ ಮೆಟ್ರೋಗೆ ಸ್ವಾಗತ: ${kn} (${en}). QR ಟಿಕೆಟ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್‌ಗೆ ಬನ್ನಿ.`,
    metroArrival: (kn, en) => `ಮುಂದಿನ ನಿಲ್ದಾಣ: ${kn} · Next station: ${en}. ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ.`,
    nammaYatriArrived: (driver, plate) => `ನಮ್ಮ ಯಾತ್ರಿ ಚಾಲಕ ${driver} (${plate}) ಬಂದಿದ್ದಾರೆ! ಹತ್ತಲು [F] ಒತ್ತಿ.`,
  },
  en: {
    welcomeToast: 'Welcome to MG Road, Bengaluru! [Tab] Phone · [P] Switch Hero · [U] Studio',
    zonesLabel: 'Zones',
    tokensLabel: 'Tokens',
    missionsLabel: 'Missions',
    phoneHint: 'WASD Move/Drive · F Interact · Tab Phone · R Radio · M Map · ESC Menu',
    radioOff: 'Radio Off [R]',
    onFoot: 'On Foot',
    swimming: 'Swimming',
    sitting: 'Seated',
    crouching: 'Crouching',
    blocking: 'Blocking',
    studioBtn: 'Studio [U]',
    mapBtn: 'Map [M]',
    garageBtn: 'Garage',
    menuBtn: 'Menu',
    phoneBtn: 'Phone [Tab]',
    radioBtn: 'Radio [R]',
    metroWelcome: (kn, en) => `Welcome to Namma Metro ${en} (${kn}). Scan QR Ticket to reach Platform.`,
    metroArrival: (kn, en) => `Next station: ${en} (${kn}). Doors open on the left.`,
    nammaYatriArrived: (driver, plate) => `Namma Yatri driver ${driver} (${plate}) has arrived! Press [F] to board.`,
  },
  hi: {
    welcomeToast: 'बेंगलुरु में आपका स्वागत है! [Tab] फ़ोन · [P] पात्र बदलें · [U] स्टूडियो',
    zonesLabel: 'ज़ोन',
    tokensLabel: 'टोकन',
    missionsLabel: 'मिशन',
    phoneHint: 'WASD चलें · F इंटरैक्ट · Tab स्मार्टफ़ोन · R रेडियो · M मैप · ESC मेनू',
    radioOff: 'रेडियो बंद [R]',
    onFoot: 'पैदल',
    swimming: 'तैराकी',
    sitting: 'बैठे हुए',
    crouching: 'झुककर',
    blocking: 'बचाव',
    studioBtn: 'स्टूडियो [U]',
    mapBtn: 'मैप [M]',
    garageBtn: 'गैराज',
    menuBtn: 'मेनू',
    phoneBtn: 'फ़ोन [Tab]',
    radioBtn: 'रेडियो [R]',
    metroWelcome: (kn, en) => `नम्मा मेट्रो ${en} (${kn}) में स्वागत है। प्लेटफॉर्म के लिए QR टिकट स्कैन करें।`,
    metroArrival: (kn, en) => `अगला स्टेशन: ${en} (${kn})। दरवाज़े बाईं ओर खुलेंगे।`,
    nammaYatriArrived: (driver, plate) => `नम्मा यात्री ड्राइवर ${driver} (${plate}) आ गए हैं! बैठने के लिए [F] दबाएँ।`,
  },
  ta: {
    welcomeToast: 'நம்ம பெங்களூருக்கு வரவேற்கிறோம்! [Tab] போன் · [P] கதாபாத்திரம் · [U] ஸ்டுடியோ',
    zonesLabel: 'மண்டலங்கள்',
    tokensLabel: 'டோக்கன்',
    missionsLabel: 'மிஷன்',
    phoneHint: 'WASD இயக்கம் · F செயலாற்று · Tab போன் · R வானொலி · M வரைபடம் · ESC',
    radioOff: 'வானொலி ஆஃப் [R]',
    onFoot: 'நடை',
    swimming: 'நீச்சல்',
    sitting: 'அமர்ந்துள்ளார்',
    crouching: 'குனிந்து',
    blocking: 'தடுப்பு',
    studioBtn: 'ஸ்டுடியோ [U]',
    mapBtn: 'வரைபடம் [M]',
    garageBtn: 'கேரேஜ்',
    menuBtn: 'மெனு',
    phoneBtn: 'போன் [Tab]',
    radioBtn: 'வானொலி [R]',
    metroWelcome: (kn, en) => `நம்ம மெட்ரோ ${en} (${kn}) வரவேற்கிறது. QR டிக்கெட்டை ஸ்கேன் செய்யவும்.`,
    metroArrival: (kn, en) => `அடுத்த நிலையம்: ${en} (${kn}). கதவுகள் இடதுபுறம் திறக்கும்.`,
    nammaYatriArrived: (driver, plate) => `நம்ம யாத்ரி ஓட்டுநர் ${driver} (${plate}) வந்துவிட்டார்! ஏற [F] அழுத்தவும்.`,
  },
  te: {
    welcomeToast: 'నమ్మ బెంగళూరుకు స్వాగతం! [Tab] ఫోన్ · [P] పాత్ర · [U] స్టూడియో',
    zonesLabel: 'జోన్లు',
    tokensLabel: 'టోకెన్లు',
    missionsLabel: 'మిషన్లు',
    phoneHint: 'WASD కదలిక · F ఇంటరాక్ట్ · Tab ఫోన్ · R రేడియో · M మ్యాప్ · ESC',
    radioOff: 'రేడియో ఆఫ్ [R]',
    onFoot: 'నడక',
    swimming: 'ఈత',
    sitting: 'కూర్చున్నారు',
    crouching: 'వంగి',
    blocking: 'రక్షణ',
    studioBtn: 'స్టూడియో [U]',
    mapBtn: 'మ్యాప్ [M]',
    garageBtn: 'గ్యారేజ్',
    menuBtn: 'మెనూ',
    phoneBtn: 'ఫోన్ [Tab]',
    radioBtn: 'రేడియో [R]',
    metroWelcome: (kn, en) => `నమ్మ మెట్రో ${en} (${kn}) కు స్వాగతం. QR టికెట్ స్కాన్ చేయండి.`,
    metroArrival: (kn, en) => `తదుపరి స్టేషన్: ${en} (${kn}). తలుపులు ఎడమవైపు తెరుచుకుంటాయి.`,
    nammaYatriArrived: (driver, plate) => `నమ్మ యాత్రి డ్రైవర్ ${driver} (${plate}) వచ్చారు! ఎక్కడానికి [F] నొక్కండి.`,
  },
};

export function getUiStrings(lang: LanguageId): UiStrings {
  return STRINGS[lang] || STRINGS.kn;
}

export const KANNADA_PRIMARY_DIALOGUES: Array<{
  speaker: string;
  language: string;
  kn: string;
  en: string;
}> = [
  {
    speaker: 'ಆಟೋ ಅಣ್ಣ (Auto Anna)',
    language: 'Kannada',
    kn: 'ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು ಸರ್? ಎಂಜಿ ರಸ್ತೆಗೆ ಮೀಟರ್ ಹಾಕ್ತೀನಿ ಬನ್ನಿ!',
    en: 'Where to sir? I will put meter to MG Road, hop in!',
  },
  {
    speaker: 'ದರ್ಶಿನಿ ಮಾಲೀಕ (Darshini Owner)',
    language: 'Kannada',
    kn: 'ಬಿಸಿ ಬಿಸಿ ಮಸಾಲೆ ದೋಸೆ, ಫಿಲ್ಟರ್ ಕಾಫಿ ರೆಡಿ ಇದೆ ಗುರು!',
    en: 'Hot Masala Dosa and Filter Kaapi are ready, guru!',
  },
  {
    speaker: 'ಬೆಂಗಳೂರು ಮಿತ್ರ (Local Friend)',
    language: 'Kannada',
    kn: 'ಏನ್ ಗುರು, ಹೇಗಿದ್ದೀಯ? ಇವತ್ತು ಕಬ್ಬನ್ ಪಾರ್ಕ್ ವಾತಾವರಣ ಸೂಪರ್ ಆಗಿದೆ!',
    en: 'Hey guru, how are you? Cubbon Park weather is superb today!',
  },
  {
    speaker: 'ಮೆಟ್ರೋ ಸಿಬ್ಬಂದಿ (Metro Staff)',
    language: 'Kannada',
    kn: 'ಪರ್ಪಲ್ ಲೈನ್ ರೈಲು ಈಗ ಬರುತ್ತದೆ. ಹಳದಿ ಗೆರೆಯ ಹಿಂದೆ ನಿಲ್ಲಿ.',
    en: 'Purple Line train is arriving now. Please stand behind the yellow line.',
  },
  {
    speaker: 'ಬಿಎಂಟಿಸಿ ಕಂಡಕ್ಟರ್ (BMTC Conductor)',
    language: 'Kannada',
    kn: 'ಮೆಜೆಸ್ಟಿಕ್, ಶಿವಾಜಿನಗರ, ಇಂದಿರಾನಗರ, ವೈಟ್‌ಫೀಲ್ಡ್... ಮುಂದೆ ಬನ್ನಿ!',
    en: 'Majestic, Shivajinagar, Indiranagar, Whitefield... step forward!',
  },
  {
    speaker: 'ಕೆಆರ್ ಮಾರ್ಕೆಟ್ ಹೂವಿನ ವ್ಯಾಪಾರಿ (Florist)',
    language: 'Kannada',
    kn: 'ಮಲ್ಲಿಗೆ ಹೂವು ಫ್ರೆಶ್ ಇದೆ ಮೇಡಂ, ತಗೊಳ್ಳಿ!',
    en: 'Fresh jasmine flowers available madam, please take!',
  },
  {
    speaker: 'ಟೆಕ್ ಉದ್ಯೋಗಿ (Tech Commuter)',
    language: 'English / Kannada',
    kn: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್ ದಾಟಿ ನಮ್ಮ ಮೆಟ್ರೋ ಹತ್ತಿದ್ರೆ ಟೈಮ್ ಸೇವ್ ಆಗುತ್ತೆ.',
    en: 'Taking Namma Metro past Silk Board saves so much commute time.',
  },
  {
    speaker: 'ನಮ್ಮ ಮಾರ್ಟ್ ಸಿಬ್ಬಂದಿ (Namma Mart)',
    language: 'Kannada',
    kn: 'ನಮ್ಮ ಮಾರ್ಟ್‌ಗೆ ಸ್ವಾಗತ! ಹಾಲು, ಬ್ರೆಡ್, ಅಕ್ಕಿ ಮತ್ತು ತಾಜಾ ತರಕಾರಿ ಇದೆ.',
    en: 'Welcome to Namma Mart! Fresh milk, bread, rice, and vegetables inside.',
  },
];

export function speakKannadaOrEnglish(text: string, lang: LanguageId): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const targetLang = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2))) ||
      voices.find((v) => v.lang.toLowerCase().includes('in'));
    if (match) utter.voice = match;
    utter.lang = targetLang;
    utter.rate = 0.96;
    utter.volume = 0.72;
    window.speechSynthesis.speak(utter);
  } catch {
    // Graceful silent fallback; subtitle is always rendered in HUD
  }
}
