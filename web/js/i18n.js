// Messaggi di sicurezza. ATTENZIONE: le traduzioni (soprattutto ps, ti, ur, fa) sono BOZZE
// da far validare da mediatori linguistico-culturali prima di qualsiasi uso reale.
window.LANGS = [
  { code: "it", label: "Italiano", rtl: false },
  { code: "en", label: "English", rtl: false },
  { code: "fr", label: "Français", rtl: false },
  { code: "ar", label: "العربية", rtl: true },
  { code: "fa", label: "فارسی / دری", rtl: true },
  { code: "ps", label: "پښتو", rtl: true },
  { code: "ur", label: "اردو", rtl: true },
  { code: "ti", label: "ትግርኛ", rtl: false }
];

window.ICONS = { official: "📢", flood: "🌊", rain: "🌧️", cold: "🥶", heat: "🥵", snow: "🏔️", wind: "🌬️" };
window.LEVEL_ICON = ["🟢", "🟡", "🟠", "🔴"];

window.MSG = {
  flood: {
    it: "Pericolo piena: il fiume può salire all'improvviso. Non dormire e non sostare nel letto del fiume o sotto i ponti.",
    en: "Flood danger: the river can rise suddenly. Do not sleep or stay in the riverbed or under bridges.",
    fr: "Danger de crue : la rivière peut monter d'un coup. Ne dormez pas et ne restez pas dans le lit de la rivière ni sous les ponts.",
    ar: "خطر فيضان: قد يرتفع منسوب النهر فجأة. لا تنم ولا تبقَ في مجرى النهر أو تحت الجسور.",
    fa: "خطر سیل: آب رودخانه ممکن است ناگهان بالا بیاید. در بستر رودخانه یا زیر پل‌ها نخوابید و نمانید.",
    ps: "د سیلاب خطر: د سیند اوبه ښايي ناڅاپه پورته شي. د سیند په بستر کې یا د پلونو لاندې مه ویده کېږئ او مه پاتې کېږئ.",
    ur: "سیلاب کا خطرہ: دریا کا پانی اچانک بڑھ سکتا ہے۔ دریا کی تہہ میں یا پلوں کے نیچے نہ سوئیں اور نہ رکیں۔",
    ti: "ሓደጋ ውሕጅ፦ ሩባ ብሃንደበት ክመልእ ይኽእል እዩ። ኣብ ውሽጢ ሩባ ወይ ኣብ ትሕቲ ድልድል ኣይትደቀሱ ኣይትጸንሑ።"
  },
  rain: {
    it: "Pioggia forte: sentieri scivolosi e torrenti in piena. Non attraversare corsi d'acqua, cerca un riparo.",
    en: "Heavy rain: slippery paths and swollen streams. Do not cross streams, find shelter.",
    fr: "Fortes pluies : sentiers glissants et torrents en crue. Ne traversez pas les cours d'eau, cherchez un abri.",
    ar: "أمطار غزيرة: الطرق زلقة والجداول ممتلئة. لا تعبر مجاري المياه، وابحث عن مأوى.",
    fa: "باران شدید: مسیرها لغزنده و جوی‌ها پرآب است. از آب عبور نکنید، سرپناه پیدا کنید.",
    ps: "سخت باران: لارې ښوییدونکې دي او ویالې ډکې دي. له اوبو مه تېرېږئ، سرپناه ومومئ.",
    ur: "تیز بارش: راستے پھسلن والے اور ندیاں بھری ہوئی ہیں۔ پانی پار نہ کریں، پناہ تلاش کریں۔",
    ti: "ብርቱዕ ዝናብ፦ መገድታት ዘንሸራትቱን ወሓይዝ ዝመልኡን እዮም። ማይ ኣይትሳገሩ፣ መዕቆቢ ድለዩ።"
  },
  cold: {
    it: "Freddo intenso: rischio ipotermia. Cerca un riparo, resta asciutto, non camminare da solo in montagna o nel bosco.",
    en: "Severe cold: risk of hypothermia. Find shelter, stay dry, do not walk alone in the mountains or forest.",
    fr: "Froid intense : risque d'hypothermie. Trouvez un abri, restez au sec, ne marchez pas seul en montagne ou en forêt.",
    ar: "برد شديد: خطر انخفاض حرارة الجسم. ابحث عن مأوى، حافظ على جفافك، لا تمشِ وحدك في الجبال أو الغابات.",
    fa: "سرمای شدید: خطر هیپوترمی (سرمازدگی). سرپناه پیدا کنید، خشک بمانید، تنها در کوه یا جنگل راه نروید.",
    ps: "سخته یخني: د بدن د تودوخې د راټیټېدو خطر. سرپناه ومومئ، وچ پاتې شئ، په غرونو یا ځنګل کې یوازې مه ځئ.",
    ur: "شدید سردی: ہائپوتھرمیا کا خطرہ۔ پناہ تلاش کریں، خشک رہیں، پہاڑوں یا جنگل میں اکیلے نہ چلیں۔",
    ti: "ብርቱዕ ቁሪ፦ ሓደጋ ምውራድ ሙቀት ኣካላት። መዕቆቢ ድለዩ፣ ደረቕ ኩኑ፣ ኣብ ጎቦ ወይ ዱር በይንኹም ኣይትኺዱ።"
  },
  heat: {
    it: "Caldo estremo: rischio colpo di calore. Bevi acqua spesso, cerca l'ombra, evita di camminare nelle ore centrali.",
    en: "Extreme heat: risk of heatstroke. Drink water often, find shade, avoid walking in the middle of the day.",
    fr: "Chaleur extrême : risque de coup de chaleur. Buvez souvent, cherchez l'ombre, évitez de marcher aux heures chaudes.",
    ar: "حر شديد: خطر ضربة الشمس. اشرب الماء كثيرًا، ابحث عن الظل، تجنّب المشي وقت الظهيرة.",
    fa: "گرمای شدید: خطر گرمازدگی. زیاد آب بنوشید، در سایه بمانید، در ساعات میانی روز راه نروید.",
    ps: "سخته ګرمي: د تودوخې د وهلو خطر. ډېرې اوبه وڅښئ، سیوری ومومئ، د غرمې په وخت کې مه ګرځئ.",
    ur: "شدید گرمی: لو لگنے کا خطرہ۔ بار بار پانی پئیں، سائے میں رہیں، دوپہر کے وقت چلنے سے بچیں۔",
    ti: "ብርቱዕ ሃሩር፦ ሓደጋ ወቕዒ ጸሓይ። ብዙሕ ማይ ስተዩ፣ ጽላል ድለዩ፣ ኣብ ፍርቂ መዓልቲ ኣይትጓዓዙ።"
  },
  snow: {
    it: "Neve e pericolo valanghe in quota: i sentieri dei valichi sono pericolosi. Non partire con la neve o di notte.",
    en: "Snow and avalanche danger at altitude: mountain pass trails are dangerous. Do not set off in snow or at night.",
    fr: "Neige et risque d'avalanche en altitude : les sentiers des cols sont dangereux. Ne partez pas sous la neige ni de nuit.",
    ar: "ثلوج وخطر انهيارات ثلجية في المرتفعات: ممرات الجبال خطيرة. لا تنطلق أثناء الثلج أو في الليل.",
    fa: "برف و خطر بهمن در ارتفاعات: مسیرهای گردنه‌ها خطرناک است. هنگام برف یا شب حرکت نکنید.",
    ps: "واوره او په لوړو سیمو کې د برفکوچ خطر: د غرنیو درو لارې خطرناکې دي. د واورې پر مهال یا د شپې مه روانېږئ.",
    ur: "برف اور بلندی پر برفانی تودے کا خطرہ: پہاڑی دروں کے راستے خطرناک ہیں۔ برف باری یا رات میں سفر شروع نہ کریں۔",
    ti: "በረድን ሓደጋ ምንቁልቋል በረድን ኣብ ላዕሊ፦ መገድታት ጎቦታት ሓደገኛታት እዮም። ብበረድ ወይ ብለይቲ ኣይትብገሱ።"
  },
  wind: {
    it: "Vento forte e temporali: pericolo di alberi e rami che cadono. Non accamparti nel bosco o vicino ai fiumi.",
    en: "Strong wind and storms: danger from falling trees and branches. Do not camp in woods or near rivers.",
    fr: "Vent fort et orages : danger de chutes d'arbres et de branches. Ne campez pas en forêt ni près des rivières.",
    ar: "رياح قوية وعواصف رعدية: خطر سقوط الأشجار والأغصان. لا تخيّم في الغابات أو قرب الأنهار.",
    fa: "باد شدید و طوفان: خطر افتادن درخت و شاخه. در جنگل یا نزدیک رودخانه چادر نزنید.",
    ps: "تېز باد او تندر: د ونو او څانګو د غورځېدو خطر. په ځنګلونو کې یا سیندونو ته نږدې مه پاتې کېږئ.",
    ur: "تیز ہوا اور طوفان: درخت اور شاخیں گرنے کا خطرہ۔ جنگل میں یا دریا کے قریب کیمپ نہ لگائیں۔",
    ti: "ብርቱዕ ንፋስን ማዕበልን፦ ሓደጋ ምውዳቕ ኣግራብን ጨናፍርን። ኣብ ዱር ወይ ጥቓ ሩባ ኣይትሕደሩ።"
  },
  official: {
    it: "Allerta meteo ufficiale in vigore in questa zona. Segui le indicazioni delle autorità e dei volontari.",
    en: "Official weather warning in force in this area. Follow the instructions of the authorities and volunteers.",
    fr: "Alerte météo officielle en cours dans cette zone. Suivez les consignes des autorités et des bénévoles.",
    ar: "تحذير جوي رسمي ساري في هذه المنطقة. اتبع تعليمات السلطات والمتطوعين.",
    fa: "هشدار رسمی هواشناسی در این منطقه فعال است. از راهنمایی‌های مقامات و داوطلبان پیروی کنید.",
    ps: "په دې سیمه کې د هوا رسمي خبرتیا روانه ده. د چارواکو او رضاکارانو لارښوونې ومنئ.",
    ur: "اس علاقے میں موسم کی سرکاری وارننگ نافذ ہے۔ حکام اور رضاکاروں کی ہدایات پر عمل کریں۔",
    ti: "ኣብዚ ከባቢ ወግዓዊ ናይ ኣየር ሓበሬታ ሓደጋ ኣሎ። መምርሒ ሰበ-ስልጣንን ወለንተኛታትን ስዓቡ።"
  },
  emergency: {
    it: "In pericolo? Chiama il {n}: è gratuito.",
    en: "In danger? Call {n}: it is free.",
    fr: "En danger ? Appelez le {n} : c'est gratuit.",
    ar: "في خطر؟ اتصل بـ {n}: الاتصال مجاني.",
    fa: "در خطر هستید؟ با {n} تماس بگیرید: رایگان است.",
    ps: "په خطر کې یاست؟ {n} ته زنګ ووهئ: وړیا دی.",
    ur: "خطرے میں ہیں؟ {n} پر کال کریں: یہ مفت ہے۔",
    ti: "ኣብ ሓደጋ ዲኹም? ናብ {n} ደውሉ፦ ብናጻ እዩ።"
  },
  none: {
    it: "Nessuna allerta meteo prevista nelle prossime 72 ore. Resta comunque prudente.",
    en: "No weather alert expected in the next 72 hours. Stay careful anyway.",
    fr: "Aucune alerte météo prévue dans les 72 prochaines heures. Restez prudent.",
    ar: "لا توجد تحذيرات جوية متوقعة خلال الـ 72 ساعة القادمة. ابقَ حذرًا.",
    fa: "در ۷۲ ساعت آینده هشدار هواشناسی پیش‌بینی نشده است. با این حال مراقب باشید.",
    ps: "په راتلونکو ۷۲ ساعتونو کې د هوا خبرتیا نشته. بیا هم پام کوئ.",
    ur: "اگلے 72 گھنٹوں میں موسم کی کوئی وارننگ متوقع نہیں۔ پھر بھی محتاط رہیں۔",
    ti: "ኣብ ዝመጽእ 72 ሰዓት ናይ ኣየር ሓበሬታ ሓደጋ የለን። ግን ተጠንቀቑ።"
  }
};

// Compone il messaggio da inoltrare (Telegram/WhatsApp/cartello) per un punto e una lingua.
(typeof window !== 'undefined' ? window : globalThis).composeMessage = function (site, result, lang) {
  const L = (key) => (MSG[key][lang] || MSG[key].en);
  const lines = [LEVEL_ICON[result.level] + " " + site.nome];
  if (!result.hazards.length) lines.push(L("none"));
  const seen = new Set();
  for (const h of result.hazards) {
    if (seen.has(h.type)) continue; seen.add(h.type);
    lines.push(LEVEL_ICON[h.level] + ICONS[h.type] + " " + L(h.type));
  }
  lines.push("☎️ " + L("emergency").replace("{n}", (EMERGENCY[site.paese] || "112").split(" ")[0]));
  return lines.join("\n");
};
